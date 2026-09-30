/** Stable kebab-case slug. Strips legal suffixes so "Hayleys PLC" → "hayleys". */
export function companySlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(plc|ltd|limited|pvt|\(pvt\)|private)\b\.?/gi, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug for a group derived from a shared domain: "keells.com" → "keells". */
export function groupSlugFromDomain(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return label.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Slug for a crawl target: "https://keells.com/careers" → "keells-com-careers". */
export function targetSlug(canonicalUrl: string): string {
  const u = new URL(canonicalUrl);
  return `${u.hostname}${u.pathname}${u.search}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STOP = new Set(["plc", "ltd", "the", "and", "of", "lanka", "sri", "ceylon", "holdings", "group", "company"]);

/** Meaningful name tokens, for disambiguating several companies on one domain. */
export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}
