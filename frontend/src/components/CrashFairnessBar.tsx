import { useState } from "react";
import { verifyCrashFairness } from "../lib/api";
import { shortenAddress } from "../lib/utils";

interface CrashFairnessBarProps {
  roundId?: string;
  serverSeedHash?: string;
  serverSeed?: string;
  crashPoint?: number;
  phase: string;
}

export function CrashFairnessBar({
  roundId,
  serverSeedHash,
  serverSeed,
  crashPoint,
  phase,
}: CrashFairnessBarProps) {
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  if (!serverSeedHash) return null;

  const handleVerify = async () => {
    if (!serverSeed || !roundId || !crashPoint) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyCrashFairness({
        serverSeed,
        serverSeedHash,
        roundId,
        crashPoint,
      });
      setVerifyResult(res.valid ? "Verified ✓" : "Failed ✗");
    } catch {
      setVerifyResult("Error");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="crash-fairness-bar">
      <div className="crash-fairness-row">
        <span className="crash-fairness-label">Round</span>
        <span className="crash-fairness-value mono-cell">
          #{roundId ? shortenAddress(roundId, 6) : "—"}
        </span>
      </div>
      <div className="crash-fairness-row">
        <span className="crash-fairness-label">
          {phase === "crashed" ? "Seed" : "Hash"}
        </span>
        <span className="crash-fairness-value mono-cell" title={serverSeed ?? serverSeedHash}>
          {phase === "crashed" && serverSeed
            ? shortenAddress(serverSeed, 8)
            : shortenAddress(serverSeedHash, 8)}
        </span>
      </div>
      {phase === "crashed" && serverSeed && (
        <button
          type="button"
          className="btn btn-outline btn-sm crash-fairness-verify"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? "..." : verifyResult ?? "Verify"}
        </button>
      )}
    </div>
  );
}
