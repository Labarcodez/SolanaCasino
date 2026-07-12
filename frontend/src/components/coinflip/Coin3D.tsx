import { motion } from "framer-motion";
import { prefersReducedMotion } from "../../lib/reducedMotion";

interface Coin3DProps {
  flipping: boolean;
  result: "heads" | "tails" | null;
  won: boolean | null;
}

function CrownIcon() {
  return (
    <g fill="#0a0e17">
      <path d="M25 62 L35 38 L50 48 L65 38 L75 62 Z" />
      <rect x="28" y="62" width="44" height="8" rx="2" />
      <circle cx="35" cy="38" r="3" />
      <circle cx="50" cy="48" r="3" />
      <circle cx="65" cy="38" r="3" />
    </g>
  );
}

function OrbitIcon() {
  return (
    <g fill="none" stroke="#fff" strokeWidth="3">
      <circle cx="50" cy="50" r="22" />
      <ellipse cx="50" cy="50" rx="22" ry="8" transform="rotate(-20 50 50)" />
      <circle cx="72" cy="42" r="5" fill="#8b5cf6" stroke="none" />
    </g>
  );
}

export function Coin3D({ flipping, result, won }: Coin3DProps) {
  const reducedMotion = prefersReducedMotion();
  const resultRotation =
    result === "tails" ? 1800 + 180 : result === "heads" ? 1800 : 0;

  return (
    <div className="coin-3d-scene">
      <motion.div
        className={`coin-3d ${flipping ? "flipping" : ""} ${
          result && won !== null ? (won ? "coin-win" : "coin-loss") : ""
        }`}
        animate={
          reducedMotion
            ? { rotateY: result ? resultRotation : 0 }
            : flipping
              ? { rotateY: [0, 720, 1440, 1800] }
              : result
                ? { rotateY: resultRotation }
                : { rotateY: 0 }
        }
        transition={
          reducedMotion
            ? { duration: 0 }
            : flipping
              ? { duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }
              : { duration: 0.4, ease: "easeOut" }
        }
      >
        <div className="coin-face coin-face-heads">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="headsGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00ffa3" />
                <stop offset="100%" stopColor="#14f195" />
              </linearGradient>
              <radialGradient id="headsShine" cx="35%" cy="30%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#headsGrad)" />
            <circle cx="50" cy="50" r="46" fill="url(#headsShine)" />
            <CrownIcon />
          </svg>
        </div>
        <div className="coin-face coin-face-tails">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="tailsGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#tailsGrad)" />
            <OrbitIcon />
          </svg>
        </div>
      </motion.div>
      {!reducedMotion && (
        <motion.div
          className="coin-shadow"
          aria-hidden="true"
          animate={{
            scale: flipping ? [1, 0.65, 1] : 1,
            opacity: flipping ? [0.35, 0.12, 0.35] : 0.35,
          }}
          transition={{ duration: flipping ? 1.2 : 0.2 }}
        />
      )}
    </div>
  );
}
