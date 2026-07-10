import { useState } from "react";
import { fetchCrashRound, verifyCrashFairness } from "../lib/api";

interface HistoryRound {
  roundId: string;
  crashPoint: number;
}

interface CrashHistoryModalProps {
  round: HistoryRound | null;
  onClose: () => void;
}

export function CrashHistoryModal({ round, onClose }: CrashHistoryModalProps) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!round) return null;

  const handleVerify = async () => {
    setResult(null);
    setLoading(true);
    try {
      const roundData = await fetchCrashRound(round.roundId);
      if (!roundData?.serverSeed || !roundData.serverSeedHash) {
        setResult("Seed not yet revealed — check Fairness tab after round ends");
        return;
      }
      const res = await verifyCrashFairness({
        roundId: round.roundId,
        serverSeedHash: roundData.serverSeedHash,
        serverSeed: roundData.serverSeed,
        crashPoint: round.crashPoint,
      });
      setResult(res.valid ? "✓ Verified provably fair" : "Could not verify — open Fairness tab");
    } catch {
      setResult("Open Fairness tab for full verification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="round-modal-title"
      >
        <div className="modal-header">
          <h3 id="round-modal-title">Round #{round.roundId}</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="round-detail-stat">
            <span className="label">Crash point</span>
            <span
              className={`value ${
                round.crashPoint < 1.5
                  ? "text-danger"
                  : round.crashPoint < 3
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              {round.crashPoint.toFixed(2)}x
            </span>
          </div>
          <p className="panel-hint">
            Use the Fairness tab with the round ID and revealed seed for full
            verification after the round completes.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? "Checking…" : "Quick check"}
          </button>
          {result && <p className="panel-hint">{result}</p>}
        </div>
      </div>
    </div>
  );
}
