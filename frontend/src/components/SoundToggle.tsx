interface SoundToggleProps {
  muted: boolean;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
}

export function SoundToggle({
  muted,
  volume,
  onToggle,
  onVolumeChange,
}: SoundToggleProps) {
  const volumePercent = Math.round(volume * 100);

  return (
    <div className="sound-control">
      <button
        type="button"
        className="sound-toggle"
        onClick={onToggle}
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      {!muted && (
        <label className="sound-volume-label">
          <span className="sr-only">Sound volume</span>
          <input
            type="range"
            className="sound-volume"
            min={0}
            max={100}
            step={5}
            value={volumePercent}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={volumePercent}
            title={`Volume ${volumePercent}%`}
          />
        </label>
      )}
    </div>
  );
}
