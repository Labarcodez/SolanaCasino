export function PageHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <h2 className="card-title">{title}</h2>
        <div className="page-header-actions">
          {action}
          {badge}
        </div>
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
