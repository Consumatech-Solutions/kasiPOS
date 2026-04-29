/**
 * Extracts 2 initials from a product name
 * @param name - The product name
 * @returns A string with 2 uppercase initials, or empty string if name is invalid
 */
export function getProductInitials(name: string | null | undefined): string {
  if (!name || typeof name !== "string") {
    return "";
  }

  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}
