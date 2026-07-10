import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getCrashColors } from "../lib/crashColors";

interface CrashChartProps {
  multiplier: number;
  phase: "betting" | "running" | "crashed" | "cooldown";
  crashPoint?: number;
}

interface Point {
  x: number;
  y: number;
}

interface CrackLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

export function CrashChart({ multiplier, phase, crashPoint }: CrashChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const animRef = useRef<number>(0);
  const [rocketPos, setRocketPos] = useState({ x: 0, y: 0, angle: -45 });
  const [crackLines, setCrackLines] = useState<CrackLine[]>([]);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; vx: number; vy: number; life: number }[]
  >([]);
  const crackTriggeredRef = useRef(false);
  const particleIdRef = useRef(0);

  useEffect(() => {
    if (phase === "betting" || phase === "cooldown") {
      pointsRef.current = [];
      crackTriggeredRef.current = false;
      setCrackLines([]);
      setParticles([]);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "crashed" || crackTriggeredRef.current) return;
    crackTriggeredRef.current = true;

    const last = pointsRef.current[pointsRef.current.length - 1];
    if (!last) return;

    const lines: CrackLine[] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 4) * i + Math.random() * 0.5;
      const len = 30 + Math.random() * 50;
      lines.push({
        x1: last.x,
        y1: last.y,
        x2: last.x + Math.cos(angle) * len,
        y2: last.y + Math.sin(angle) * len,
        opacity: 1,
      });
    }
    setCrackLines(lines);

    const burst = Array.from({ length: 10 }, () => {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      return {
        id: particleIdRef.current++,
        x: last.x,
        y: last.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 1,
      };
    });
    setParticles(burst);

    const fadeTimer = setInterval(() => {
      setCrackLines((prev) =>
        prev
          .map((l) => ({ ...l, opacity: l.opacity - 0.08 }))
          .filter((l) => l.opacity > 0),
      );
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15,
            life: p.life - 0.06,
          }))
          .filter((p) => p.life > 0),
      );
    }, 40);

    return () => clearInterval(fadeTimer);
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      const pad = 24;

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(42, 47, 66, 0.5)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
      ctx.font = "10px ui-monospace, monospace";
      const maxMult = Math.max(multiplier, crashPoint ?? 2, 10);
      for (let i = 1; i <= 4; i++) {
        const y = pad + ((h - pad * 2) * i) / 5;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
        const labelMult = 1 + ((maxMult - 1) * (5 - i)) / 5;
        ctx.fillText(`${labelMult.toFixed(1)}x`, pad + 4, y - 4);
      }

      if (phase === "running" || phase === "crashed") {
        const t = pointsRef.current.length;
        const x = pad + Math.min(t * 2.5, w - pad * 2);
        const maxMult = Math.max(multiplier, crashPoint ?? 2, 2);
        const y =
          h -
          pad -
          ((multiplier - 1) / (maxMult - 1 + 0.01)) * (h - pad * 2);
        pointsRef.current.push({ x, y: Math.max(pad, y) });
        if (pointsRef.current.length > 200) {
          pointsRef.current.shift();
        }

        const pts = pointsRef.current;
        const colors = getCrashColors(multiplier, phase === "crashed");

        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const xc = (pts[i].x + pts[i - 1].x) / 2;
            const yc = (pts[i].y + pts[i - 1].y) / 2;
            ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
          }
          ctx.strokeStyle = colors.stroke;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;

          const last = pts[pts.length - 1];
          ctx.lineTo(last.x, h - pad);
          ctx.lineTo(pts[0].x, h - pad);
          ctx.closePath();
          const fillGrad = ctx.createLinearGradient(0, pad, 0, h);
          fillGrad.addColorStop(0, colors.fillTop);
          fillGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = fillGrad;
          ctx.fill();

          const prev = pts[pts.length - 2];
          const angle =
            (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
          setRocketPos({ x: last.x, y: last.y, angle });
        }

        crackLines.forEach((line) => {
          ctx.beginPath();
          ctx.moveTo(line.x1, line.y1);
          ctx.lineTo(line.x2, line.y2);
          ctx.strokeStyle = `rgba(255, 59, 92, ${line.opacity})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        particles.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 120, 80, ${p.life})`;
          ctx.fill();
        });
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [multiplier, phase, crashPoint, crackLines, particles]);

  const displayText =
    phase === "betting"
      ? "Place your bets"
      : phase === "cooldown"
        ? "Next round starting..."
        : `${multiplier.toFixed(2)}x`;

  const pulseScale =
    phase === "running" ? Math.min(1.08, 1 + (multiplier - 1) * 0.008) : 1;

  return (
    <div className="crash-chart-wrap">
      <canvas ref={canvasRef} className="crash-chart-canvas" />
      {phase === "running" && rocketPos.x > 0 && (
        <div
          className="crash-rocket-tracked"
          style={{
            left: rocketPos.x,
            top: rocketPos.y,
            transform: `translate(-50%, -50%) rotate(${rocketPos.angle - 45}deg)`,
          }}
          aria-hidden="true"
        >
          🚀
        </div>
      )}
      <div className="crash-chart-overlay">
        <motion.div
          className={`crash-multiplier-lg ${phase}`}
          key={phase === "running" ? Math.floor(multiplier * 10) : phase}
          initial={{ scale: 0.95 }}
          animate={{ scale: pulseScale }}
          transition={{ duration: 0.1 }}
          aria-live="polite"
          aria-atomic="true"
        >
          {displayText}
        </motion.div>
        {phase === "crashed" && crashPoint && (
          <p className="crash-crashed-label">Crashed at {crashPoint.toFixed(2)}x</p>
        )}
      </div>
    </div>
  );
}
