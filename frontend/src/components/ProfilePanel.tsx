import { useState } from "react";
import type { UserProfile } from "../lib/api";
import {
  updateProfile,
  formatSol,
  claimRakeback,
  claimAffiliate,
} from "../lib/api";
import { shortenAddress, solscanTxUrl } from "../lib/utils";
import { authProviderLabel } from "../lib/avatar";
import { ProfileAvatar } from "./ProfileAvatar";
import { useToast } from "./ui/Toast";
import { useCasino } from "../hooks/CasinoUserProvider";

interface ProfilePanelProps {
  profile: UserProfile;
  onUpdated: (profile: UserProfile) => void;
  onClose?: () => void;
}

const VIP_COLORS: Record<string, string> = {
  none: "var(--text-muted)",
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  orbit: "var(--solana-green)",
};

export function ProfilePanel({ profile, onUpdated, onClose }: ProfilePanelProps) {
  const { toast } = useToast();
  const { refresh } = useCasino();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimingAffiliate, setClaimingAffiliate] = useState(false);

  const handleSave = async () => {
    if (displayName.trim() === profile.displayName) return;
    setSaving(true);
    try {
      const updated = await updateProfile(displayName.trim());
      onUpdated({
        ...profile,
        displayName: updated.displayName,
        email: updated.email,
        authProvider: updated.authProvider,
      });
      toast("Profile updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClaimRakeback = async () => {
    setClaiming(true);
    try {
      const result = await claimRakeback();
      await refresh();
      onUpdated({
        ...profile,
        balanceSol: result.balanceSol ?? profile.balanceSol,
        rakebackPendingSol: 0,
      });
      toast(`Claimed ${formatSol(result.claimedSol)} SOL rakeback`, "success", result.signature
        ? { label: "View tx", href: solscanTxUrl(result.signature) }
        : undefined);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Claim failed", "error");
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimAffiliate = async () => {
    setClaimingAffiliate(true);
    try {
      const result = await claimAffiliate();
      await refresh();
      onUpdated({
        ...profile,
        balanceSol: result.balanceSol ?? profile.balanceSol,
      });
      toast(`Claimed ${formatSol(result.claimedSol)} SOL commission`, "success", result.signature
        ? { label: "View tx", href: solscanTxUrl(result.signature) }
        : undefined);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Claim failed", "error");
    } finally {
      setClaimingAffiliate(false);
    }
  };

  const copyReferral = () => {
    if (!profile.referralLink) return;
    void navigator.clipboard.writeText(profile.referralLink);
    toast("Referral link copied", "success");
  };

  const netPnl = profile.netPnlSol ?? profile.totalWonSol - profile.totalWageredSol;
  const vipColor = VIP_COLORS[profile.vipTier ?? "none"] ?? VIP_COLORS.none;
  const pendingAffiliate = profile.pendingCommissionSol ?? 0;

  return (
    <div className="card profile-panel">
      <div className="profile-panel-header">
        <ProfileAvatar
          seed={profile.walletAddress}
          name={profile.displayName}
          size="lg"
        />
        <div>
          <h3 className="card-title">{profile.displayName}</h3>
          <p className="profile-auth-badge">
            Signed in via {authProviderLabel(profile.authProvider)}
          </p>
          {profile.vipLabel && profile.vipTier !== "none" && (
            <span className="vip-badge" style={{ borderColor: vipColor, color: vipColor }}>
              {profile.vipLabel} · {profile.vipRakebackPercent}% rakeback
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close profile"
          >
            ✕
          </button>
        )}
      </div>

      <div className="profile-stats">
        <div className="stat-box">
          <div className="label">Balance</div>
          <div className="value text-success">{formatSol(profile.balanceSol)} SOL</div>
        </div>
        <div className="stat-box">
          <div className="label">Net PnL</div>
          <div className={`value ${netPnl >= 0 ? "text-success" : "text-danger"}`}>
            {netPnl >= 0 ? "+" : ""}{formatSol(netPnl)} SOL
          </div>
        </div>
        <div className="stat-box">
          <div className="label">30d wagered</div>
          <div className="value">{formatSol(profile.wagered30dSol ?? 0)} SOL</div>
        </div>
      </div>

      {(profile.rakebackPendingSol ?? 0) > 0 && (
        <div className="rakeback-claim-box">
          <div>
            <strong>{formatSol(profile.rakebackPendingSol!)} SOL</strong> rakeback pending
          </div>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleClaimRakeback}
            disabled={claiming}
          >
            {claiming ? "Claiming..." : "Claim"}
          </button>
        </div>
      )}

      {profile.nextVipTier && profile.nextVipWagerSol && (
        <p className="panel-hint">
          {(profile.wagered30dSol ?? 0).toFixed(2)} / {profile.nextVipWagerSol} SOL to{" "}
          {profile.nextVipTier} VIP
        </p>
      )}

      {profile.referralCode && (
        <div className="affiliate-box">
          <h4 className="affiliate-title">Refer & earn 30% of house edge</h4>
          <div className="affiliate-code-row">
            <code className="affiliate-code">{profile.referralCode}</code>
            <button type="button" className="btn btn-outline btn-sm" onClick={copyReferral}>
              Copy link
            </button>
          </div>
          <p className="panel-hint">
            {profile.referredCount ?? 0} players referred
            {pendingAffiliate > 0 && (
              <> · {formatSol(pendingAffiliate)} SOL claimable</>
            )}
          </p>
          {pendingAffiliate >= 0.001 && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              style={{ marginTop: 8 }}
              onClick={handleClaimAffiliate}
              disabled={claimingAffiliate}
            >
              {claimingAffiliate ? "Claiming..." : `Claim ${formatSol(pendingAffiliate)} SOL`}
            </button>
          )}
        </div>
      )}

      <div className="profile-form">
        <div className="input-group">
          <label htmlFor="profile-display-name">Display name</label>
          <input
            id="profile-display-name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={24}
          />
        </div>

        <div className="input-group">
          <label htmlFor="profile-wallet">Wallet address</label>
          <input id="profile-wallet" className="input mono-cell" value={profile.walletAddress} readOnly />
        </div>

        {profile.email && (
          <div className="input-group">
            <label htmlFor="profile-email">Email</label>
            <input id="profile-email" className="input" value={profile.email} readOnly />
          </div>
        )}

        <p className="panel-hint">
          {shortenAddress(profile.walletAddress, 6)}
          {profile.memberSince && (
            <> · Member since {new Date(profile.memberSince).toLocaleDateString()}</>
          )}
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || displayName.trim() === profile.displayName}
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
