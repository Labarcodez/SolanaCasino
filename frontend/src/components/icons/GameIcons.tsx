interface IconProps {
  size?: number;
  className?: string;
}

export function CrashIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 18 L12 6 L20 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

export function LimboIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 4 V2 M12 22 V20 M4 12 H2 M22 12 H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CoinflipIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3 C12 3 8 8 8 12 C8 16 12 21 12 21" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3 C12 3 16 8 16 12 C16 16 12 21 12 21" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

export function LeaderboardIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="12" width="5" height="9" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="9.5" y="6" width="5" height="15" rx="1" fill="currentColor" />
      <rect x="16" y="9" width="5" height="12" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function TournamentIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 9 H18 V11 C18 14 15.5 16 12 16 C8.5 16 6 14 6 11 V9 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 16 V19 M8 19 H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 5 H15 L14 9 H10 L9 5 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function FairnessIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3 L20 7 V12 C20 16.5 16.5 20 12 21 C7.5 20 4 16.5 4 12 V7 L12 3 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 12 L11 14 L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProfileIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20 C5 16 8 14 12 14 C16 14 19 16 19 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function WalletIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10 H21" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function AdminIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M4.9 19.1 L6.3 17.7 M17.7 6.3 L19.1 4.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const GAME_ICON_MAP = {
  crash: CrashIcon,
  limbo: LimboIcon,
  coinflip: CoinflipIcon,
  leaderboard: LeaderboardIcon,
  tournament: TournamentIcon,
  fairness: FairnessIcon,
  profile: ProfileIcon,
  wallet: WalletIcon,
  admin: AdminIcon,
} as const;

export type GameIconId = keyof typeof GAME_ICON_MAP;

export function GameIcon({ id, size, className }: { id: GameIconId; size?: number; className?: string }) {
  const Icon = GAME_ICON_MAP[id];
  return <Icon size={size} className={className} />;
}
