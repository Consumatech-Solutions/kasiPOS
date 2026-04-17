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
  /** Same sale / same Idempotency-Key as sent to POST /transactions */
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

/** Stable JSON string for comparing queued mutation payloads (sorted keys at every object level). */
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

/** Priority for sync order: categories before products (products reference categories), then customers, then others */
function getMutationPriority(m: QueuedMutation): number {
  const [type, action] = m.mutationKey;
  if (!type || !action) return 999;
  const key = `${type}/${action}`;
  if (key.startsWith("categories/")) return 1;
  if (key.startsWith("products/")) return 2;
  if (key.startsWith("customers/")) return 3;
  return 4; // transactions, stockAdjustments, vouchers, etc.
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
    // Restore queue from Dexie (async)
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
    // Immediately call with current status
    callback(this.getStatus());
    // Return unsubscribe function
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
      // Observe connectivity only; scheduled/manual sync triggers processing.
      const unsubscribe = offlineDetector.subscribe((offline) => {
        if (!offline && this.queue.length > 0) {
          console.log(
            "[MutationQueue] Online with pending queue; waiting for scheduled/manual sync",
          );
        }
      });

      // Fallback native event: log only.
      const onNativeOnline = () => {
        window.setTimeout(() => {
          checkOfflineStatus(true).then((offline) => {
            if (!offline && this.queue.length > 0) {
              console.log(
                "[MutationQueue] Native online with pending queue; waiting for scheduled/manual sync",
              );
            }
          });
        }, 400);
      };
      window.addEventListener("online", onNativeOnline);

      // Cleanup: unsubscribe detector and remove native listener
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
          `[MutationQueue] Restored ${records.length} queued mutations from Dexie`,
        );
        this.notifyStatusChange();
      }
      // Migration: if Dexie was empty, try legacy localStorage and migrate
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
              })),
            );
            localStorage.removeItem("kasipos-mutation-queue");
            return this.restoreQueue();
          }
        }
      }
      // Push to cloud runs on schedule (6h, 12h, 18h) and when the network comes back — not on every app open.
    } catch (error) {
      console.error("[MutationQueue] Failed to restore queue:", error);
    }
  }

  private sortQueueByDependencyOrder(): void {
    this.queue.sort((a, b) => {
      const pa = getMutationPriority(a);
      const pb = getMutationPriority(b);
      if (pa !== pb) return pa - pb;
      return a.timestamp - b.timestamp; // FIFO within same group
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
          })),
        );
      }
    } catch (error) {
      console.error("[MutationQueue] Failed to persist queue:", error);
    }
  }

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
    if (typeof window === "undefined") return;
    this.restorePromise?.then(() => {
      // Scheduled / reconnect sync only — see cloud sync scheduler and setupOnlineListener.
    });
  }

  add(
    mutation: Omit<QueuedMutation, "id" | "timestamp" | "retries" | "status">,
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
                    "",
                )
              : "")) === inferredKey,
      );
      if (hasDuplicate) {
        console.log(
          "[MutationQueue] Skipping duplicate transactions/create (same idempotency key)",
        );
        return;
      }
    }

    const mutationKeyStr = mutation.mutationKey.join("/");
    const variablesHash = hashVariables(mutation.variables);
    const isDuplicatePayload = this.queue.some(
      (m) =>
        m.mutationKey.join("/") === mutationKeyStr &&
        hashVariables(m.variables) === variablesHash,
    );
    if (isDuplicatePayload) {
      console.log(
        "[MutationQueue] Duplicate mutation skipped:",
        mutationKeyStr,
      );
      return;
    }

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: `mutation-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
      ...(inferredKey !== undefined && inferredKey !== ""
        ? { idempotencyKey: inferredKey }
        : {}),
    };

    this.queue.push(queuedMutation);
    void this.persistQueue();

    // Update status if not preloading
    if (this.currentStatus !== "preloading") {
      this.currentStatus = "idle";
    }
    this.notifyStatusChange();

    if (typeof window !== "undefined") {
      checkOfflineStatus().then((isOffline) => {
        if (isOffline) {
          console.log(
            "[MutationQueue] Offline - mutation queued for scheduled / reconnect sync",
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

    // Processing window runs online; restore offline-first in finally.
    offlineDetector.setOfflineFirstActive(false);

    if (!force && offlineDetector.getOfflineFirstActive()) {
      console.log(
        "[MutationQueue] Offline-first mode active - skipping queue processing",
      );
      return {
        initialPending,
        syncedCount,
        remainingPending: this.queue.length,
        stoppedReason: "offline_first_blocked",
      };
    }

    // Check if we're online before processing.
    // For forced sync windows, use a direct connectivity probe that bypasses offline-first gating.
    if (typeof window !== "undefined") {
      if (force) {
        const hasConnectivity = await offlineDetector.forceCheck();
        if (!hasConnectivity) {
          console.log(
            "[MutationQueue] No connectivity for forced sync - skipping queue processing",
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
            "[MutationQueue] Still offline - skipping queue processing",
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
      `[MutationQueue] Processing ${this.queue.length} queued mutations (sorted by dependency order)`,
    );
    this.notifyStatusChange();

    let stoppedReason: ProcessQueueResult["stoppedReason"] = "completed";
    try {
      while (this.queue.length > 0) {
        // Re-check online status before each mutation (using enhanced offline detection)
        if (typeof window !== "undefined") {
          const isOfflineStatus = isOffline(); // Use cached value for quick check
          if (isOfflineStatus) {
            // Verify with fresh check
            const verifiedOffline = await checkOfflineStatus(true);
            if (verifiedOffline) {
              console.log(
                "[MutationQueue] Went offline during processing - pausing",
              );
              this.currentStatus = "idle";
              this.currentMutation = null;
              this.notifyStatusChange();
              stoppedReason = "network_pause";
              break;
            }
          }
        }

        const mutation = this.queue[0];
        this.currentMutation = mutation;
        mutation.status = "syncing";
        this.notifyStatusChange();

        try {
          console.log(mutation.variables, mutation.mutationKey);
          await mutation.mutationFn();
          // Success - remove from queue
          mutation.status = "completed";
          this.queue.shift();
          syncedCount++;
          this.currentMutation = null;
          await this.persistQueue();
          console.log(
            `[MutationQueue] Successfully synced mutation: ${mutation.mutationKey.join("/")}`,
          );

          // Defer invalidation to avoid re-entering React/query updates during callback (prevents crashes)
          if (this.queryClient && mutation.mutationKey.length > 0) {
            const key = mutation.mutationKey[0];
            queueMicrotask(() => {
              this.queryClient?.invalidateQueries({
                queryKey: [key],
                refetchType: "all",
              });
            });
          }

          this.notifyStatusChange();
        } catch (error: any) {
          const status = error?.response?.status;
          const is5xx =
            typeof status === "number" && status >= 500 && status < 600;
          const isOfflineStatus = isOffline();
          const msg = (error?.message ?? "").toLowerCase();
          const isNetworkError =
            isOfflineStatus ||
            error?.code === "ECONNABORTED" ||
            error?.code === "ERR_CONNECTION_REFUSED" ||
            error?.message?.includes("Network Error") ||
            msg.includes("failed to fetch") ||
            msg.includes("load failed") ||
            msg.includes("connection refused") ||
            error?.isOffline ||
            error?.isNetworkError;

          if (isNetworkError) {
            console.log(
              "[MutationQueue] Network error - will retry when online",
            );
            mutation.status = "pending";
            this.currentMutation = null;
            this.currentStatus = "idle";
            this.notifyStatusChange();
            stoppedReason = "network_pause";
            break;
          }

          if (is5xx) {
            console.log("[MutationQueue] Server error (5xx) - will retry");
            mutation.status = "pending";
            this.currentMutation = null;
            this.currentStatus = "idle";
            this.notifyStatusChange();
            stoppedReason = "server_retry";
            break;
          }

          // Check if we should retry
          if (mutation.retries < MAX_RETRIES) {
            mutation.retries++;
            mutation.status = "pending";
            console.log(
              `[MutationQueue] Retrying mutation (attempt ${mutation.retries}/${MAX_RETRIES})`,
            );
            // Wait before retrying
            await new Promise((resolve) =>
              setTimeout(resolve, RETRY_DELAY * mutation.retries),
            );
            // Try again (mutation stays at front of queue)
          } else {
            // Max retries reached - remove from queue; show user-visible error
            mutation.status = "failed";
            const logId = genLogId();
            console.error(
              "[MutationQueue] Mutation failed after max retries:",
              mutation.mutationKey,
              error,
              logId,
            );
            const userMessage =
              error?.message ?? "Changes could not be synced to the server.";
            feedback.error(
              "Sync failed",
              userMessage,
              "Your data is saved locally. Check your connection and try again.",
              { logId, code: error?.code },
            );
            this.queue.shift();
            this.currentMutation = null;
            await this.persistQueue();
            this.notifyStatusChange();
          }
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
    void this.persistQueue();
  }

  getPendingCount() {
    return this.queue.length;
  }

  destroy() {
    if (typeof window !== "undefined" && this.onlineHandler) {
      // onlineHandler is now an unsubscribe function from offlineDetector
      if (typeof this.onlineHandler === "function") {
        this.onlineHandler();
      }
    }
  }
}

export const mutationQueue = new MutationQueue();
