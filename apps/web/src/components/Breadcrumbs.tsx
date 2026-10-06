import { Link } from "react-router-dom";

/** Same markup as the prerendered breadcrumb (build/seo.ts `crumbs`), so the page doesn't move when the app loads. */
export function Breadcrumbs({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-600 dark:text-slate-400">
      <ol className="flex flex-wrap gap-1">
        {items.map(([name, path], i) =>
          i < items.length - 1 ? (
            <li key={path}>
              <Link to={path} className="link">
                {name}
              </Link>{" "}
              /
            </li>
          ) : (
            <li key={path} aria-current="page">
              {name}
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}
