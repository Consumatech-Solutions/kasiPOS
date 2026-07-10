interface OfflineState {
  isOffline: boolean;
  lastChecked: number;
  isChecking: boolean;
}

const CONNECTIVITY_CHECK_INTERVAL_MS = 30000;
const NETWORK_TEST_TIMEOUT = 5000;
/** Minimum time between real HEAD probes to the API origin. */
const MIN_HEAD_PROBE_INTERVAL_MS = 15000;

import { getConfiguredApiUrl } from "@/lib/api/resolve-api-base-url";

const BACKEND_URL = getConfiguredApiUrl();

function isDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

type BackendReachabilityListener = (reachable: boolean) => void;

class OfflineDetector {
  private state: OfflineState = {
    isOffline: false,
    lastChecked: 0,
    isChecking: false,
  };

  private checkPromise: Promise<boolean> | null = null;
  private listeners: Set<(isOffline: boolean) => void> = new Set();
  private reachabilityListeners: Set<BackendReachabilityListener> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private forceOffline = false;
  private offlineFirstActive =
    typeof window !== "undefined" &&
    Boolean((window as Window & { Cypress?: unknown }).Cypress)
      ? false
      : true;

  private lastBackendReachable: boolean | null = null;
  private lastHeadProbeAt = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.state.isOffline = !navigator.onLine;

      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);

      void this.checkConnectivity(false);
      this.intervalId = setInterval(() => {
        void this.checkConnectivity(false);
      }, CONNECTIVITY_CHECK_INTERVAL_MS);
    }
  }

  private handleOnline = () => {
    this.setState(false);
    void this.checkConnectivity(false, false, { bypassThrottle: true }).then(
      (isOnline) => {
        if (!isOnline) this.setState(true);
      }
    );
  };

  private handleOffline = () => {
    this.setState(true);
    this.setBackendReachability(false);
  };

  private setState(isOffline: boolean) {
    if (this.state.isOffline !== isOffline) {
      this.state.isOffline = isOffline;
      this.state.lastChecked = Date.now();
      this.notifyListeners();
    }
  }

  private setBackendReachability(reachable: boolean) {
    if (this.lastBackendReachable === reachable) return;
    this.lastBackendReachable = reachable;
    this.reachabilityListeners.forEach((listener) => listener(reachable));
  }

  private notifyListeners() {
    const effective = this.getEffectiveOffline();
    this.listeners.forEach((listener) => listener(effective));
  }

  getEffectiveOffline(): boolean {
    if (this.forceOffline && isDevHost()) return true;
    if (this.offlineFirstActive) return true;
    return this.state.isOffline;
  }

  getLastBackendReachable(): boolean {
    return this.lastBackendReachable ?? false;
  }

  isDevHost(): boolean {
    return isDevHost();
  }

  getForceOffline(): boolean {
    return this.forceOffline;
  }

  setForceOffline(value: boolean) {
    if (!isDevHost()) return;
    if (this.forceOffline === value) return;
    this.forceOffline = value;
    this.notifyListeners();
  }

  setOfflineFirstActive(value: boolean) {
    if (this.offlineFirstActive === value) return;
    this.offlineFirstActive = value;
    this.notifyListeners();
  }

  getOfflineFirstActive(): boolean {
    return this.offlineFirstActive;
  }

  subscribeToBackendReachability(
    callback: BackendReachabilityListener
  ): () => void {
    this.reachabilityListeners.add(callback);
    callback(this.getLastBackendReachable());
    return () => {
      this.reachabilityListeners.delete(callback);
    };
  }

  private shouldThrottleHeadProbe(bypassThrottle: boolean): boolean {
    if (bypassThrottle) return false;
    if (this.lastBackendReachable == null) return false;
    return Date.now() - this.lastHeadProbeAt < MIN_HEAD_PROBE_INTERVAL_MS;
  }

  private async checkConnectivity(
    force: boolean = false,
    bypassOfflineFirst: boolean = false,
    options?: { bypassThrottle?: boolean }
  ): Promise<boolean> {
    if (this.checkPromise) {
      return this.checkPromise;
    }

    const bypassThrottle = options?.bypassThrottle === true;

    if (this.shouldThrottleHeadProbe(bypassThrottle)) {
      return this.lastBackendReachable ?? false;
    }

    this.checkPromise = (async () => {
      this.state.isChecking = true;

      try {
        if (this.forceOffline && isDevHost()) {
          this.setState(true);
          this.setBackendReachability(false);
          return false;
        }

        if (this.offlineFirstActive && !bypassOfflineFirst) {
          this.setState(true);
          return false;
        }

        if (!navigator.onLine) {
          this.setState(true);
          this.setBackendReachability(false);
          return false;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          NETWORK_TEST_TIMEOUT
        );
        const url = BACKEND_URL.replace(/\/$/, "");

        try {
          this.lastHeadProbeAt = Date.now();
          const response = await fetch(url, {
            method: "HEAD",
            cache: "no-cache",
            signal: controller.signal,
            mode: "cors",
          });
          clearTimeout(timeoutId);
          const isOnline = response.status !== 0;
          this.setState(!isOnline);
          this.setBackendReachability(isOnline);
          return isOnline;
        } catch {
          clearTimeout(timeoutId);
          this.setState(true);
          this.setBackendReachability(false);
          return false;
        }
      } finally {
        this.state.isChecking = false;
        this.state.lastChecked = Date.now();
        this.checkPromise = null;
      }
    })();

    return this.checkPromise;
  }

  isOffline(): boolean {
    return this.getEffectiveOffline();
  }

  async checkOfflineStatus(force: boolean = false): Promise<boolean> {
    if (this.forceOffline && isDevHost()) return true;
    if (this.offlineFirstActive) return true;
    return !(await this.checkConnectivity(force));
  }

  subscribe(callback: (isOffline: boolean) => void): () => void {
    this.listeners.add(callback);
    callback(this.getEffectiveOffline());
    return () => {
      this.listeners.delete(callback);
    };
  }

  async forceCheck(options?: { bypassThrottle?: boolean }): Promise<boolean> {
    return await this.checkConnectivity(true, true, options);
  }

  destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
      if (this.intervalId != null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    this.listeners.clear();
    this.reachabilityListeners.clear();
  }
}

export const offlineDetector = new OfflineDetector();

function installE2eOfflineHarnessBridge(): void {
  if (typeof window === "undefined" || !isDevHost()) return;
  try {
    if (window.localStorage.getItem("__kasi_pos_e2e") !== "1") return;
  } catch {
    return;
  }
  const win = window as Window & {
    __KASI_POS_E2E_OFFLINE?: (forcedOffline: boolean) => void;
  };
  win.__KASI_POS_E2E_OFFLINE = (forcedOffline: boolean) => {
    offlineDetector.setOfflineFirstActive(forcedOffline);
    offlineDetector.setForceOffline(forcedOffline);
  };
}

installE2eOfflineHarnessBridge();

export function isOffline(): boolean {
  return offlineDetector.isOffline();
}

export async function checkOfflineStatus(force?: boolean): Promise<boolean> {
  return await offlineDetector.checkOfflineStatus(force);
}
