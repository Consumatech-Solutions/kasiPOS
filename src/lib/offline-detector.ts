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
const OFFLINE_FIRST_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour - check connectivity to allow sync
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
  private hourlyIntervalId: ReturnType<typeof setInterval> | null = null;
  /** Dev only: when true, report offline so you can test without cutting the network */
  private forceOffline = false;
  /** When true, app reports offline (offline-first mode) until hourly check or force sync clears it */
  private offlineFirstActive = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Initial state; first check will run immediately via interval
      this.state.isOffline = !navigator.onLine;

      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      // Run connectivity check every 10 seconds (backend reachability)
      this.checkConnectivity(true);
      this.intervalId = setInterval(() => {
        this.checkConnectivity(true);
      }, CONNECTIVITY_CHECK_INTERVAL_MS);

      // Hourly check: if online, clear offline-first mode so sync can run (no error if offline)
      this.hourlyIntervalId = setInterval(() => {
        this.checkConnectivity(true).then((isOnline) => {
          if (isOnline) {
            this.setOfflineFirstActive(false);
            this.notifyListeners();
          }
        }).catch(() => {
          // No connection - do nothing, no error
        });
      }, OFFLINE_FIRST_CHECK_INTERVAL_MS);
    }
  }

  private handleOnline = () => {
    // Notify "online" immediately so UI and mutation queue can sync without waiting for the check
    this.setState(false);
    // Then verify with network test; if it fails, revert to offline
    this.checkConnectivity(true).then((isOnline) => {
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

  /** Effective offline = dev force OR network offline OR offline-first mode */
  getEffectiveOffline(): boolean {
    if (this.forceOffline && isDevHost()) return true;
    if (this.offlineFirstActive) return true;
    return this.state.isOffline;
  }

  getOfflineFirstActive(): boolean {
    return this.offlineFirstActive;
  }

  setOfflineFirstActive(value: boolean): void {
    if (this.offlineFirstActive === value) return;
    this.offlineFirstActive = value;
    this.notifyListeners();
  }

  /**
   * Try to sync now: check connectivity; if online, clear offline-first mode and notify (sync runs).
   * Returns true if online, false otherwise (UI can show "No connection").
   */
  async trySyncNow(): Promise<boolean> {
    const isOnline = await this.forceCheck();
    if (isOnline) {
      this.setOfflineFirstActive(false);
      this.notifyListeners();
      return true;
    }
    return false;
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

  /**
   * Check connectivity by calling the backend URL. If the backend cannot be
   * reached, we are considered offline.
   */
  private async checkConnectivity(force: boolean = false): Promise<boolean> {
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
   * Returns true when offline: dev force, offline-first mode, or backend unreachable.
   * When offline-first is active (sync not yet triggered), we report offline so the
   * mutation queue does not process even if the device is online.
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
    return await this.checkConnectivity(true);
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
      if (this.hourlyIntervalId != null) {
        clearInterval(this.hourlyIntervalId);
        this.hourlyIntervalId = null;
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

