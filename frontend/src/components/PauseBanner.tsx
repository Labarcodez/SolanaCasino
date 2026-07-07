interface PauseBannerProps {
  paused: boolean;
}

export function PauseBanner({ paused }: PauseBannerProps) {
  if (!paused) return null;

  return (
    <div className="pause-banner" role="alert">
      <span className="pause-banner-icon" aria-hidden="true">⏸</span>
      <span>
        Casino is temporarily paused. New bets are disabled until operations resume.
      </span>
    </div>
  );
}
