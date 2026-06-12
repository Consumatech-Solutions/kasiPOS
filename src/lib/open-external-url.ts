export function openExternalUrl(url: string): void {
  globalThis.open(url, "_blank", "noopener,noreferrer");
}
