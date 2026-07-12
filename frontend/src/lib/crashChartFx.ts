/** Visual FX helpers for the crash chart canvas. */

import type { CrashPalette } from "./crashCurve";

export interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
}

export interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
}

export interface Comet {
  x: number;
  y: number;
  life: number;
  size: number;
}

export interface PulseRing {
  x: number;
  y: number;
  radius: number;
  life: number;
}

export function createStarfield(count: number, width: number, height: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    z: 0.2 + Math.random() * 0.8,
    size: 0.5 + Math.random() * 1.5,
  }));
}

export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  width: number,
  height: number,
  scroll: number,
): void {
  for (const star of stars) {
    const drift = (scroll * star.z * 0.35) % width;
    const x = ((star.x - drift) % width + width) % width;
    const twinkle = 0.35 + Math.sin((scroll + star.x) * 0.02) * 0.25;
    ctx.beginPath();
    ctx.arc(x, star.y, star.size * star.z, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 230, 255, ${twinkle * star.z})`;
    ctx.fill();
  }

  const nebula = ctx.createRadialGradient(
    width * 0.72,
    height * 0.28,
    0,
    width * 0.72,
    height * 0.28,
    width * 0.45,
  );
  nebula.addColorStop(0, `rgba(139, 92, 246, ${0.06 + scroll * 0.00001})`);
  nebula.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, width, height);
}

export function spawnSpeedStreaks(
  width: number,
  height: number,
  count: number,
): Streak[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    len: 20 + Math.random() * 60,
    speed: 2 + Math.random() * 6,
    opacity: 0.08 + Math.random() * 0.2,
  }));
}

export function drawSpeedStreaks(
  ctx: CanvasRenderingContext2D,
  streaks: Streak[],
  width: number,
  intensity: number,
  scroll: number,
): void {
  if (intensity <= 0) return;
  for (const s of streaks) {
    const x = ((s.x - scroll * s.speed) % width + width) % width;
    const grad = ctx.createLinearGradient(x, s.y, x - s.len, s.y);
    grad.addColorStop(0, `rgba(0, 255, 163, ${s.opacity * intensity})`);
    grad.addColorStop(1, "rgba(0, 255, 163, 0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, s.y);
    ctx.lineTo(x - s.len, s.y);
    ctx.stroke();
  }
}

export function spawnComet(x: number, y: number): Comet {
  return { x, y, life: 1, size: 2 + Math.random() * 2 };
}

export function stepComets(comets: Comet[]): Comet[] {
  const capped = comets.length > 10 ? comets.slice(-10) : comets;
  return capped
    .map((c) => ({ ...c, life: c.life - 0.055 }))
    .filter((c) => c.life > 0);
}

export function drawComets(ctx: CanvasRenderingContext2D, comets: Comet[], color: string): void {
  for (const c of comets) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size * c.life, 0, Math.PI * 2);
    ctx.fillStyle = color.replace(/[\d.]+\)$/, `${c.life * 0.6})`);
    ctx.fill();
  }
}

export function spawnPulseRing(x: number, y: number): PulseRing {
  return { x, y, radius: 8, life: 1 };
}

export function stepPulseRings(rings: PulseRing[]): PulseRing[] {
  const capped = rings.length > 4 ? rings.slice(-4) : rings;
  return capped
    .map((r) => ({ ...r, radius: r.radius + 1.6, life: r.life - 0.045 }))
    .filter((r) => r.life > 0);
}

export function drawPulseRings(
  ctx: CanvasRenderingContext2D,
  rings: PulseRing[],
  color: string,
): void {
  for (const r of rings) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${r.life * 0.35})`);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** SolPump-style rocket — clean silhouette with subtle flame flicker. */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  palette: CrashPalette,
  thrust: number,
  frame = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const flicker = 0.85 + Math.sin(frame * 0.35) * 0.15;
  const flameLen = (12 + thrust * 14) * flicker;
  const flameGrad = ctx.createLinearGradient(-flameLen, 0, 6, 0);
  flameGrad.addColorStop(0, "rgba(255, 90, 40, 0)");
  flameGrad.addColorStop(0.4, `rgba(255, 140, 50, ${0.35 + thrust * 0.25})`);
  flameGrad.addColorStop(0.75, `rgba(0, 255, 163, ${0.55 + thrust * 0.25})`);
  flameGrad.addColorStop(1, palette.head);
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-2 - flameLen, -3.5 - thrust * 2.5);
  ctx.lineTo(-2 - flameLen * 0.65, 0);
  ctx.lineTo(-2 - flameLen, 3.5 + thrust * 2.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -5.5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.head;
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-1, -3);
  ctx.lineTo(1, 0);
  ctx.lineTo(-1, 3);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(1, 0, 2.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/** Stake-style crack burst at crash point. */
export function drawCrashCrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  life: number,
): void {
  if (life <= 0) return;
  const alpha = life * 0.9;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(255, 80, 100, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const rays = 6;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.2;
    const len = 18 + (1 - life) * 28;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawVignetteGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: CrashPalette,
  intensity: number,
): void {
  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.85,
    0,
    width * 0.5,
    height * 0.5,
    width * 0.75,
  );
  glow.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, `${0.12 * intensity})`));
  glow.addColorStop(0.5, palette.glow.replace(/[\d.]+\)$/, `${0.04 * intensity})`));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

export function speedIntensity(multiplier: number): number {
  return Math.min(1, Math.max(0, (multiplier - 1.4) / 8));
}
