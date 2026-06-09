export const MAX_BROWSER_VIOLATIONS = 3;

export function buildViolationAlert({ count, isFullscreen, isTabVisible }) {
  const messages = [];

  if (!isFullscreen) {
    messages.push("Tam ekran modundan çıkıldı. Lütfen yeniden tam ekrana dönün.");
  }

  if (!isTabVisible) {
    messages.push("Sekme değişimi algılandı.");
  }

  return {
    count: Math.min(count, MAX_BROWSER_VIOLATIONS),
    terminating: count >= MAX_BROWSER_VIOLATIONS,
    messages,
  };
}
