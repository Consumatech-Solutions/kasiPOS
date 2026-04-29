export type PrintStrategy = "desktop" | "android";

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return true;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  if (nav.userAgentData?.platform?.toLowerCase() === "android") return true;
  return false;
}

export function getPrintStrategy(): PrintStrategy {
  return isAndroid() ? "android" : "desktop";
}
