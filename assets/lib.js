// Pure, DOM-free logic for the directory page. Unit-tested in apps/web/test.

/** Mirrors INDUSTRY_LABELS in packages/shared/src/industries.ts (a test enforces this). */
export const INDUSTRY_LABELS = {
  banking: "Banking",
  insurance: "Insurance",
  "financial-services": "Financial Services",
  investment: "Investment",
  diversified: "Diversified Holdings",
  "hotels-leisure": "Hotels & Leisure",
  "plantations-agriculture": "Plantations & Agriculture",
  "food-beverage-tobacco": "Food, Beverage & Tobacco",
  "consumer-goods-retail": "Consumer Goods & Retail",
  "materials-chemicals": "Materials & Chemicals",
  "manufacturing-industrials": "Manufacturing & Industrials",
  "construction-engineering": "Construction & Engineering",
  automotive: "Automotive",
  energy: "Energy",
  "real-estate": "Real Estate",
  healthcare: "Healthcare",
  telecommunications: "Telecommunications",
  technology: "Technology",
  "apparel-textiles": "Apparel & Textiles",
  "logistics-shipping": "Logistics & Shipping",
  "media-printing": "Media & Printing",
  trading: "Trading",
  services: "Services",
};

export const ACCESS = /** @type {const} */ (["all", "careers", "website", "none"]);
export const LISTS = /** @type {const} */ (["all", "cse", "tech"]);
export const SORTS = /** @type {const} */ (["name", "industry"]);

export const DEFAULT_STATE = Object.freeze({ q: "", industry: "", access: "all", list: "all", group: "", sort: "name" });

export function industryLabel(slug) {
  return INDUSTRY_LABELS[slug] ?? slug;
}

/** The URL only if it is an absolute http(s) URL; anything else is never linked. */
export function safeUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** "https://www.keells.com/careers/" → "keells.com/careers" (for link text). */
export function displayUrl(value) {
  const href = safeUrl(value);
  if (!href) return "";
  const u = new URL(href);
  const path = (u.pathname + u.search).replace(/\/+$/, "");
  return u.hostname.replace(/^www\./, "") + path;
}

/** careers: a careers page is known; website: only a website; none: neither. */
export function accessOf(c) {
  if (safeUrl(c.careersUrl)) return "careers";
  if (safeUrl(c.website)) return "website";
  return "none";
}

export function fold(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Attach display/search fields once, after loading the data. */
export function prepare(companies, groups) {
  const groupNames = new Map(groups.map((g) => [g.slug, g.name]));
  return companies.map((c) => {
    const groupName = c.parentGroup ? (groupNames.get(c.parentGroup) ?? c.parentGroup) : "";
    const access = accessOf(c);
    const hay = fold(
      [c.name, c.cseSymbol, displayUrl(c.website), displayUrl(c.careersUrl), industryLabel(c.industry), groupName].join(" "),
    );
    return { ...c, groupName, access, hay };
  });
}

export function matches(c, state) {
  if (state.industry && c.industry !== state.industry) return false;
  if (state.group && c.parentGroup !== state.group) return false;
  if (state.access !== "all" && c.access !== state.access) return false;
  if (state.list !== "all" && !c.sourceLists.includes(state.list)) return false;
  const terms = fold(state.q).split(/\s+/).filter(Boolean);
  return terms.every((t) => c.hay.includes(t));
}

const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

export function filterAndSort(list, state) {
  const out = list.filter((c) => matches(c, state));
  if (state.sort === "industry") {
    out.sort((a, b) => industryLabel(a.industry).localeCompare(industryLabel(b.industry), "en") || byName(a, b));
  } else {
    out.sort(byName);
  }
  return out;
}

/** Read state from a query string, dropping anything invalid. */
export function parseState(search, { industries, groups }) {
  const p = new URLSearchParams(search);
  const pick = (key, allowed) => {
    const v = p.get(key);
    return v !== null && allowed.includes(v) ? v : DEFAULT_STATE[key];
  };
  return {
    q: (p.get("q") ?? "").slice(0, 200),
    industry: pick("industry", industries),
    access: pick("access", ACCESS),
    list: pick("list", LISTS),
    group: pick("group", groups),
    sort: pick("sort", SORTS),
  };
}

/** Query string for a state; defaults are omitted so the plain URL stays clean. */
export function serializeState(state) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    const val = k === "q" ? v.trim() : v;
    if (val && val !== DEFAULT_STATE[k]) p.set(k, val);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function summarize(list) {
  return {
    companies: list.length,
    careers: list.filter((c) => c.access === "careers").length,
    cse: list.filter((c) => c.sourceLists.includes("cse")).length,
    tech: list.filter((c) => c.sourceLists.includes("tech")).length,
    industries: new Set(list.map((c) => c.industry)).size,
  };
}

export function countBy(list, key) {
  const m = new Map();
  for (const c of list) {
    const k = c[key];
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
