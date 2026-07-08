import { useEffect, useId, useState } from "react";
import { BRAND } from "../lib/brand";
import { OrbitHub } from "./logo/OrbitHub";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const SIZES = { sm: 28, md: 36, lg: 52 };
const ORBIT_RADIUS = 18;
const TOKEN_SIZE = 14;
const TOKEN_CLIP_R = TOKEN_SIZE / 2 - 0.5;
const CENTER = 32;
const ORBIT_PERIOD_MS = 8000;

function SolanaToken({ clipId }: { clipId: string }) {
  const half = TOKEN_SIZE / 2;

  return (
    <g className="logo-sol-token" clipPath={`url(#${clipId})`}>
      <image
        href="/solana-token.png"
        x={-half}
        y={-half}
        width={TOKEN_SIZE}
        height={TOKEN_SIZE}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  );
}

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const px = SIZES[size];
  const fontSize = size === "sm" ? "1.1rem" : size === "lg" ? "1.65rem" : "1.35rem";
  const gradId = useId().replaceAll(":", "");
  const clipId = useId().replaceAll(":", "");
  const [angleDeg, setAngleDeg] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setAngleDeg(-90);
      return;
    }

    let frame = 0;
    let start: number | undefined;

    const tick = (now: number) => {
      if (start === undefined) start = now;
      const elapsed = now - start;
      setAngleDeg((elapsed / ORBIT_PERIOD_MS) * 360);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const angleRad = (angleDeg * Math.PI) / 180;
  const tokenX = CENTER + ORBIT_RADIUS * Math.cos(angleRad);
  const tokenY = CENTER + ORBIT_RADIUS * Math.sin(angleRad);
  const tangentDeg = angleDeg + 90;

  return (
    <div className={`logo ${className}`} style={showText ? undefined : { gap: 0 }}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="logo-svg"
        overflow="visible"
      >
        <defs>
          <linearGradient id={gradId} x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14F195" />
            <stop offset="0.55" stopColor="#03E1FF" />
            <stop offset="1" stopColor="#9945FF" />
          </linearGradient>
          <linearGradient id={`${gradId}-chip`} x1="22" y1="22" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14F195" />
            <stop offset="0.45" stopColor="#03E1FF" />
            <stop offset="1" stopColor="#9945FF" />
          </linearGradient>
          <radialGradient id={`${gradId}-core`} cx={CENTER} cy={CENTER} r="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#03E1FF" stopOpacity="0.28" />
            <stop offset="1" stopColor="#9945FF" stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <circle r={TOKEN_CLIP_R} cx="0" cy="0" />
          </clipPath>
        </defs>

        <circle cx={CENTER} cy={CENTER} r="24" fill={`url(#${gradId}-core)`} />

        <circle
          cx={CENTER}
          cy={CENTER}
          r={ORBIT_RADIUS}
          stroke={`url(#${gradId})`}
          strokeWidth="1.5"
          opacity="0.45"
        />

        <OrbitHub chipGradId={`${gradId}-chip`} />

        <g className="logo-orbit-arm" transform={`translate(${tokenX} ${tokenY}) rotate(${tangentDeg})`}>
          <SolanaToken clipId={clipId} />
        </g>
      </svg>
      {showText && (
        <span className="logo-text" style={{ fontSize }}>
          <span className="logo-word-primary">{BRAND.shortName}</span>
          <span className="logo-word-secondary"> Solana Casino</span>
        </span>
      )}
    </div>
  );
}
