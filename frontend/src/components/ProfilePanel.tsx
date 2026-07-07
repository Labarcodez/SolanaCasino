import { useState } from "react";
import type { UserProfile } from "../lib/api";
import { updateProfile, formatSol } from "../lib/api";
import { shortenAddress } from "../lib/utils";
import { authProviderLabel } from "../lib/avatar";
import { ProfileAvatar } from "./ProfileAvatar";
import { useToast } from "./ui/Toast";

interface ProfilePanelProps {
  profile: UserProfile;
  onUpdated: (profile: UserProfile) => void;
  onClose?: () => void;
}

export function ProfilePanel({ profile, onUpdated, onClose }: ProfilePanelProps) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [saving, setSaving] = useState(false);

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
        </div>
        {onClose && (
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="profile-stats">
        <div className="stat-box">
          <div className="label">Casino balance</div>
          <div className="value text-success">{formatSol(profile.balanceSol)} SOL</div>
        </div>
        <div className="stat-box">
          <div className="label">Total wagered</div>
          <div className="value">{formatSol(profile.totalWageredSol)} SOL</div>
        </div>
        <div className="stat-box">
          <div className="label">Total won</div>
          <div className="value text-success">{formatSol(profile.totalWonSol)} SOL</div>
        </div>
      </div>

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
          <label>Wallet address</label>
          <input
            className="input mono-cell"
            value={profile.walletAddress}
            readOnly
          />
        </div>

        {profile.email && (
          <div className="input-group">
            <label>Email</label>
            <input className="input" value={profile.email} readOnly />
          </div>
        )}

        <p className="panel-hint">
          Public address: {shortenAddress(profile.walletAddress, 6)}
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
