import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, getAuthToken } from "../lib/api";

export type CrashPhase = "betting" | "running" | "crashed" | "cooldown";

export interface CrashBetView {
  id: string;
  walletAddress: string;
  amountLamports: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  payoutLamports: number;
  autoCashout?: number;
}

export interface CrashRoundState {
  id: string;
  phase: CrashPhase;
  serverSeedHash: string;
  serverSeed?: string;
  crashPoint: number;
  multiplier: number;
  bets: CrashBetView[];
  startedAt: number;
  elapsedMs: number;
  bettingEndsAt?: number;
  history: { roundId: string; crashPoint: number }[];
  myBets?: CrashBetView[];
  onChainEnabled?: boolean;
}

export interface ChatMessage {
  id: string;
  walletAddress: string;
  displayName: string;
  message: string;
  createdAt: string;
}

export interface CashoutEvent {
  walletAddress: string;
  multiplier: number;
  payoutSol: number;
}

interface SocketContextValue {
  socket: Socket | null;
  crashState: CrashRoundState | null;
  connected: boolean;
  onlineCount: number;
  chatMessages: ChatMessage[];
  recentCashouts: CashoutEvent[];
  sendChat: (message: string) => Promise<{ success: boolean; error?: string }>;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  crashState: null,
  connected: false,
  onlineCount: 0,
  chatMessages: [],
  recentCashouts: [],
  sendChat: async () => ({ success: false, error: "Not connected" }),
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
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentCashouts, setRecentCashouts] = useState<CashoutEvent[]>([]);

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
      setCrashState((prev) =>
        prev ? { ...prev, ...state, phase: "running" } : state,
      ),
    );
    s.on("crash:tick", (data: { multiplier: number; elapsedMs: number }) => {
      setCrashState((prev) =>
        prev
          ? { ...prev, multiplier: data.multiplier, elapsedMs: data.elapsedMs }
          : prev,
      );
    });
    s.on(
      "crash:crashed",
      (data: {
        crashPoint: number;
        serverSeed: string;
        roundId: string;
      }) => {
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
      },
    );
    s.on("chat:history", (messages: ChatMessage[]) => {
      setChatMessages(messages);
    });
    s.on("chat:message", (message: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-99), message]);
    });
    s.on("site:online", (data: { count: number }) => {
      setOnlineCount(data.count);
    });
    s.on("crash:player_cashout", (event: CashoutEvent) => {
      setRecentCashouts((prev) => [event, ...prev].slice(0, 8));
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [enabled]);

  const sendChat = useCallback(
    (message: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket || !enabled) {
          resolve({ success: false, error: "Not connected" });
          return;
        }
        socket.emit(
          "chat:send",
          { message },
          (response: { success: boolean; error?: string }) => {
            resolve(response);
          },
        );
      });
    },
    [socket, enabled],
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        crashState,
        connected,
        onlineCount,
        chatMessages,
        recentCashouts,
        sendChat,
      }}
    >
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
          (response: {
            success: boolean;
            balanceSol?: number;
            error?: string;
          }) => {
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
