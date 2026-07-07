import { Logo } from "./Logo";
import { BRAND } from "../lib/brand";

interface ConfigErrorScreenProps {
  message?: string;
  onRetry: () => void;
}

export function ConfigErrorScreen({ message, onRetry }: ConfigErrorScreenProps) {
  return (
    <div className="app-loading config-error-screen">
      <Logo size="lg" />
      <h2>Unable to connect to {BRAND.name}</h2>
      <p>{message ?? "The casino server could not be reached. Check your connection and try again."}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Retry connection
      </button>
    </div>
  );
}
