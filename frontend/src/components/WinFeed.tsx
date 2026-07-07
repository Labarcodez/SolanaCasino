import { motion, AnimatePresence } from "framer-motion";
import type { CashoutEvent } from "../hooks/useSocket";
import { formatSol } from "../lib/api";

interface WinFeedProps {
  cashouts: CashoutEvent[];
}

export function WinFeed({ cashouts }: WinFeedProps) {
  if (cashouts.length === 0) return null;

  return (
    <div className="win-feed" aria-live="polite">
      <AnimatePresence>
        {cashouts.slice(0, 3).map((c, i) => (
          <motion.div
            key={`${c.walletAddress}-${c.multiplier}-${i}`}
            className="win-feed-item"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <span className="win-feed-player">{c.walletAddress}</span>
            <span className="win-feed-mult">{c.multiplier.toFixed(2)}x</span>
            <span className="win-feed-payout">+{formatSol(c.payoutSol)} SOL</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
