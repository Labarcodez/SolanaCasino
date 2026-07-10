interface RecentResult {
  id: string;
  label: string;
  variant: "win" | "loss" | "low" | "mid" | "high";
}

interface RecentResultsStripProps {
  title: string;
  results: RecentResult[];
  onSelect?: (id: string) => void;
}

export function RecentResultsStrip({
  title,
  results,
  onSelect,
}: RecentResultsStripProps) {
  if (results.length === 0) return null;

  return (
    <div className="recent-results-strip">
      <span className="recent-results-label">{title}</span>
      <div className="recent-results-pills">
        {results.map((r) => {
          const Tag = onSelect ? "button" : "span";
          return (
            <Tag
              key={r.id}
              type={onSelect ? "button" : undefined}
              className={`history-pill recent-pill ${r.variant}`}
              onClick={onSelect ? () => onSelect(r.id) : undefined}
            >
              {r.label}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

export function crashPointVariant(
  crashPoint: number,
): "low" | "mid" | "high" {
  if (crashPoint < 1.5) return "low";
  if (crashPoint < 3) return "mid";
  return "high";
}
