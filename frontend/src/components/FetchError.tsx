interface FetchErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function FetchError({
  message = "Failed to load data",
  onRetry,
}: FetchErrorProps) {
  return (
    <div className="fetch-error">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
