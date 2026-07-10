import { useEffect, useRef, useState } from "react";
import { useSocket } from "../hooks/useSocket";

export function ChatPanel({ spectator = false }: { spectator?: boolean }) {
  const { chatMessages, sendChat, onlineCount, connected } = useSocket();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    setError(null);
    const result = await sendChat(input.trim());
    if (result.success) {
      setInput("");
    } else {
      setError(result.error ?? "Failed to send");
    }
    setSending(false);
  };

  return (
    <div className="card chat-panel">
      <div className="chat-header">
        <h3 className="card-title">Live Chat</h3>
        <div className="chat-online">
          <span className="live-dot" />
          {connected ? `${onlineCount || 1} online` : "Connecting..."}
        </div>
      </div>

      <div className="chat-messages" aria-live="polite">
        {chatMessages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <span className="chat-avatar">
                {msg.displayName.slice(0, 1).toUpperCase()}
              </span>
              <div className="chat-bubble">
                <span className="chat-author">{msg.displayName}</span>
                <span className="chat-text">{msg.message}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          className="input chat-input"
          placeholder={spectator ? "Connect wallet to chat" : "Type a message..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
          disabled={spectator || !connected || sending}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={spectator || !connected || sending || !input.trim()}
        >
          Send
        </button>
      </form>
      {error && <p className="chat-error">{error}</p>}
    </div>
  );
}
