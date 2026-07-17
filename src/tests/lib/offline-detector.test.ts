/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("offline-detector", () => {
  it("getCloudSyncUnavailableMessage explains browser offline state", async () => {
    const { getCloudSyncUnavailableMessage } =
      await import("@/lib/offline-detector");
    expect(getCloudSyncUnavailableMessage("browser_offline")).toContain(
      "offline"
    );
  });

  it("getCloudSyncUnavailableMessage explains server reachability failures", async () => {
    const { getCloudSyncUnavailableMessage } =
      await import("@/lib/offline-detector");
    expect(getCloudSyncUnavailableMessage("server_unreachable")).toContain(
      "Cannot reach the server"
    );
  });

  describe("checkPromise lifecycle", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 200 }))
      );
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => true,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("forceCheck probes after an offline-first short-circuit and can run again", async () => {
      const { offlineDetector } = await import("@/lib/offline-detector");

      // Constructor runs checkConnectivity(false) with offline-first active.
      // Flush microtasks so checkPromise is cleared via promise.finally.
      await Promise.resolve();
      await Promise.resolve();

      expect(offlineDetector.getOfflineFirstActive()).toBe(true);

      const fetchMock = vi.mocked(globalThis.fetch);
      fetchMock.mockClear();

      const reachable = await offlineDetector.forceCheck({
        bypassThrottle: true,
      });
      expect(reachable).toBe(true);
      expect(fetchMock).toHaveBeenCalled();

      fetchMock.mockClear();
      const reachableAgain = await offlineDetector.forceCheck({
        bypassThrottle: true,
      });
      expect(reachableAgain).toBe(true);
      expect(fetchMock).toHaveBeenCalled();

      offlineDetector.destroy();
    });
  });
});
