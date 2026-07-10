/** Map slider position 0–100 to target multiplier on a log scale (1.01 – max). */
export function sliderToTarget(slider: number, min: number, max: number): number {
  const t = Math.min(100, Math.max(0, slider)) / 100;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const value = Math.exp(logMin + t * (logMax - logMin));
  return Math.round(value * 100) / 100;
}

export function targetToSlider(target: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, target));
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const t = (Math.log(clamped) - logMin) / (logMax - logMin);
  return Math.round(t * 100);
}
