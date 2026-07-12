import { useEffect, useRef, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import { ConnectTrigger } from "./ConnectTrigger";
import { formatSol } from "../lib/api";

export function ChatPanel({ spectator = false }: { spectator?: boolean }) {
  const { chatMessages, sendChat, onlineCount, connected, recentCashouts } =
    useSocket();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJump(false);
  };

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowJump(false);
    }
  }, [chatMessages, recentCashouts]);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowJump(!nearBottom && chatMessages.length > 0);
  };

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

  const betShares = recentCashouts.slice(0, 4);

  return (
    <div className="card chat-panel">
      <div className="chat-header">
        <h3 className="card-title">Live Chat</h3>
        <div className="chat-online">
          <span className="live-dot" />
          {connected ? `${onlineCount || 1} online` : "Connecting..."}
        </div>
      </div>

      {betShares.length > 0 && (
        <div className="chat-bet-shares" aria-label="Recent wins">
          {betShares.map((c, i) => (
            <div
              key={`${c.walletAddress}-${c.multiplier}-${c.game ?? "crash"}-${i}`}
              className="chat-bet-share-card"
            >
              <span className="chat-bet-share-game">
                {(c.game ?? "crash").toUpperCase()}
              </span>
              <span className="chat-bet-share-player">
                {c.displayName ?? c.walletAddress}
              </span>
              <span className="chat-bet-share-mult">{c.multiplier.toFixed(2)}×</span>
              <span className="chat-bet-share-payout">
                +{formatSol(c.payoutSol)} SOL
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="chat-messages-wrap">
        <div
          className="chat-messages"
          ref={messagesRef}
          aria-live="polite"
          onScroll={handleScroll}
        >
          {chatMessages.length === 0 ? (
            <div className="empty-state chat-empty">
              <div className="empty-state-icon">💬</div>
              <p>No messages yet.</p>
              <p className="chat-empty-sub">
                {spectator
                  ? "Connect your wallet to join the table."
                  : "Say hello or cheer a big cashout!"}
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className="chat-message">
                <span className="chat-avatar">
                  {msg.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="chat-bubble">
                  <span className="chat-author">{msg.displayName}</span>
                  <span className="chat-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="chat-text">{msg.message}</span>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        {showJump && (
          <button
            type="button"
            className="chat-jump-bottom btn btn-sm btn-primary"
            onClick={scrollToBottom}
          >
            New messages ↓
          </button>
        )}
      </div>

      {spectator ? (
        <div className="chat-spectator-cta">
          <ConnectTrigger
            intent="chat"
            label="Connect to chat"
            size="sm"
            fullWidth
            testId="chat-connect-trigger"
          />
        </div>
      ) : (
        <form className="chat-input-row" onSubmit={handleSend}>
          <input
            className="input chat-input"
            placeholder="Type a message..."
            aria-label="Chat message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            disabled={!connected || sending}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!connected || sending || !input.trim()}
          >
            Send
          </button>
        </form>
      )}
      {error && <p className="chat-error">{error}</p>}
    </div>
  );
}
