/**
 * Enhanced Offline Detection Utility
 *
 * Provides reliable offline detection by combining:
 * - navigator.onLine status
 * - Actual network connectivity tests
 * - Cached results to avoid excessive checks
 */

interface OfflineState {
  isOffline: boolean;
  lastChecked: number;
  isChecking: boolean;
}

const CACHE_DURATION = 5000; // Cache result for 5 seconds
const NETWORK_TEST_TIMEOUT = 3000; // 3 second timeout for network test
const NETWORK_TEST_URL = '/manifest.json'; // Small asset that returns 200 when app is up

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
  /** Dev only: when true, report offline so you can test without cutting the network */
  private forceOffline = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize with navigator.onLine
      this.state.isOffline = !navigator.onLine;
      
      // Listen to online/offline events
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
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

  /** Dev only: effective offline = forced offline (when dev) OR real offline */
  getEffectiveOffline(): boolean {
    if (this.forceOffline && isDevHost()) return true;
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

  /**
   * Check network connectivity with actual network request
   */
  private async checkConnectivity(force: boolean = false): Promise<boolean> {
    // Return cached result if still valid and not forcing
    const now = Date.now();
    if (!force && (now - this.state.lastChecked) < CACHE_DURATION) {
      return !this.state.isOffline;
    }

    // If already checking, return the existing promise
    if (this.checkPromise) {
      return this.checkPromise;
    }

    // Start new connectivity check
    this.checkPromise = (async () => {
      this.state.isChecking = true;

      try {
        // First check navigator.onLine (fast check)
        if (!navigator.onLine) {
          this.setState(true);
          return false;
        }

        // Perform actual network test with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), NETWORK_TEST_TIMEOUT);

        try {
          const response = await fetch(NETWORK_TEST_URL, {
            method: 'HEAD',
            cache: 'no-cache',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // If we get any response (even 404), we're online
          const isOnline = response.status !== 0;
          this.setState(!isOnline);
          return isOnline;
        } catch (error: any) {
          clearTimeout(timeoutId);

          // AbortError means timeout - treat as offline
          if (error.name === 'AbortError') {
            this.setState(true);
            return false;
          }

          // Network errors mean offline
          if (
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('NetworkError') ||
            error.code === 'ERR_NETWORK'
          ) {
            this.setState(true);
            return false;
          }

          // Other errors might mean we're online but resource doesn't exist
          // In that case, if navigator.onLine is true, assume we're online
          this.setState(!navigator.onLine);
          return navigator.onLine;
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
   * Cleanup - remove event listeners
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
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

