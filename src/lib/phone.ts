/** Strip non-digits from a phone input for API payloads. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}
