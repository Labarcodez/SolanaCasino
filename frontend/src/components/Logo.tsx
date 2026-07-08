import { useEffect, useId, useState } from "react";
import { BRAND } from "../lib/brand";
import { OrbitHub } from "./logo/OrbitHub";
import { HUB_BLEND_OPACITY, SOLANA_MIX_STOPS } from "./logo/solanaLogoGeometry";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const SIZES = { sm: 28, md: 36, lg: 52 };
const ORBIT_RADIUS = 22;
const TOKEN_SIZE = 11;
const TOKEN_CONTAINER_R = 7.5;
const TOKEN_CLIP_R = TOKEN_SIZE / 2 - 0.5;
const CENTER = 32;
const ORBIT_PERIOD_MS = 8000;

function SolanaToken({ clipId }: { clipId: string }) {
  const half = TOKEN_SIZE / 2;

  return (
    <g className="logo-sol-token">
      <circle r={TOKEN_CONTAINER_R} fill="#06070b" stroke="#03E1FF" strokeWidth="0.85" />
      <g clipPath={`url(#${clipId})`}>
        <image
          href="/solana-token.png"
          x={-half}
          y={-half}
          width={TOKEN_SIZE}
          height={TOKEN_SIZE}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </g>
  );
}

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const px = SIZES[size];
  const fontSize = size === "sm" ? "1.1rem" : size === "lg" ? "1.65rem" : "1.35rem";
  const hubGradId = useId().replaceAll(":", "");
  const hubBlendGradId = useId().replaceAll(":", "");
  const orbitGradId = useId().replaceAll(":", "");
  const clipId = useId().replaceAll(":", "");
  const [angleDeg, setAngleDeg] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setAngleDeg(0);
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
          <linearGradient
            id={hubGradId}
            x1={CENTER}
            y1="10"
            x2={CENTER}
            y2="54"
            gradientUnits="userSpaceOnUse"
            gradientTransform={`rotate(38 ${CENTER} ${CENTER})`}
          >
            {SOLANA_MIX_STOPS.map((stop) => (
              <stop key={`hub-${stop.offset}`} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
          <linearGradient
            id={hubBlendGradId}
            x1="10"
            y1={CENTER}
            x2="54"
            y2={CENTER}
            gradientUnits="userSpaceOnUse"
            gradientTransform={`rotate(-42 ${CENTER} ${CENTER})`}
          >
            {SOLANA_MIX_STOPS.map((stop) => (
              <stop key={`hub-blend-${stop.offset}`} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
          <linearGradient
            id={orbitGradId}
            x1="12"
            y1="12"
            x2="52"
            y2="52"
            gradientUnits="userSpaceOnUse"
            gradientTransform={`rotate(18 ${CENTER} ${CENTER})`}
          >
            {SOLANA_MIX_STOPS.map((stop) => (
              <stop key={`orbit-${stop.offset}`} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
          <clipPath id={clipId}>
            <circle r={TOKEN_CLIP_R} cx="0" cy="0" />
          </clipPath>
        </defs>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={ORBIT_RADIUS}
          stroke={`url(#${orbitGradId})`}
          strokeWidth="1.35"
        />

        <OrbitHub
          hubGradId={hubGradId}
          hubBlendGradId={hubBlendGradId}
          hubBlendOpacity={HUB_BLEND_OPACITY}
        />

        <g className="logo-orbit-arm" transform={`translate(${tokenX} ${tokenY})`}>
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
