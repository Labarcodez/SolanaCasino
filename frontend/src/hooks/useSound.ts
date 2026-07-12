import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/reducedMotion";

type SoundEvent =
  | "tick"
  | "bet"
  | "cashout"
  | "crash"
  | "win"
  | "flip"
  | "limboTick"
  | "limboWin"
  | "limboBust";

const MUTE_STORAGE_KEY = "solcasino-sound-muted";
const VOLUME_STORAGE_KEY = "solcasino-sound-volume";

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    const parsed = raw === null ? 1 : parseFloat(raw);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(1, Math.max(0, parsed));
  } catch {
    return 1;
  }
}

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
      return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [volume, setVolume] = useState(readVolume);

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
      localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    } catch {
      // ignore
    }
  }, [muted]);

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  const play = useCallback(
    (event: SoundEvent) => {
      if (muted || volume <= 0) return;
      if (event === "tick" && prefersReducedMotion()) return;
      const scale = volume;
      try {
        const ctx = ensureCtx();
        switch (event) {
          case "tick":
            playTone(ctx, 440, 0.03, "sine", 0.02 * scale);
            break;
          case "bet":
            playTone(ctx, 523, 0.08, "triangle", 0.08 * scale);
            break;
          case "cashout":
            playTone(ctx, 784, 0.12, "triangle", 0.1 * scale);
            playTone(ctx, 1046, 0.15, "sine", 0.06 * scale);
            break;
          case "crash":
            playTone(ctx, 120, 0.35, "sawtooth", 0.12 * scale);
            break;
          case "win":
            playTone(ctx, 659, 0.1, "triangle", 0.08 * scale);
            playTone(ctx, 880, 0.15, "triangle", 0.06 * scale);
            break;
          case "flip":
            playTone(ctx, 380, 0.06, "sine", 0.04 * scale);
            playTone(ctx, 520, 0.05, "sine", 0.03 * scale);
            break;
          case "limboTick":
            playTone(ctx, 320 + Math.random() * 80, 0.02, "sine", 0.015 * scale);
            break;
          case "limboWin":
            playTone(ctx, 523, 0.1, "triangle", 0.08 * scale);
            playTone(ctx, 784, 0.18, "triangle", 0.06 * scale);
            break;
          case "limboBust":
            playTone(ctx, 90, 0.2, "sawtooth", 0.08 * scale);
            break;
        }
      } catch {
        // Audio not available
      }
    },
    [muted, volume, ensureCtx],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const setSoundVolume = useCallback((next: number) => {
    setVolume(Math.min(1, Math.max(0, next)));
  }, []);

  return { muted, volume, toggleMute, setVolume: setSoundVolume, play };
}
