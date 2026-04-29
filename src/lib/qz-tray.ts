import qz from "qz-tray";

const QZ_PREFIX = "qz_";

export async function isQzTrayAvailable(): Promise<boolean> {
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    return true;
  } catch {
    return false;
  }
}

export async function getQzPrinters(): Promise<
  Array<{ id: string; name: string }>
> {
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    const printerNames = await qz.printers.find();
    const names = Array.isArray(printerNames) ? printerNames : [printerNames];
    return names
      .filter((n): n is string => typeof n === "string")
      .map((name) => ({
        id: `${QZ_PREFIX}${encodeURIComponent(name)}`,
        name,
      }));
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to get QZ printers";
    throw new Error(
      message.includes("connect") || message.includes("Connection")
        ? "Cannot connect to QZ Tray. Please ensure QZ Tray is installed and running."
        : message,
    );
  }
}

export async function printViaQz(
  deviceId: string,
  data: Uint8Array,
): Promise<void> {
  if (!deviceId.startsWith(QZ_PREFIX)) {
    throw new Error(`Invalid QZ device ID: ${deviceId}`);
  }
  const printerName = decodeURIComponent(deviceId.slice(QZ_PREFIX.length));
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    const config = qz.configs.create(printerName, {
      encoding: null,
    });
    const base64 = btoa(String.fromCharCode(...data));
    await qz.print(config, [
      {
        type: "raw",
        format: "command",
        flavor: "base64",
        data: base64,
      },
    ]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Print failed";
    throw new Error(
      message.includes("connect") || message.includes("Connection")
        ? "Cannot connect to QZ Tray. Please ensure QZ Tray is running."
        : message,
    );
  }
}

export { QZ_PREFIX };
