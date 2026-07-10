import { useSocket } from "../hooks/useSocket";

export function SocketStatusBanner() {
  const { connected } = useSocket();

  if (connected) return null;

  return (
    <div className="socket-status-banner" role="status" data-testid="socket-reconnect-banner">
      <span className="socket-status-dot" aria-hidden="true" />
      Reconnecting to live game feed…
    </div>
  );
}
