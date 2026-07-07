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
      <div className="page-header-row">
        <h2 className="card-title">{title}</h2>
        {badge}
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
