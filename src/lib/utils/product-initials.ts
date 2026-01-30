/**
 * Extracts 2 initials from a product name
 * @param name - The product name
 * @returns A string with 2 uppercase initials, or empty string if name is invalid
 */
export function getProductInitials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Remove extra whitespace and split by spaces
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) {
    return '';
  }

  // If single word, take first 2 characters
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  // If multiple words, take first character of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

