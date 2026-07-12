/** Light tap feedback on supported mobile browsers. */
export function hapticPulse(ms = 12): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate?.(ms);
}
