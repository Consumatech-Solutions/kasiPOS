export const RAWBT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter";

/** @deprecated WebSocket path kept for optional debugging on /print-test */
export const RAWBT_SERVER_WS_PORT = 40213;

export const RAWBT_SERVER_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=rawbt.server";

export const RAWBT_WS_TIMEOUT_MS = 8000;

export function encodeRawBtBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export function buildRawBtIntentUrl(data: Uint8Array): string {
  return `rawbt:base64,${encodeRawBtBase64(data)}`;
}

export function printViaRawBtIntent(data: Uint8Array): void {
  if (typeof window === "undefined") {
    throw new Error("RawBT printing is only available in the browser");
  }

  window.location.href = buildRawBtIntentUrl(data);
}

export async function printViaRawBt(data: Uint8Array): Promise<void> {
  printViaRawBtIntent(data);
}

export function getRawBtWebSocketUrl(host = "127.0.0.1"): string {
  return `ws://${host}:${RAWBT_SERVER_WS_PORT}/`;
}

export interface RawBtPrintOptions {
  host?: string;
  timeoutMs?: number;
}

/** Optional WebSocket path (Server for RawBT). Not used by default. */
export function printViaRawBtServer(
  data: Uint8Array,
  options: RawBtPrintOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("RawBT server printing is only available in the browser"));
      return;
    }

    const url = getRawBtWebSocketUrl(options.host ?? "127.0.0.1");
    const timeoutMs = options.timeoutMs ?? RAWBT_WS_TIMEOUT_MS;
    let settled = false;

    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      fn();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => {
        try {
          socket.close();
        } catch {
          // ignore close errors after timeout
        }
        reject(
          new Error(
            "Cannot connect to RawBT server. Install Server for RawBT, start the service, and try again."
          )
        );
      });
    }, timeoutMs);

    socket.onerror = () => {
      finish(() => {
        reject(
          new Error(
            "RawBT WebSocket error. Ensure Server for RawBT is running on this device."
          )
        );
      });
    };

    socket.onopen = () => {
      const payload = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
      socket.send(payload);
      finish(() => {
        socket.close(1000, "Work complete");
        resolve();
      });
    };
  });
}
