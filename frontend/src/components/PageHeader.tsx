import { BRAND } from "../lib/brand";

export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 className="card-title" style={{ margin: 0 }}>{title}</h2>
        {badge}
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export { BRAND };
