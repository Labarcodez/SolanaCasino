import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ConnectModal } from "../components/ConnectModal";

export type ConnectIntent = "play" | "deposit" | "chat" | "general";

interface ConnectModalContextValue {
  openConnectModal: (intent?: ConnectIntent) => void;
  closeConnectModal: () => void;
  isConnectModalOpen: boolean;
  intent: ConnectIntent;
}

const ConnectModalContext = createContext<ConnectModalContextValue | null>(null);

export function ConnectModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<ConnectIntent>("general");

  const openConnectModal = useCallback((nextIntent: ConnectIntent = "general") => {
    setIntent(nextIntent);
    setOpen(true);
  }, []);

  const closeConnectModal = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      openConnectModal,
      closeConnectModal,
      isConnectModalOpen: open,
      intent,
    }),
    [openConnectModal, closeConnectModal, open, intent],
  );

  return (
    <ConnectModalContext.Provider value={value}>
      {children}
      <ConnectModal open={open} intent={intent} onClose={closeConnectModal} />
    </ConnectModalContext.Provider>
  );
}

export function useConnectModal() {
  const ctx = useContext(ConnectModalContext);
  if (!ctx) {
    throw new Error("useConnectModal must be used within ConnectModalProvider");
  }
  return ctx;
}
