import { useState } from "react";
import { verifyCrashFairness } from "../lib/api";

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

  if (!round) return null;

  const handleVerify = async () => {
    setResult(null);
    try {
      const res = await verifyCrashFairness({
        roundId: round.roundId,
        serverSeedHash: "",
        serverSeed: "",
        crashPoint: round.crashPoint,
      });
      setResult(res.valid ? "Verified" : "Could not verify — open Fairness tab");
    } catch {
      setResult("Open Fairness tab for full verification");
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
          <button type="button" className="btn btn-outline btn-sm" onClick={handleVerify}>
            Quick check
          </button>
          {result && <p className="panel-hint">{result}</p>}
        </div>
      </div>
    </div>
  );
}
