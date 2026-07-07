import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface CrashChartProps {
  multiplier: number;
  phase: "betting" | "running" | "crashed" | "cooldown";
  crashPoint?: number;
}

export function CrashChart({ multiplier, phase, crashPoint }: CrashChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (phase === "betting" || phase === "cooldown") {
      pointsRef.current = [];
    }
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
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const pad = 24;

      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "rgba(42, 47, 66, 0.5)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const y = pad + ((h - pad * 2) * i) / 5;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
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
        if (pts.length > 1) {
          const gradient = ctx.createLinearGradient(0, 0, w, 0);
          if (phase === "crashed") {
            gradient.addColorStop(0, "rgba(255, 59, 92, 0.85)");
            gradient.addColorStop(1, "rgba(255, 59, 92, 0.2)");
          } else {
            gradient.addColorStop(0, "rgba(0, 255, 163, 0.9)");
            gradient.addColorStop(1, "rgba(139, 92, 246, 0.45)");
          }

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const xc = (pts[i].x + pts[i - 1].x) / 2;
            const yc = (pts[i].y + pts[i - 1].y) / 2;
            ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
          }
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.shadowColor =
            phase === "crashed"
              ? "rgba(255, 59, 92, 0.6)"
              : "rgba(0, 255, 163, 0.5)";
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Fill under curve
          const last = pts[pts.length - 1];
          ctx.lineTo(last.x, h - pad);
          ctx.lineTo(pts[0].x, h - pad);
          ctx.closePath();
          const fillGrad = ctx.createLinearGradient(0, pad, 0, h);
          fillGrad.addColorStop(
            0,
            phase === "crashed"
              ? "rgba(255, 59, 92, 0.15)"
              : "rgba(0, 255, 163, 0.12)",
          );
          fillGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = fillGrad;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [multiplier, phase, crashPoint]);

  const displayText =
    phase === "betting"
      ? "Place your bets"
      : phase === "cooldown"
        ? "Next round starting..."
        : `${multiplier.toFixed(2)}x`;

  return (
    <div className="crash-chart-wrap">
      <canvas ref={canvasRef} className="crash-chart-canvas" />
      <div className="crash-chart-overlay">
        <motion.div
          className={`crash-multiplier-lg ${phase}`}
          key={phase === "running" ? Math.floor(multiplier * 10) : phase}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.1 }}
          aria-live="polite"
          aria-atomic="true"
        >
          {displayText}
        </motion.div>
        {phase === "running" && (
          <motion.div
            className="crash-rocket-icon"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          >
            🚀
          </motion.div>
        )}
        {phase === "crashed" && crashPoint && (
          <p className="crash-crashed-label">Crashed at {crashPoint.toFixed(2)}x</p>
        )}
      </div>
    </div>
  );
}
