/** Sanitize free-text or keypad input into a decimal amount string (e.g. "150.50"). */
export function sanitizeTenderedInput(raw: string): string {
  const s = raw.replace(/[^\d.]/g, "");
  const dotIndex = s.indexOf(".");
  if (dotIndex === -1) return s;
  const intPart = s.slice(0, dotIndex);
  const fracPart = s.slice(dotIndex + 1).replace(/\./g, "");
  return `${intPart}.${fracPart}`;
}

/** Append a single keypad key to the current tendered amount. */
export function appendTenderedKey(current: string, key: string): string {
  if (key === ".") {
    if (current.includes(".")) return current;
    return sanitizeTenderedInput(current + ".");
  }
  return sanitizeTenderedInput(current + key);
}
