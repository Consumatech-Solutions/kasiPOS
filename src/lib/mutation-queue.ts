import { QueryClient } from "@tanstack/react-query";
import {
  offlineDetector,
  isOffline,
  checkOfflineStatus,
} from "@/lib/offline-detector";
import { feedback, genLogId } from "@/lib/feedback";
import { executeMutation } from "@/lib/mutation-registry";
import { getDb } from "@/lib/db";

export interface QueuedMutation {
  id: string;
  mutationKey: string[];
  mutationFn: () => Promise<any>;
  variables: any;
  timestamp: number;
  retries: number;
  status?: "pending" | "syncing" | "completed" | "failed";
  idempotencyKey?: string;
}

export type SyncStatus = "idle" | "syncing" | "preloading";

export interface SyncStatusData {
  status: SyncStatus;
  pendingCount: number;
  currentMutation: QueuedMutation | null;
  queue: QueuedMutation[];
  preloadProgress?: {
    completed: number;
    total: number;
  };
}

export interface ProcessQueueResult {
  initialPending: number;
  syncedCount: number;
  remainingPending: number;
  stoppedReason:
    | "empty"
    | "already_processing"
    | "offline_first_blocked"
    | "offline"
    | "network_pause"
    | "server_retry"
    | "completed";
}

type StatusChangeCallback = (status: SyncStatusData) => void;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const BATCH_SIZE = 3;

type SingleMutationOutcome =
  | "success"
  | "network_pause"
  | "server_retry"
  | "failed_removed";

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "undefined") return "undefined";
  if (t === "string" || t === "boolean" || t === "number" || t === "bigint") {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }
    if (Array.isArray(value)) {
      return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(String(value));
}

function hashVariables(variables: unknown): string {
  try {
    return stableStringify(variables);
  } catch {
    return String(variables);
  }
}

function getMutationPriority(m: QueuedMutation): number {
  const [type, action] = m.mutationKey;
  if (!type || !action) return 999;
  const key = `${type}/${action}`;
  if (key.startsWith("categories/")) return 1;
  if (key.startsWith("products/")) return 2;
  if (key.startsWith("customers/")) return 3;
  return 4;
}

class MutationQueue {
  private queue: QueuedMutation[] = [];
  private processing = false;
  private queryClient: QueryClient | null = null;
  private onlineHandler: (() => void) | null = null;
  private statusChangeCallbacks: StatusChangeCallback[] = [];
  private currentStatus: SyncStatus = "idle";
  private currentMutation: QueuedMutation | null = null;
  private preloadProgress: { completed: number; total: number } | undefined =
    undefined;
  private restorePromise: Promise<void> | null = null;

  constructor() {
    this.restorePromise = this.restoreQueue();
    this.setupOnlineListener();
  }

  private notifyStatusChange() {
    const statusData: SyncStatusData = {
      status: this.currentStatus,
      pendingCount: this.queue.length,
      currentMutation: this.currentMutation,
      queue: [...this.queue],
      preloadProgress: this.preloadProgress,
    };
    this.statusChangeCallbacks.forEach((callback) => callback(statusData));
  }

  subscribe(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.push(callback);
    callback(this.getStatus());
    return () => {
      const index = this.statusChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusChangeCallbacks.splice(index, 1);
      }
    };
  }

  setPreloadProgress(completed: number, total: number) {
    this.preloadProgress = { completed, total };
    if (completed < total) {
      this.currentStatus = "preloading";
    } else {
      this.preloadProgress = undefined;
      if (this.queue.length === 0) {
        this.currentStatus = "idle";
      }
    }
    this.notifyStatusChange();
  }

  getStatus(): SyncStatusData {
    return {
      status: this.currentStatus,
      pendingCount: this.queue.length,
      currentMutation: this.currentMutation,
      queue: [...this.queue],
      preloadProgress: this.preloadProgress,
    };
  }

  getCurrentMutation(): QueuedMutation | null {
    return this.currentMutation;
  }

  private setupOnlineListener() {
    if (typeof window !== "undefined") {
      const unsubscribe = offlineDetector.subscribe((offline) => {
        if (!offline && this.queue.length > 0) {
          console.log(
            "[MutationQueue] Online with pending queue; waiting for scheduled/manual sync"
          );
        }
      });

      const onNativeOnline = () => {
        window.setTimeout(() => {
          checkOfflineStatus(true).then((offline) => {
            if (!offline && this.queue.length > 0) {
              console.log(
                "[MutationQueue] Native online with pending queue; waiting for scheduled/manual sync"
              );
            }
          });
        }, 400);
      };
      window.addEventListener("online", onNativeOnline);

      this.onlineHandler = () => {
        unsubscribe();
        window.removeEventListener("online", onNativeOnline);
      };
    }
  }

  private async restoreQueue(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const db = getDb();
      const records = await db.mutationQueue.orderBy("id").toArray();
      if (records.length > 0) {
        for (const m of records) {
          const mutationKey =
            typeof m.mutationKey === "string"
              ? (JSON.parse(m.mutationKey) as string[])
              : m.mutationKey;
          this.queue.push({
            id: `mutation-${m.id ?? m.timestamp}-${Math.random()}`,
            mutationKey,
            variables: m.variables,
            timestamp: m.timestamp,
            retries: m.retries ?? 0,
            status: "pending",
            idempotencyKey: m.idempotencyKey,
            mutationFn: () => executeMutation(mutationKey, m.variables),
          });
        }
        console.log(
          `[MutationQueue] Restored ${records.length} queued mutations from Dexie`
        );
        this.notifyStatusChange();
      }
      if (records.length === 0 && typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("kasipos-mutation-queue");
        if (stored) {
          const parsed = JSON.parse(stored) as Array<{
            id: string;
            mutationKey: string[];
            variables: unknown;
            timestamp: number;
            retries: number;
          }>;
          if (Array.isArray(parsed) && parsed.length > 0) {
            await db.mutationQueue.bulkAdd(
              parsed.map((m) => ({
                mutationKey: JSON.stringify(m.mutationKey),
                variables: m.variables,
                timestamp: m.timestamp,
                retries: m.retries ?? 0,
                status: "pending",
              }))
            );
            localStorage.removeItem("kasipos-mutation-queue");
            return this.restoreQueue();
          }
        }
      }
    } catch (error) {
      console.error("[MutationQueue] Failed to restore queue:", error);
    }
  }

  private sortQueueByDependencyOrder(): void {
    this.queue.sort((a, b) => {
      const pa = getMutationPriority(a);
      const pb = getMutationPriority(b);
      if (pa !== pb) return pa - pb;
      return a.timestamp - b.timestamp;
    });
    void this.persistQueue();
  }

  private async persistQueue(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const db = getDb();
      await db.mutationQueue.clear();
      if (this.queue.length > 0) {
        await db.mutationQueue.bulkAdd(
          this.queue.map((m) => ({
            mutationKey: JSON.stringify(m.mutationKey),
            variables: m.variables,
            timestamp: m.timestamp,
            retries: m.retries,
            status: m.status ?? "pending",
            idempotencyKey: m.idempotencyKey,
          }))
        );
      }
    } catch (error) {
      console.error("[MutationQueue] Failed to persist queue:", error);
    }
  }

  private isNetworkError(error: any): boolean {
    const isOfflineStatus = isOffline();
    const msg = (error?.message ?? "").toLowerCase();
    return (
      isOfflineStatus ||
      error?.code === "ECONNABORTED" ||
      error?.code === "ERR_CONNECTION_REFUSED" ||
      error?.message?.includes("Network Error") ||
      msg.includes("failed to fetch") ||
      msg.includes("load failed") ||
      msg.includes("connection refused") ||
      error?.isOffline ||
      error?.isNetworkError
    );
  }

  private async processSingleMutationWithRetries(
    mutation: QueuedMutation
  ): Promise<SingleMutationOutcome> {
    while (true) {
      try {
        console.log(mutation.variables, mutation.mutationKey);
        await mutation.mutationFn();
        mutation.status = "completed";
        return "success";
      } catch (error: any) {
        const status = error?.response?.status;
        const is5xx =
          typeof status === "number" && status >= 500 && status < 600;

        if (this.isNetworkError(error)) {
          console.log("[MutationQueue] Network error - will retry when online");
          mutation.status = "pending";
          return "network_pause";
        }

        if (is5xx) {
          console.log("[MutationQueue] Server error (5xx) - will retry");
          mutation.status = "pending";
          return "server_retry";
        }

        if (mutation.retries < MAX_RETRIES) {
          mutation.retries++;
          mutation.status = "pending";
          console.log(
            `[MutationQueue] Retrying mutation (attempt ${mutation.retries}/${MAX_RETRIES})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY * mutation.retries)
          );
          continue;
        }

        mutation.status = "failed";
        const logId = genLogId();
        console.error(
          "[MutationQueue] Mutation failed after max retries:",
          mutation.mutationKey,
          error,
          logId
        );
        const userMessage =
          error?.message ?? "Changes could not be synced to the server.";
        feedback.error(
          "Sync failed",
          userMessage,
          "Your data is saved locally. Check your connection and try again.",
          { logId, code: error?.code }
        );
        return "failed_removed";
      }
    }
  }

  private async processBatchConcurrent(batch: QueuedMutation[]): Promise<{
    successes: number;
    stopReason: ProcessQueueResult["stoppedReason"] | null;
  }> {
    if (batch.length === 0) {
      return { successes: 0, stopReason: null };
    }

    const settled = await Promise.all(
      batch.map(async (mutation) => ({
        mutation,
        outcome: await this.processSingleMutationWithRetries(mutation),
      }))
    );

    let successes = 0;
    const failuresOrdered: QueuedMutation[] = [];

    for (const { mutation, outcome } of settled) {
      if (outcome === "success") {
        successes++;
        console.log(
          `[MutationQueue] Successfully synced mutation: ${mutation.mutationKey.join("/")}`
        );
        if (this.queryClient && mutation.mutationKey.length > 0) {
          const key = mutation.mutationKey[0];
          queueMicrotask(() => {
            this.queryClient?.invalidateQueries({
              queryKey: [key],
              refetchType: "all",
            });
          });
        }
      } else if (outcome === "failed_removed") {
      } else if (outcome === "network_pause" || outcome === "server_retry") {
        failuresOrdered.push(mutation);
      }
    }

    for (let i = failuresOrdered.length - 1; i >= 0; i--) {
      this.queue.unshift(failuresOrdered[i]);
    }

    if (failuresOrdered.length === 0) {
      return { successes, stopReason: null };
    }

    const first = settled.find(
      (s) => s.outcome === "network_pause" || s.outcome === "server_retry"
    );
    const stopReason =
      first?.outcome === "server_retry" ? "server_retry" : "network_pause";
    return { successes, stopReason };
  }

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
    if (typeof window === "undefined") return;
    this.restorePromise?.then(() => {});
  }

  add(
    mutation: Omit<QueuedMutation, "id" | "timestamp" | "retries" | "status" | "mutationFn"> & { mutationFn?: () => Promise<any> }
  ) {
    const [type, action] = mutation.mutationKey;
    const inferredKey =
      mutation.idempotencyKey ??
      (mutation.variables &&
      typeof mutation.variables === "object" &&
      "idempotencyKey" in mutation.variables &&
      typeof (mutation.variables as { idempotencyKey?: unknown })
        .idempotencyKey === "string"
        ? (mutation.variables as { idempotencyKey: string }).idempotencyKey
        : undefined);

    if (
      type === "transactions" &&
      action === "create" &&
      inferredKey !== undefined &&
      inferredKey !== ""
    ) {
      const hasDuplicate = this.queue.some(
        (m) =>
          m.mutationKey[0] === "transactions" &&
          m.mutationKey[1] === "create" &&
          (m.idempotencyKey ??
            (typeof m.variables === "object" &&
            m.variables &&
            "idempotencyKey" in m.variables
              ? String(
                  (m.variables as { idempotencyKey?: string }).idempotencyKey ??
                    ""
                )
              : "")) === inferredKey
      );
      if (hasDuplicate) {
        console.log(
          "[MutationQueue] Skipping duplicate transactions/create (same idempotency key)"
        );
        return;
      }
    }

    const mutationKeyStr = mutation.mutationKey.join("/");
    const variablesHash = hashVariables(mutation.variables);
    const isDuplicatePayload = this.queue.some(
      (m) =>
        m.mutationKey.join("/") === mutationKeyStr &&
        hashVariables(m.variables) === variablesHash
    );
    if (isDuplicatePayload) {
      console.log(
        "[MutationQueue] Duplicate mutation skipped:",
        mutationKeyStr
      );
      return;
    }

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: `mutation-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
      mutationFn: mutation.mutationFn ?? (() => executeMutation(mutation.mutationKey, mutation.variables)),
      ...(inferredKey !== undefined && inferredKey !== ""
        ? { idempotencyKey: inferredKey }
        : {}),
    };

    this.queue.push(queuedMutation);
    void this.persistQueue();

    if (this.currentStatus !== "preloading") {
      this.currentStatus = "idle";
    }
    this.notifyStatusChange();

    if (typeof window !== "undefined") {
      checkOfflineStatus().then((isOffline) => {
        if (isOffline) {
          console.log(
            "[MutationQueue] Offline - mutation queued for scheduled / reconnect sync"
          );
        }
      });
    }
  }

  async processQueue(options?: {
    force?: boolean;
  }): Promise<ProcessQueueResult> {
    const force = options?.force === true;
    const initialPending = this.queue.length;
    let syncedCount = 0;
    if (this.processing || this.queue.length === 0) {
      return {
        initialPending,
        syncedCount,
        remainingPending: this.queue.length,
        stoppedReason: this.processing ? "already_processing" : "empty",
      };
    }

    offlineDetector.setOfflineFirstActive(false);

    if (!force && offlineDetector.getOfflineFirstActive()) {
      console.log(
        "[MutationQueue] Offline-first mode active - skipping queue processing"
      );
      return {
        initialPending,
        syncedCount,
        remainingPending: this.queue.length,
        stoppedReason: "offline_first_blocked",
      };
    }

    if (typeof window !== "undefined") {
      if (force) {
        const hasConnectivity = await offlineDetector.forceCheck();
        if (!hasConnectivity) {
          console.log(
            "[MutationQueue] No connectivity for forced sync - skipping queue processing"
          );
          return {
            initialPending,
            syncedCount,
            remainingPending: this.queue.length,
            stoppedReason: "offline",
          };
        }
      } else {
        const isOfflineStatus = await checkOfflineStatus();
        if (isOfflineStatus) {
          console.log(
            "[MutationQueue] Still offline - skipping queue processing"
          );
          return {
            initialPending,
            syncedCount,
            remainingPending: this.queue.length,
            stoppedReason: "offline",
          };
        }
      }
    }

    this.processing = true;
    this.currentStatus = "syncing";
    this.sortQueueByDependencyOrder();
    console.log(
      `[MutationQueue] Processing ${this.queue.length} queued mutations (sorted by dependency order)`
    );
    this.notifyStatusChange();

    let stoppedReason: ProcessQueueResult["stoppedReason"] = "completed";
    try {
      outer: for (const priority of [1, 2, 3, 4] as const) {
        while (
          this.queue.length > 0 &&
          getMutationPriority(this.queue[0]) === priority
        ) {
          if (typeof window !== "undefined") {
            const isOfflineStatus = isOffline();
            if (isOfflineStatus) {
              const verifiedOffline = await checkOfflineStatus(true);
              if (verifiedOffline) {
                console.log(
                  "[MutationQueue] Went offline during processing - pausing"
                );
                this.currentStatus = "idle";
                this.currentMutation = null;
                this.notifyStatusChange();
                stoppedReason = "network_pause";
                break outer;
              }
            }
          }

          const batch: QueuedMutation[] = [];
          while (
            batch.length < BATCH_SIZE &&
            this.queue.length > 0 &&
            getMutationPriority(this.queue[0]) === priority
          ) {
            batch.push(this.queue.shift()!);
          }

          this.currentMutation = batch[0] ?? null;
          for (const m of batch) {
            m.status = "syncing";
          }
          this.notifyStatusChange();

          const { successes, stopReason } =
            await this.processBatchConcurrent(batch);
          syncedCount += successes;
          this.currentMutation = null;

          if (stopReason) {
            this.currentStatus = "idle";
            this.notifyStatusChange();
            stoppedReason = stopReason;
            await this.persistQueue();
            break outer;
          }

          await this.persistQueue();
          this.notifyStatusChange();
        }
      }
    } finally {
      this.processing = false;
      this.currentStatus = "idle";
      this.currentMutation = null;
      if (this.queue.length === 0) {
        console.log("[MutationQueue] All mutations synced successfully");
      }
      offlineDetector.setOfflineFirstActive(true);
      this.notifyStatusChange();
    }
    if (stoppedReason === "completed" && this.queue.length > 0) {
      stoppedReason = "network_pause";
    }
    return {
      initialPending,
      syncedCount,
      remainingPending: this.queue.length,
      stoppedReason,
    };
  }

  getQueue() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.processing = false;
    this.currentMutation = null;
    this.currentStatus = "idle";
    void this.persistQueue();
  }

  getPendingCount() {
    return this.queue.length;
  }

  destroy() {
    if (typeof window !== "undefined" && this.onlineHandler) {
      if (typeof this.onlineHandler === "function") {
        this.onlineHandler();
      }
    }
  }
}

export const mutationQueue = new MutationQueue();
