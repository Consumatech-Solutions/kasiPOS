/**
 * Offline Detection Utility
 *
 * Determines connectivity by calling the backend URL. If the backend cannot be
 * reached, the app is considered offline. Runs a connectivity check every 10s.
 */

interface OfflineState {
  isOffline: boolean;
  lastChecked: number;
  isChecking: boolean;
}

const CONNECTIVITY_CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const NETWORK_TEST_TIMEOUT = 5000; // Timeout for backend reachability
const BACKEND_URL = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : 'http://localhost:3000';

function isDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
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
  /** Dev only: when true, report offline so you can test without cutting the network */
  private forceOffline = false;
  /** Runtime flag: when true, app behaves offline-first even with network connectivity */
  private offlineFirstActive = true;

  constructor() {
    if (typeof window !== 'undefined') {
      // Initial state; first check will run immediately via interval
      this.state.isOffline = !navigator.onLine;

      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      // Run connectivity checks only when runtime is allowed online.
      this.checkConnectivity(false);
      this.intervalId = setInterval(() => {
        this.checkConnectivity(false);
      }, CONNECTIVITY_CHECK_INTERVAL_MS);
    }
  }

  private handleOnline = () => {
    // Notify "online" immediately so UI and mutation queue can sync without waiting for the check
    this.setState(false);
    // Then verify with network test; if it fails, revert to offline
    this.checkConnectivity(false).then((isOnline) => {
      if (!isOnline) this.setState(true);
    }).catch(() => {
      this.setState(true);
    });
  };

  private handleOffline = () => {
    // When navigator says we're offline, we can trust it immediately
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
    this.listeners.forEach(listener => listener(effective));
  }

  /** Dev only: effective offline = forced offline (when dev) OR real offline */
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

  /**
   * Check connectivity by calling the backend URL. If the backend cannot be
   * reached, we are considered offline.
   */
  private async checkConnectivity(force: boolean = false, bypassOfflineFirst: boolean = false): Promise<boolean> {
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

        // In offline-first runtime, avoid backend probes unless explicitly bypassed
        // by scheduled/manual sync windows.
        if (this.offlineFirstActive && !bypassOfflineFirst) {
          this.setState(true);
          return false;
        }

        if (!navigator.onLine) {
          this.setState(true);
          return false;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), NETWORK_TEST_TIMEOUT);
        const url = BACKEND_URL.replace(/\/$/, '');

        try {
          const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-cache',
            signal: controller.signal,
            mode: 'cors',
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

  /**
   * Get current offline status (synchronous, uses cached value).
   * In dev, includes "simulate offline" override.
   */
  isOffline(): boolean {
    return this.getEffectiveOffline();
  }

  /**
   * Get current offline status (asynchronous, performs fresh check if needed).
   * In dev with simulate offline, returns true without hitting the network.
   */
  async checkOfflineStatus(force: boolean = false): Promise<boolean> {
    if (this.forceOffline && isDevHost()) return true;
    if (this.offlineFirstActive) return true;
    return !(await this.checkConnectivity(force));
  }

  /**
   * Subscribe to offline status changes (effective status, including dev simulate)
   */
  subscribe(callback: (isOffline: boolean) => void): () => void {
    this.listeners.add(callback);
    callback(this.getEffectiveOffline());
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Force a fresh connectivity check
   */
  async forceCheck(): Promise<boolean> {
    return await this.checkConnectivity(true, true);
  }

  /**
   * Cleanup - remove event listeners and stop periodic check
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      if (this.intervalId != null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const offlineDetector = new OfflineDetector();

// Export convenience functions
export function isOffline(): boolean {
  return offlineDetector.isOffline();
}

export async function checkOfflineStatus(force?: boolean): Promise<boolean> {
  return await offlineDetector.checkOfflineStatus(force);
}

