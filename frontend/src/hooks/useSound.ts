import { useCallback, useEffect, useRef, useState } from "react";

type SoundEvent = "tick" | "bet" | "cashout" | "crash" | "win";

const STORAGE_KEY = "solcasino-sound-muted";

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.08,
): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gainNode.gain.value = gain;
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.stop(ctx.currentTime + duration);
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // ignore
    }
  }, [muted]);

  const play = useCallback(
    (event: SoundEvent) => {
      if (muted) return;
      try {
        const ctx = ensureCtx();
        switch (event) {
          case "tick":
            playTone(ctx, 440, 0.03, "sine", 0.02);
            break;
          case "bet":
            playTone(ctx, 523, 0.08, "triangle");
            break;
          case "cashout":
            playTone(ctx, 784, 0.12, "triangle", 0.1);
            playTone(ctx, 1046, 0.15, "sine", 0.06);
            break;
          case "crash":
            playTone(ctx, 120, 0.35, "sawtooth", 0.12);
            break;
          case "win":
            playTone(ctx, 659, 0.1, "triangle", 0.08);
            playTone(ctx, 880, 0.15, "triangle", 0.06);
            break;
        }
      } catch {
        // Audio not available
      }
    },
    [muted, ensureCtx],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  return { muted, toggleMute, play };
}
