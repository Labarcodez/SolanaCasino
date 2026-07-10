export interface CrashColorStop {
  stroke: string;
  glow: string;
  fillTop: string;
}

export function getCrashColors(multiplier: number, crashed: boolean): CrashColorStop {
  if (crashed) {
    return {
      stroke: "rgba(255, 59, 92, 0.9)",
      glow: "rgba(255, 59, 92, 0.6)",
      fillTop: "rgba(255, 59, 92, 0.18)",
    };
  }
  if (multiplier >= 10) {
    return {
      stroke: "rgba(234, 179, 8, 0.95)",
      glow: "rgba(234, 179, 8, 0.55)",
      fillTop: "rgba(234, 179, 8, 0.14)",
    };
  }
  if (multiplier >= 5) {
    return {
      stroke: "rgba(168, 85, 247, 0.95)",
      glow: "rgba(168, 85, 247, 0.5)",
      fillTop: "rgba(168, 85, 247, 0.14)",
    };
  }
  if (multiplier >= 2) {
    return {
      stroke: "rgba(34, 197, 94, 0.95)",
      glow: "rgba(34, 197, 94, 0.5)",
      fillTop: "rgba(34, 197, 94, 0.12)",
    };
  }
  return {
    stroke: "rgba(59, 130, 246, 0.95)",
    glow: "rgba(59, 130, 246, 0.5)",
    fillTop: "rgba(59, 130, 246, 0.12)",
  };
}
