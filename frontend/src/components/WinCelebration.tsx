import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { prefersReducedMotion } from "../lib/reducedMotion";

interface WinCelebrationProps {
  active: boolean;
  onDone?: () => void;
}

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (i / 12) * Math.PI * 2,
  distance: 40 + (i % 3) * 18,
}));

export function WinCelebration({ active, onDone }: WinCelebrationProps) {
  const [show, setShow] = useState(false);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!active) return;
    setShow(true);
    const duration = reduced ? 500 : 1200;
    const timer = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [active, onDone, reduced]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="win-celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        >
          {reduced ? (
            <div className="win-celebration-glow win-celebration-glow--static" />
          ) : (
            <>
              <motion.div
                className="win-celebration-glow"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
              {PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  className="win-celebration-particle"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(p.angle) * p.distance,
                    y: Math.sin(p.angle) * p.distance,
                    opacity: 0,
                    scale: 0.2,
                  }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              ))}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
