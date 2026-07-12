/** Shared crash curve math — log Y scale; growth matches backend `crash.ts`. */

/** Bustabit-style exponential rate (1/ms). Keep in sync with backend crash.ts / crashKeeper.ts. */
export const CRASH_GROWTH_RATE = 0.00008;

/** Same formula as backend `multiplierAtElapsedMs`. */
export function multiplierAtElapsedMs(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  return Math.min(Math.exp(CRASH_GROWTH_RATE * t), 1000);
}

export interface CrashPalette {
  stroke: string;
  glow: string;
  fillTop: string;
  head: string;
}

const COLOR_STOPS: { at: number; palette: CrashPalette }[] = [
  {
    at: 1,
    palette: {
      stroke: "rgba(59, 130, 246, 0.95)",
      glow: "rgba(59, 130, 246, 0.45)",
      fillTop: "rgba(59, 130, 246, 0.14)",
      head: "rgba(96, 165, 250, 1)",
    },
  },
  {
    at: 2,
    palette: {
      stroke: "rgba(0, 255, 163, 0.95)",
      glow: "rgba(0, 255, 163, 0.5)",
      fillTop: "rgba(0, 255, 163, 0.12)",
      head: "rgba(0, 255, 163, 1)",
    },
  },
  {
    at: 5,
    palette: {
      stroke: "rgba(168, 85, 247, 0.95)",
      glow: "rgba(168, 85, 247, 0.5)",
      fillTop: "rgba(168, 85, 247, 0.14)",
      head: "rgba(192, 132, 252, 1)",
    },
  },
  {
    at: 10,
    palette: {
      stroke: "rgba(251, 191, 36, 0.95)",
      glow: "rgba(251, 191, 36, 0.55)",
      fillTop: "rgba(251, 191, 36, 0.14)",
      head: "rgba(252, 211, 77, 1)",
    },
  },
];

const CRASH_PALETTE: CrashPalette = {
  stroke: "rgba(255, 59, 92, 0.95)",
  glow: "rgba(255, 59, 92, 0.65)",
  fillTop: "rgba(255, 59, 92, 0.2)",
  head: "rgba(255, 120, 140, 1)",
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle interpolation for smooth rocket rotation. */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/** Interpolate elapsed ms between server ticks for 60fps-smooth curve motion. */
export function interpolateElapsedMs(
  serverElapsedMs: number,
  lastServerTickPerf: number,
  maxDriftMs = 120,
): number {
  const extrapolated =
    serverElapsedMs + Math.max(0, performance.now() - lastServerTickPerf);
  return Math.min(
    extrapolated,
    serverElapsedMs + maxDriftMs,
  );
}

function parseRgba(color: string): [number, number, number, number] {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return [255, 255, 255, 1];
  const parts = m[1].split(",").map((v) => Number.parseFloat(v.trim()));
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function mixColor(a: string, b: string, t: number): string {
  const [r1, g1, b1, a1] = parseRgba(a);
  const [r2, g2, b2, a2] = parseRgba(b);
  return `rgba(${Math.round(lerp(r1, r2, t))}, ${Math.round(lerp(g1, g2, t))}, ${Math.round(lerp(b1, b2, t))}, ${lerp(a1, a2, t).toFixed(3)})`;
}

function mixPalette(a: CrashPalette, b: CrashPalette, t: number): CrashPalette {
  return {
    stroke: mixColor(a.stroke, b.stroke, t),
    glow: mixColor(a.glow, b.glow, t),
    fillTop: mixColor(a.fillTop, b.fillTop, t),
    head: mixColor(a.head, b.head, t),
  };
}

export function getCrashPalette(multiplier: number, crashed: boolean): CrashPalette {
  if (crashed) return CRASH_PALETTE;

  const mult = Math.max(1, multiplier);
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const left = COLOR_STOPS[i];
    const right = COLOR_STOPS[i + 1];
    if (mult <= right.at) {
      const t = (mult - left.at) / (right.at - left.at);
      return mixPalette(left.palette, right.palette, Math.max(0, Math.min(1, t)));
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].palette;
}

/** Map multiplier to canvas Y using log scale. */
export function multiplierToY(
  multiplier: number,
  maxMultiplier: number,
  chartHeight: number,
  padding: number,
): number {
  const minMult = 1;
  const maxMult = Math.max(minMult + 0.01, maxMultiplier);
  const clamped = Math.max(minMult, Math.min(multiplier, maxMult));
  const t =
    (Math.log(clamped) - Math.log(minMult)) /
    (Math.log(maxMult) - Math.log(minMult));
  return chartHeight - padding - t * (chartHeight - padding * 2);
}

export function computeViewportMax(
  current: number,
  previous: number,
  floor = 2.5,
): number {
  const minViewport = Math.max(floor, 2);
  const safePrevious = Math.max(previous, minViewport);
  // Expand only when the rocket nears the top — avoids per-frame Y rescaling that warps the trail.
  if (current < safePrevious * 0.78) return safePrevious;
  const headroom = Math.max(minViewport, current * 1.28);
  return Math.max(safePrevious, headroom);
}

/** Horizontal time window — curve grows right without compressing older points. */
export function computeTimeWindow(elapsedMs: number, minMs = 5000): number {
  return Math.max(minMs, elapsedMs * 1.08);
}

/** Build a smooth quadratic-bezier path through trail samples. */
export function traceSmoothCurve(
  ctx: CanvasRenderingContext2D,
  points: TrailPoint[],
  toX: (p: TrailPoint) => number,
  toY: (mult: number) => number,
): void {
  if (points.length < 2) return;

  const first = points[0];
  ctx.moveTo(toX(first), toY(first.mult));

  if (points.length === 2) {
    const second = points[1];
    ctx.lineTo(toX(second), toY(second.mult));
    return;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (toX(curr) + toX(next)) / 2;
    const midY = (toY(curr.mult) + toY(next.mult)) / 2;
    ctx.quadraticCurveTo(toX(curr), toY(curr.mult), midX, midY);
  }

  const last = points[points.length - 1];
  ctx.lineTo(toX(last), toY(last.mult));
}

export function elapsedToX(
  elapsedMs: number,
  timeWindowMs: number,
  chartWidth: number,
  padding: number,
): number {
  const chartW = chartWidth - padding * 2;
  const t = Math.max(0, Math.min(1, elapsedMs / Math.max(timeWindowMs, 1)));
  return padding + t * chartW;
}

export interface TrailPoint {
  mult: number;
  elapsedMs: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export function spawnCrashParticles(x: number, y: number, count = 24): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 0.85 + Math.random() * 0.15,
      size: 2 + Math.random() * 4,
    };
  });
}

export function stepParticles(particles: Particle[]): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.12,
      life: p.life - 0.025,
    }))
    .filter((p) => p.life > 0);
}
