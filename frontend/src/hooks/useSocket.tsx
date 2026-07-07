import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, getAuthToken } from "../lib/api";

export type CrashPhase = "betting" | "running" | "crashed" | "cooldown";

export interface CrashRoundState {
  id: string;
  phase: CrashPhase;
  serverSeedHash: string;
  serverSeed?: string;
  crashPoint: number;
  multiplier: number;
  bets: Array<{
    id: string;
    walletAddress: string;
    amountLamports: number;
    cashedOut: boolean;
    cashoutMultiplier?: number;
    payoutLamports: number;
  }>;
  startedAt: number;
  elapsedMs: number;
  history: { roundId: string; crashPoint: number }[];
  myBets?: Array<{
    id: string;
    walletAddress: string;
    amountLamports: number;
    cashedOut: boolean;
    cashoutMultiplier?: number;
    payoutLamports: number;
    autoCashout?: number;
  }>;
}

interface SocketContextValue {
  socket: Socket | null;
  crashState: CrashRoundState | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  crashState: null,
  connected: false,
});

export function SocketProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [crashState, setCrashState] = useState<CrashRoundState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    const s = io(API_URL || window.location.origin, {
      transports: ["websocket", "polling"],
      auth: { token },
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));
    s.on("crash:state", (state: CrashRoundState) => setCrashState(state));
    s.on("crash:round_start", (state: CrashRoundState) => setCrashState(state));
    s.on("crash:round_running", (state: CrashRoundState) =>
      setCrashState((prev) => (prev ? { ...prev, ...state, phase: "running" } : state)),
    );
    s.on("crash:tick", (data: { multiplier: number; elapsedMs: number }) => {
      setCrashState((prev) =>
        prev
          ? { ...prev, multiplier: data.multiplier, elapsedMs: data.elapsedMs }
          : prev,
      );
    });
    s.on("crash:crashed", (data: { crashPoint: number; serverSeed: string; roundId: string }) => {
      setCrashState((prev) =>
        prev
          ? {
              ...prev,
              phase: "crashed",
              multiplier: data.crashPoint,
              crashPoint: data.crashPoint,
              serverSeed: data.serverSeed,
            }
          : prev,
      );
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [enabled]);

  return (
    <SocketContext.Provider value={{ socket, crashState, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

export function useCrashSubscription(enabled: boolean) {
  const { socket, crashState } = useSocket();

  const subscribe = useCallback(() => {
    if (enabled) socket?.emit("crash:subscribe");
  }, [socket, enabled]);

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  const placeBet = useCallback(
    (
      amountSol: number,
      autoCashout?: number,
    ): Promise<{ success: boolean; balanceSol?: number; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket || !enabled) {
          resolve({ success: false, error: "Not connected" });
          return;
        }
        socket.emit(
          "crash:bet",
          { amountSol, autoCashout },
          (response: { success: boolean; balanceSol?: number; error?: string }) => {
            resolve(response);
            subscribe();
          },
        );
      });
    },
    [socket, enabled, subscribe],
  );

  const cashout = useCallback((): Promise<{
    success: boolean;
    balanceSol?: number;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      if (!socket || !enabled) {
        resolve({ success: false, error: "Not connected" });
        return;
      }
      socket.emit(
        "crash:cashout",
        (response: { success: boolean; balanceSol?: number; error?: string }) => {
          resolve(response);
          subscribe();
        },
      );
    });
  }, [socket, enabled, subscribe]);

  return { crashState, placeBet, cashout, subscribe };
}
