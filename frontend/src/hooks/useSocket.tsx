import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, getAuthToken } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export type CrashPhase = "betting" | "running" | "crashed" | "cooldown";

export interface CrashBetView {
  id: string;
  walletAddress: string;
  slot?: 0 | 1;
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
  runningStartedAt?: number;
  elapsedMs: number;
  bettingEndsAt?: number;
  history: { roundId: string; crashPoint: number }[];
  myBets?: CrashBetView[];
  onChainEnabled?: boolean;
}

export interface JackpotState {
  poolSol: number;
  poolLamports: number;
  contributionBps: number;
  minCrashMultiplier: number;
  lastPayout: {
    roundId: string;
    walletAddress: string;
    amountSol: number;
    cashoutMultiplier: number;
    crashPoint: number;
    createdAt: string;
  } | null;
}

export interface JackpotWonEvent {
  roundId: string;
  walletAddress: string;
  amountSol: number;
  cashoutMultiplier: number;
  crashPoint: number;
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
  displayName?: string;
  multiplier: number;
  payoutSol: number;
  game?: "crash" | "limbo" | "coinflip";
}

interface SocketContextValue {
  socket: Socket | null;
  crashState: CrashRoundState | null;
  jackpotState: JackpotState | null;
  connected: boolean;
  onlineCount: number;
  chatMessages: ChatMessage[];
  recentCashouts: CashoutEvent[];
  sendChat: (message: string) => Promise<{ success: boolean; error?: string }>;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  crashState: null,
  jackpotState: null,
  connected: false,
  onlineCount: 0,
  chatMessages: [],
  recentCashouts: [],
  sendChat: async () => ({ success: false, error: "Not connected" }),
});

export type SocketMode = "authenticated" | "spectator" | "off";

export function SocketProvider({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: SocketMode;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [crashState, setCrashState] = useState<CrashRoundState | null>(null);
  const [jackpotState, setJackpotState] = useState<JackpotState | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentCashouts, setRecentCashouts] = useState<CashoutEvent[]>([]);
  const { toast } = useToast();
  const connectErrorShown = useRef(false);

  useEffect(() => {
    if (mode === "off") {
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = getAuthToken();
    if (mode === "authenticated" && !token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = io(API_URL || window.location.origin, {
      transports: ["websocket", "polling"],
      auth: mode === "authenticated" && token ? { token } : {},
    });

    s.on("connect", () => {
      setConnected(true);
      if (connectErrorShown.current) {
        toast("Live connection restored", "success");
        connectErrorShown.current = false;
      }
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => {
      setConnected(false);
      if (!connectErrorShown.current) {
        toast("Live connection lost — retrying...", "error");
        connectErrorShown.current = true;
      }
    });
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
        setCrashState((prev) => {
          if (!prev) return prev;
          const historyEntry = {
            roundId: data.roundId,
            crashPoint: data.crashPoint,
          };
          const withoutDup = prev.history.filter(
            (h) => h.roundId !== data.roundId,
          );
          return {
            ...prev,
            phase: "crashed",
            multiplier: data.crashPoint,
            crashPoint: data.crashPoint,
            serverSeed: data.serverSeed,
            history: [historyEntry, ...withoutDup].slice(0, 10),
          };
        });
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
    s.on("jackpot:state", (state: JackpotState) => setJackpotState(state));
    s.on("jackpot:won", (event: JackpotWonEvent) => {
      toast(
        `Jackpot! ${event.walletAddress} won ${event.amountSol.toFixed(3)} SOL @ ${event.cashoutMultiplier.toFixed(2)}x`,
        "success",
      );
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [mode, toast]);

  const sendChat = useCallback(
    (message: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket || mode !== "authenticated") {
          resolve({ success: false, error: "Connect wallet to chat" });
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
    [socket, mode],
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        crashState,
        jackpotState,
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
  const { socket, crashState, connected } = useSocket();
  const canPlay = enabled && connected;

  const subscribe = useCallback(() => {
    if (connected) socket?.emit("crash:subscribe");
  }, [socket, connected]);

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  const placeBet = useCallback(
    (
      amountSol: number,
      autoCashout?: number,
      slot: 0 | 1 = 0,
    ): Promise<{ success: boolean; balanceSol?: number; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket || !canPlay) {
          resolve({ success: false, error: "Not connected" });
          return;
        }
        socket.emit(
          "crash:bet",
          { amountSol, autoCashout, slot },
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
    [socket, canPlay, subscribe],
  );

  const cashout = useCallback(
    (slot: 0 | 1 = 0): Promise<{
    success: boolean;
    balanceSol?: number;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      if (!socket || !canPlay) {
        resolve({ success: false, error: "Not connected" });
        return;
      }
      socket.emit(
        "crash:cashout",
        { slot },
        (response: { success: boolean; balanceSol?: number; error?: string }) => {
          resolve(response);
          subscribe();
        },
      );
    });
  }, [socket, canPlay, subscribe]);

  return { crashState, placeBet, cashout, subscribe, canPlay };
}
