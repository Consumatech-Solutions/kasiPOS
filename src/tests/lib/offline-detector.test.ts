import { describe, expect, it } from "vitest";
import { getCloudSyncUnavailableMessage } from "@/lib/offline-detector";

describe("offline-detector", () => {
  it("getCloudSyncUnavailableMessage explains browser offline state", () => {
    expect(getCloudSyncUnavailableMessage("browser_offline")).toContain(
      "offline"
    );
  });

  it("getCloudSyncUnavailableMessage explains server reachability failures", () => {
    expect(getCloudSyncUnavailableMessage("server_unreachable")).toContain(
      "Cannot reach the server"
    );
  });
});
