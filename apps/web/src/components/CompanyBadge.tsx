import { hue, initials } from "../lib/format";

/** Text/initials badge. Company logos are deliberately not used (opt-in only, per spec). */
export function CompanyBadge({ slug, name, size = "md" }: { slug: string; name: string; size?: "sm" | "md" | "lg" }) {
  const h = hue(slug);
  const dims = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-lg font-bold ${dims}`}
      style={{ backgroundColor: `hsl(${h} 55% 92%)`, color: `hsl(${h} 60% 25%)` }}
    >
      {initials(name)}
    </span>
  );
}
