/**
 * Platform detection for print strategy (Desktop vs Android).
 * Used by printer onboarding to show the right options and download links.
 */

export type PrintStrategy = 'desktop' | 'android';

/**
 * Detect if the current environment is Android (browser on Android device).
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return true;
  // Optional: User-Agent Client Hints if available
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  if (nav.userAgentData?.platform?.toLowerCase() === 'android') return true;
  return false;
}

/**
 * Return the print strategy for the current platform.
 * Used to switch between QZ Tray (desktop) and RawBT/Intent (Android) in the UI.
 */
export function getPrintStrategy(): PrintStrategy {
  return isAndroid() ? 'android' : 'desktop';
}
