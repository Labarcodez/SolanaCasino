import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/reducedMotion";

export function AnimatedBackground() {
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      className={`ambient-bg${reduceMotion ? " ambient-bg--static" : ""}`}
      aria-hidden="true"
    >
      <div className="ambient-stars" />
      <div className="ambient-orbit-ring ambient-orbit-ring-1" />
      <div className="ambient-orbit-ring ambient-orbit-ring-2" />
      <div className="ambient-orb ambient-orb-purple" />
      <div className="ambient-orb ambient-orb-green" />
      <div className="ambient-grid" />
    </div>
  );
}
