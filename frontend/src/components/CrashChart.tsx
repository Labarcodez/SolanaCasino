import { useEffect, useRef } from "react";
import type { CrashPhase } from "../hooks/useSocket";
import {
  createStarfield,
  drawComets,
  drawPulseRings,
  drawRocket,
  drawSpeedStreaks,
  drawStarfield,
  drawVignetteGlow,
  spawnComet,
  spawnPulseRing,
  spawnSpeedStreaks,
  speedIntensity,
  stepComets,
  stepPulseRings,
  type Comet,
  type PulseRing,
  type Star,
  type Streak,
} from "../lib/crashChartFx";
import {
  computeTimeWindow,
  computeViewportMax,
  elapsedToX,
  getCrashPalette,
  multiplierAtElapsedMs,
  multiplierToY,
  spawnCrashParticles,
  stepParticles,
  type TrailPoint,
} from "../lib/crashCurve";

interface CrashChartProps {
  multiplier: number;
  phase: CrashPhase;
  crashPoint?: number;
  startedAt?: number;
}

interface ChartEngine {
  targetMult: number;
  displayMult: number;
  viewportMax: number;
  phase: CrashPhase;
  crashPoint: number;
  startedAt: number;
  trail: TrailPoint[];
  particles: ReturnType<typeof spawnCrashParticles>;
  crashFlash: number;
  lastPhase: CrashPhase;
  pendingBurst: boolean;
  frozenTimeWindow: number;
  stars: Star[];
  streaks: Streak[];
  comets: Comet[];
  pulseRings: PulseRing[];
  scrollTime: number;
  lastPulseAt: number;
  frame: number;
}

const PAD = 28;

export function CrashChart({
  multiplier,
  phase,
  crashPoint,
  startedAt,
}: CrashChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sublabelRef = useRef<HTMLParagraphElement>(null);
  const engineRef = useRef<ChartEngine>({
    targetMult: 1,
    displayMult: 1,
    viewportMax: 2.5,
    phase: "betting",
    crashPoint: 1,
    startedAt: 0,
    trail: [],
    particles: [],
    crashFlash: 0,
    lastPhase: "betting",
    pendingBurst: false,
    frozenTimeWindow: 4500,
    stars: [],
    streaks: [],
    comets: [],
    pulseRings: [],
    scrollTime: 0,
    lastPulseAt: 0,
    frame: 0,
  });

  useEffect(() => {
    const engine = engineRef.current;
    engine.targetMult = multiplier;
    engine.phase = phase;
    engine.crashPoint = crashPoint ?? multiplier;
    if (startedAt) engine.startedAt = startedAt;

    if (phase === "running" && engine.lastPhase !== "running") {
      engine.trail = [{ mult: 1, elapsedMs: 0 }];
      engine.displayMult = 1;
      engine.viewportMax = 2.5;
      engine.startedAt = startedAt ?? Date.now();
      engine.comets = [];
      engine.pulseRings = [];
      engine.scrollTime = 0;
    }

    if (phase === "betting" || phase === "cooldown") {
      engine.trail = [];
      engine.particles = [];
      engine.comets = [];
      engine.pulseRings = [];
      engine.displayMult = 1;
      engine.viewportMax = 2.5;
      engine.crashFlash = 0;
      engine.frozenTimeWindow = 4500;
    }

    if (phase === "crashed" && engine.lastPhase !== "crashed") {
      engine.crashFlash = 1;
      engine.pendingBurst = true;
      engine.displayMult = engine.crashPoint;
      const last = engine.trail[engine.trail.length - 1];
      if (last) {
        engine.frozenTimeWindow = computeTimeWindow(last.elapsedMs);
      }
    }

    engine.lastPhase = phase;
  }, [multiplier, phase, crashPoint, startedAt]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const engine = engineRef.current;
      engine.stars = createStarfield(90, width, height);
      engine.streaks = spawnSpeedStreaks(width, height, 28);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const drawGrid = (timeWindow: number) => {
      const engine = engineRef.current;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
      ctx.lineWidth = 1;
      ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.3)";

      const lines = 5;
      for (let i = 0; i <= lines; i++) {
        const y = PAD + ((height - PAD * 2) * i) / lines;
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(width - PAD, y);
        ctx.stroke();

        const labelMult =
          1 + ((engine.viewportMax - 1) * (lines - i)) / lines;
        ctx.fillText(`${labelMult.toFixed(1)}x`, PAD + 6, y - 5);
      }

      ctx.strokeStyle = "rgba(139, 92, 246, 0.05)";
      const cols = 6;
      for (let i = 0; i <= cols; i++) {
        const x = PAD + ((width - PAD * 2) * i) / cols;
        ctx.beginPath();
        ctx.moveTo(x, PAD);
        ctx.lineTo(x, height - PAD);
        ctx.stroke();
      }

      if (engine.phase === "running" && engine.trail.length > 1) {
        const elapsed =
          engine.trail[engine.trail.length - 1]?.elapsedMs ?? 0;
        const scrollX = elapsedToX(elapsed, timeWindow, width, PAD) - PAD;
        if (scrollX > width * 0.55) {
          ctx.strokeStyle = "rgba(0, 255, 163, 0.05)";
          ctx.setLineDash([4, 8]);
          const originX = PAD - (scrollX - width * 0.55);
          ctx.beginPath();
          ctx.moveTo(originX, PAD);
          ctx.lineTo(originX, height - PAD);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };

    const drawBackground = (palette: ReturnType<typeof getCrashPalette>) => {
      const engine = engineRef.current;
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "rgba(8, 6, 18, 0.98)");
      bg.addColorStop(0.55, "rgba(6, 7, 11, 0.96)");
      bg.addColorStop(1, "rgba(4, 5, 9, 0.99)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      drawStarfield(ctx, engine.stars, width, height, engine.scrollTime);

      if (engine.phase === "running") {
        const intensity = speedIntensity(engine.displayMult);
        drawSpeedStreaks(ctx, engine.streaks, width, intensity, engine.scrollTime);
        drawVignetteGlow(ctx, width, height, palette, 0.5 + intensity * 0.8);
      }

      if (engine.crashFlash > 0) {
        ctx.fillStyle = `rgba(255, 59, 92, ${engine.crashFlash * 0.28})`;
        ctx.fillRect(0, 0, width, height);
        engine.crashFlash = Math.max(0, engine.crashFlash - 0.04);
      }
    };

    const drawBettingIdle = () => {
      const y = multiplierToY(1, 2.5, height, PAD);
      const pulse = 0.35 + Math.sin(performance.now() / 400) * 0.15;
      ctx.strokeStyle = `rgba(59, 130, 246, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(width - PAD, y);
      ctx.stroke();
      ctx.setLineDash([]);

      const pad = 0.5 + Math.sin(performance.now() / 600) * 0.2;
      ctx.font = "28px serif";
      ctx.fillStyle = `rgba(148, 163, 184, ${pad})`;
      ctx.fillText("🚀", width * 0.5 - 14, y - 18);
    };

    const drawCurve = (timeWindow: number): { headX: number; headY: number; angle: number } | null => {
      const engine = engineRef.current;
      const palette = getCrashPalette(
        engine.displayMult,
        engine.phase === "crashed",
      );
      const pts = engine.trail;
      if (pts.length < 2) return null;

      const toX = (point: TrailPoint) =>
        elapsedToX(point.elapsedMs, timeWindow, width, PAD);
      const toY = (mult: number) =>
        multiplierToY(mult, engine.viewportMax, height, PAD);

      ctx.beginPath();
      ctx.moveTo(toX(pts[0]), toY(pts[0].mult));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(toX(pts[i]), toY(pts[i].mult));
      }

      const last = pts.length - 1;
      const headX = toX(pts[last]);
      const headY = toY(pts[last].mult);

      const outerGlow = ctx.createLinearGradient(headX - 40, headY, headX, headY);
      outerGlow.addColorStop(0, "rgba(0,0,0,0)");
      outerGlow.addColorStop(1, palette.glow.replace(/[\d.]+\)$/, "0.25)"));
      ctx.strokeStyle = outerGlow;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(toX(pts[0]), toY(pts[0].mult));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(toX(pts[i]), toY(pts[i].mult));
      }
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.lineTo(headX, height - PAD);
      ctx.lineTo(toX(pts[0]), height - PAD);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, PAD, 0, height);
      fill.addColorStop(0, palette.fillTop);
      fill.addColorStop(0.6, palette.fillTop.replace(/[\d.]+\)$/, "0.04)"));
      fill.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = fill;
      ctx.fill();

      const prev =
        pts.length > 2 ? pts[pts.length - 2] : pts[pts.length - 1];
      const prevX = toX(prev);
      const prevY = toY(prev.mult);
      const angle = Math.atan2(headY - prevY, headX - prevX);

      drawComets(ctx, engine.comets, palette.glow);
      drawPulseRings(ctx, engine.pulseRings, palette.glow);

      const headGlow = ctx.createRadialGradient(
        headX,
        headY,
        0,
        headX,
        headY,
        36,
      );
      headGlow.addColorStop(0, palette.glow);
      headGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(headX, headY, 36, 0, Math.PI * 2);
      ctx.fill();

      if (engine.phase === "running") {
        const thrust = speedIntensity(engine.displayMult);
        drawRocket(ctx, headX, headY, angle, palette, thrust);
      } else {
        ctx.beginPath();
        ctx.arc(headX, headY, 6, 0, Math.PI * 2);
        ctx.fillStyle = palette.head;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      return { headX, headY, angle };
    };

    const drawParticles = () => {
      const engine = engineRef.current;
      engine.particles = stepParticles(engine.particles);
      for (const p of engine.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 90, 110, ${p.life * 0.9})`;
        ctx.fill();
      }
    };

    const updateLabel = () => {
      const engine = engineRef.current;
      const label = labelRef.current;
      const sub = sublabelRef.current;
      if (!label) return;

      label.className = `crash-multiplier-lg ${engine.phase}`;

      if (engine.phase === "betting") {
        label.textContent = "Place your bets";
        label.style.color = "";
        label.style.textShadow = "";
        label.style.transform = "";
      } else if (engine.phase === "cooldown") {
        label.textContent = "Next round starting...";
        label.style.color = "";
        label.style.textShadow = "";
        label.style.transform = "";
      } else {
        label.textContent = `${engine.displayMult.toFixed(2)}x`;
        const palette = getCrashPalette(
          engine.displayMult,
          engine.phase === "crashed",
        );
        label.style.color = palette.head;
        label.style.textShadow = `0 0 28px ${palette.glow}, 0 0 64px ${palette.glow}`;
        const pulse =
          engine.phase === "running"
            ? 1 + Math.sin(engine.frame * 0.12) * 0.025
            : 1;
        label.style.transform = `scale(${pulse})`;
      }

      if (sub) {
        if (engine.phase === "crashed") {
          sub.textContent = `Crashed at ${engine.crashPoint.toFixed(2)}x`;
          sub.hidden = false;
        } else {
          sub.hidden = true;
        }
      }
    };

    const tick = () => {
      const engine = engineRef.current;
      let timeWindow = engine.frozenTimeWindow;
      engine.frame += 1;
      engine.scrollTime += engine.phase === "running" ? 1.8 + speedIntensity(engine.displayMult) * 4 : 0.3;

      if (engine.phase === "running" && engine.startedAt > 0) {
        const elapsed = Date.now() - engine.startedAt;
        engine.displayMult = multiplierAtElapsedMs(elapsed);
        engine.viewportMax = computeViewportMax(
          Math.max(engine.targetMult, engine.displayMult),
          engine.viewportMax,
        );
        engine.trail.push({ mult: engine.displayMult, elapsedMs: elapsed });
        timeWindow = computeTimeWindow(elapsed);
        engine.frozenTimeWindow = timeWindow;

        const trimBefore = elapsed - timeWindow * 1.05;
        while (
          engine.trail.length > 2 &&
          engine.trail[0].elapsedMs < trimBefore
        ) {
          engine.trail.shift();
        }

        engine.comets = stepComets(engine.comets);
        engine.pulseRings = stepPulseRings(engine.pulseRings);

        if (engine.frame % 3 === 0 && engine.trail.length > 2) {
          const last = engine.trail[engine.trail.length - 1];
          const cx = elapsedToX(last.elapsedMs, timeWindow, width, PAD);
          const cy = multiplierToY(last.mult, engine.viewportMax, height, PAD);
          engine.comets.push(spawnComet(cx, cy));
        }

        if (elapsed - engine.lastPulseAt > 280) {
          const last = engine.trail[engine.trail.length - 1];
          const px = elapsedToX(last.elapsedMs, timeWindow, width, PAD);
          const py = multiplierToY(last.mult, engine.viewportMax, height, PAD);
          engine.pulseRings.push(spawnPulseRing(px, py));
          engine.lastPulseAt = elapsed;
        }
      } else if (engine.phase === "crashed") {
        timeWindow = engine.frozenTimeWindow;
        engine.comets = stepComets(engine.comets);
        engine.pulseRings = stepPulseRings(engine.pulseRings);
      }

      const palette = getCrashPalette(
        engine.displayMult,
        engine.phase === "crashed",
      );

      ctx.clearRect(0, 0, width, height);
      drawBackground(palette);
      drawGrid(timeWindow);

      if (engine.phase === "betting" || engine.phase === "cooldown") {
        drawBettingIdle();
      }

      if (engine.phase === "running" || engine.phase === "crashed") {
        drawCurve(timeWindow);
        if (engine.pendingBurst) {
          const pts = engine.trail;
          if (pts.length > 0) {
            const last = pts[pts.length - 1];
            const headX = elapsedToX(last.elapsedMs, timeWindow, width, PAD);
            const headY = multiplierToY(
              last.mult,
              engine.viewportMax,
              height,
              PAD,
            );
            engine.particles = spawnCrashParticles(headX, headY, 36);
          }
          engine.pendingBurst = false;
        }
        drawParticles();
      }

      updateLabel();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`crash-chart-wrap crash-chart-wrap--${phase}`}
    >
      <canvas ref={canvasRef} className="crash-chart-canvas" aria-hidden="true" />
      <div className="crash-chart-overlay">
        <div
          ref={labelRef}
          className={`crash-multiplier-lg ${phase}`}
          aria-live="polite"
          aria-atomic="true"
        />
        <p ref={sublabelRef} className="crash-crashed-label" hidden />
      </div>
    </div>
  );
}
