import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface GameErrorBoundaryProps {
  label: string;
  children: ReactNode;
}

export function GameErrorBoundary({ label, children }: GameErrorBoundaryProps) {
  return <ErrorBoundary label={label}>{children}</ErrorBoundary>;
}
