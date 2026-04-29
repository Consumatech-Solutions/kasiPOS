interface OfflineState {
  isOffline: boolean;
  lastChecked: number;
  isChecking: boolean;
}

const CONNECTIVITY_CHECK_INTERVAL_MS = 10000;
const NETWORK_TEST_TIMEOUT = 5000;
const BACKEND_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:9002";

function isDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

class OfflineDetector {
  private state: OfflineState = {
    isOffline: false,
    lastChecked: 0,
    isChecking: false,
  };

  private checkPromise: Promise<boolean> | null = null;
  private listeners: Set<(isOffline: boolean) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private forceOffline = false;
  private offlineFirstActive =
    typeof window !== "undefined" &&
    Boolean((window as Window & { Cypress?: unknown }).Cypress)
      ? false
      : true;

  constructor() {
    if (typeof window !== "undefined") {
      this.state.isOffline = !navigator.onLine;

      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);

      this.checkConnectivity(false);
      this.intervalId = setInterval(() => {
        this.checkConnectivity(false);
      }, CONNECTIVITY_CHECK_INTERVAL_MS);
    }
  }

  private handleOnline = () => {
    this.setState(false);
    this.checkConnectivity(false)
      .then((isOnline) => {
        if (!isOnline) this.setState(true);
      })
      .catch(() => {
        this.setState(true);
      });
  };

  private handleOffline = () => {
    this.setState(true);
  };

  private setState(isOffline: boolean) {
    if (this.state.isOffline !== isOffline) {
      this.state.isOffline = isOffline;
      this.state.lastChecked = Date.now();
      this.notifyListeners();
    }
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

  private async checkConnectivity(
    force: boolean = false,
    bypassOfflineFirst: boolean = false,
  ): Promise<boolean> {
    if (this.checkPromise && !force) {
      return this.checkPromise;
    }

    this.checkPromise = (async () => {
      this.state.isChecking = true;

      try {
        if (this.forceOffline && isDevHost()) {
          this.setState(true);
          return false;
        }

        if (this.offlineFirstActive && !bypassOfflineFirst) {
          this.setState(true);
          return false;
        }

        if (!navigator.onLine) {
          this.setState(true);
          return false;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          NETWORK_TEST_TIMEOUT,
        );
        const url = BACKEND_URL.replace(/\/$/, "");

        try {
          const response = await fetch(url, {
            method: "HEAD",
            cache: "no-cache",
            signal: controller.signal,
            mode: "cors",
          });
          clearTimeout(timeoutId);
          const isOnline = response.status !== 0;
          this.setState(!isOnline);
          return isOnline;
        } catch {
          clearTimeout(timeoutId);
          this.setState(true);
          return false;
        }
      } finally {
        this.state.isChecking = false;
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

  async forceCheck(): Promise<boolean> {
    return await this.checkConnectivity(true, true);
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
