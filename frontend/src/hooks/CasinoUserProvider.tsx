import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useCasinoUser } from "./useCasinoUser";

type CasinoUserContextValue = ReturnType<typeof useCasinoUser>;

const CasinoUserContext = createContext<CasinoUserContextValue | null>(null);

export function CasinoUserProvider({ children }: { children: ReactNode }) {
  const value = useCasinoUser();
  return (
    <CasinoUserContext.Provider value={value}>
      {children}
    </CasinoUserContext.Provider>
  );
}

export function useCasino() {
  const ctx = useContext(CasinoUserContext);
  if (!ctx) {
    throw new Error("useCasino must be used within CasinoUserProvider");
  }
  return ctx;
}
