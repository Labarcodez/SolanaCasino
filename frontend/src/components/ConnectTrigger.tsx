import { useConnectModal, type ConnectIntent } from "../context/ConnectModalContext";

interface ConnectTriggerProps {
  intent?: ConnectIntent;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  testId?: string;
}

export function ConnectTrigger({
  intent = "play",
  label = "Connect",
  className = "",
  size = "md",
  fullWidth = false,
  testId = "connect-trigger",
}: ConnectTriggerProps) {
  const { openConnectModal } = useConnectModal();

  const sizeClass =
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  return (
    <button
      type="button"
      className={`btn btn-primary ${sizeClass} ${fullWidth ? "btn-full" : ""} ${className}`.trim()}
      onClick={() => openConnectModal(intent)}
      data-testid={testId}
    >
      {label}
    </button>
  );
}
