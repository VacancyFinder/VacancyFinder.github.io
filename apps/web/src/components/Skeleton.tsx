/** Placeholder rows shown while jobs load, shaped like the real cards so nothing jumps. */
export function JobListSkeleton({
  rows = 5,
  label = "Loading jobs…",
  className = "",
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-label={label}>
      <ul className={`grid grid-cols-1 gap-3 ${className}`} aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="card flex min-h-[150px] gap-3 p-4">
            <span className="skeleton h-11 w-11 shrink-0 rounded-lg" />
            <span className="flex flex-1 flex-col gap-2 pt-1">
              <span className="skeleton h-4 w-2/3 rounded" />
              <span className="skeleton h-3 w-1/3 rounded" />
              <span className="skeleton mt-1 h-3 w-1/2 rounded" />
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <span className="skeleton block h-8 w-1/3 rounded" aria-hidden="true" />
      <span className="skeleton mt-3 block h-4 w-1/2 rounded" aria-hidden="true" />
      <div className="mt-6">
        <JobListSkeleton rows={3} label="Loading" />
      </div>
    </div>
  );
}
