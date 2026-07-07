import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../lib/api";

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

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [crashState, setCrashState] = useState<CrashRoundState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(API_URL || window.location.origin, {
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
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
  }, []);

  return (
    <SocketContext.Provider value={{ socket, crashState, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

export function useCrashSubscription(walletAddress?: string) {
  const { socket, crashState } = useSocket();

  const subscribe = useCallback(() => {
    socket?.emit("crash:subscribe", walletAddress);
  }, [socket, walletAddress]);

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  const placeBet = useCallback(
    (
      amountSol: number,
      autoCashout?: number,
    ): Promise<{ success: boolean; balanceSol?: number; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket || !walletAddress) {
          resolve({ success: false, error: "Not connected" });
          return;
        }
        socket.emit(
          "crash:bet",
          { walletAddress, amountSol, autoCashout },
          (response: { success: boolean; balanceSol?: number; error?: string }) => {
            resolve(response);
            subscribe();
          },
        );
      });
    },
    [socket, walletAddress, subscribe],
  );

  const cashout = useCallback((): Promise<{
    success: boolean;
    balanceSol?: number;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      if (!socket || !walletAddress) {
        resolve({ success: false, error: "Not connected" });
        return;
      }
      socket.emit(
        "crash:cashout",
        { walletAddress },
        (response: { success: boolean; balanceSol?: number; error?: string }) => {
          resolve(response);
          subscribe();
        },
      );
    });
  }, [socket, walletAddress, subscribe]);

  return { crashState, placeBet, cashout, subscribe };
}
