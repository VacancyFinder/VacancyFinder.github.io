import {
  CAREER_PAGE_PLACEHOLDER,
  canonicalCareersUrl,
  domainOf,
  isHttpUrl,
  normaliseIndustry,
  ownerDomainOf,
  type Adapter,
  type Company,
  type CompanyStatus,
  type CrawlTarget,
  type CseSourceRecord,
  type Group,
  type IndustrySlug,
  type SourceList,
  type TechSourceRecord,
} from "@rekiya/shared";
import { groupName } from "./groups.js";
import { companySlug, groupSlugFromDomain, nameTokens, targetSlug } from "./slug.js";

export interface ImportInput {
  cse: CseSourceRecord[];
  tech: TechSourceRecord[];
  /** Current data/companies.json (may be empty on first run). */
  existing: Company[];
  /** Current data/groups.json (hand-edited names are preserved). */
  existingGroups: Group[];
}

export interface Overlap {
  tech: string;
  cse: string;
  symbol: string;
  domain: string;
}

export interface ImportReport {
  cse: {
    total: number;
    withCareersUrl: number;
    placeholder: number;
    otherInvalidCareersValue: string[];
    noWebsite: number;
    uniqueCareersUrls: number;
  };
  tech: { total: number; withWebsite: number };
  overlaps: Overlap[];
  ambiguousOverlaps: { tech: string; domain: string; candidates: string[] }[];
  unknownIndustries: { company: string; raw: string }[];
  groups: { slug: string; name: string; via: "careers" | "website"; members: string[] }[];
  crossDomainCareers: { company: string; website: string; careers: string }[];
  adapterConflicts: { target: string; adapters: string[] }[];
  preservedHandEdits: { company: string; field: string }[];
  statusCounts: Record<CompanyStatus, number>;
  discovery: { companies: number; uniqueDomains: number };
  totals: { companies: number; crawlTargets: number; groups: number };
}

export interface ImportResult {
  companies: Company[];
  groups: Group[];
  targets: CrawlTarget[];
  report: ImportReport;
}

/** Fields a human may edit in companies.json; re-import never overwrites them. */
const HAND_EDITED = ["adapter", "adapterConfig", "notes", "active"] as const;

interface Draft {
  slug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  industry: IndustrySlug;
  cseSymbol: string | null;
  sourceLists: Set<SourceList>;
  notes: string | undefined;
}

function cleanUrl(v: string | null | undefined): string | null {
  return isHttpUrl(v) ? v.trim() : null;
}

export function importCompanies(input: ImportInput): ImportResult {
  const report: ImportReport = {
    cse: {
      total: input.cse.length,
      withCareersUrl: 0,
      placeholder: 0,
      otherInvalidCareersValue: [],
      noWebsite: 0,
      uniqueCareersUrls: 0,
    },
    tech: { total: input.tech.length, withWebsite: 0 },
    overlaps: [],
    ambiguousOverlaps: [],
    unknownIndustries: [],
    groups: [],
    crossDomainCareers: [],
    adapterConflicts: [],
    preservedHandEdits: [],
    statusCounts: { ready: 0, "needs-adapter": 0, "needs-discovery": 0, "needs-research": 0, disabled: 0 },
    discovery: { companies: 0, uniqueDomains: 0 },
    totals: { companies: 0, crawlTargets: 0, groups: 0 },
  };

  // ---- 1. CSE drafts --------------------------------------------------------
  const drafts: Draft[] = [];
  const careersSet = new Set<string>();
  for (const r of input.cse) {
    const careers = cleanUrl(r.career_page);
    if (careers) {
      report.cse.withCareersUrl++;
      careersSet.add(canonicalCareersUrl(careers));
    } else if (r.career_page.trim() === CAREER_PAGE_PLACEHOLDER) {
      report.cse.placeholder++;
    } else {
      report.cse.otherInvalidCareersValue.push(`${r.symbol}: ${JSON.stringify(r.career_page)}`);
    }
    const website = cleanUrl(r.website);
    if (!website) report.cse.noWebsite++;

    const industry = normaliseIndustry(r.industry);
    if (!industry) report.unknownIndustries.push({ company: r.company_name, raw: r.industry });

    drafts.push({
      slug: companySlug(r.company_name),
      name: r.company_name.trim(),
      website,
      careersUrl: careers,
      // Unknown industries are reported and fail the CLI; "services" only keeps types sound here.
      industry: industry ?? "services",
      cseSymbol: r.symbol,
      sourceLists: new Set<SourceList>(["cse"]),
      notes: undefined,
    });
  }
  report.cse.uniqueCareersUrls = careersSet.size;

  // ---- 2. Merge tech list by DOMAIN (never by name alone) -------------------
  // Shared hosts (job boards, ATS vendors) are ignored: they prove nothing about ownership.
  const byDomain = new Map<string, Draft[]>();
  for (const d of drafts) {
    for (const dom of new Set([ownerDomainOf(d.website), ownerDomainOf(d.careersUrl)])) {
      if (!dom) continue;
      const list = byDomain.get(dom) ?? [];
      list.push(d);
      byDomain.set(dom, list);
    }
  }

  for (const t of input.tech) {
    const website = cleanUrl(t.website);
    if (website) report.tech.withWebsite++;
    const dom = ownerDomainOf(website) ?? ownerDomainOf(t.careersUrl);
    const candidates = dom ? (byDomain.get(dom) ?? []) : [];

    let match: Draft | undefined;
    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1) {
      // Several CSE companies share the domain (e.g. Dialog Axiata + Dialog Finance):
      // pick the one sharing the MOST name tokens; a tie is ambiguous.
      const tt = nameTokens(t.name);
      const scored = candidates
        .map((c) => ({ c, score: [...nameTokens(c.name)].filter((x) => tt.has(x)).length }))
        .sort((a, b) => b.score - a.score);
      const [best, second] = scored;
      if (best && best.score > 0 && (!second || best.score > second.score)) match = best.c;
      else
        report.ambiguousOverlaps.push({
          tech: t.name,
          domain: dom ?? "",
          candidates: candidates.map((c) => c.name),
        });
    }

    if (match) {
      match.sourceLists.add("tech");
      match.careersUrl ??= cleanUrl(t.careersUrl);
      match.website ??= website;
      if (t.notes) match.notes = t.notes;
      report.overlaps.push({ tech: t.name, cse: match.name, symbol: match.cseSymbol ?? "", domain: dom ?? "" });
    } else {
      // No overlap (or an ambiguous one): keep as its own tech entry.
      const ambiguous = candidates.length > 1;
      drafts.push({
        slug: companySlug(t.name),
        name: t.name,
        website,
        careersUrl: cleanUrl(t.careersUrl),
        industry: "technology",
        cseSymbol: null,
        sourceLists: new Set<SourceList>(["tech"]),
        notes: ambiguous ? [t.notes, "Ambiguous domain overlap with CSE list — resolve by hand."].filter(Boolean).join(" ") : t.notes,
      });
    }
  }

  // ---- 3. Carry over hand-edited values from existing companies.json -------
  const existingBySymbol = new Map(input.existing.filter((c) => c.cseSymbol).map((c) => [c.cseSymbol!, c]));
  const existingBySlug = new Map(input.existing.map((c) => [c.slug, c]));
  // Tech-only entries have no symbol; their name is the stable key (two names may share a slug).
  const existingTechByName = new Map(input.existing.filter((c) => !c.cseSymbol).map((c) => [c.name.trim().toLowerCase(), c]));
  // Resolved once, before any slug is changed, so later lookups cannot drift.
  const prevOf = new Map<Draft, Company>();
  const claimed = new Set<Company>();
  for (const d of drafts) {
    const prev =
      (d.cseSymbol ? existingBySymbol.get(d.cseSymbol) : existingTechByName.get(d.name.trim().toLowerCase())) ?? existingBySlug.get(d.slug);
    // Never let two drafts inherit the same existing record.
    if (prev && !claimed.has(prev)) {
      prevOf.set(d, prev);
      claimed.add(prev);
    }
  }
  const findExisting = (d: Draft): Company | undefined => prevOf.get(d);

  for (const d of drafts) {
    const prev = findExisting(d);
    if (!prev) continue;
    d.slug = prev.slug; // slugs are stable once written
    // A careers URL / website added by hand (e.g. an approved discovery PR) is never
    // wiped by a source list that still has the placeholder or an empty value.
    if (prev.careersUrl && prev.careersUrl !== d.careersUrl) {
      if (d.careersUrl) report.preservedHandEdits.push({ company: prev.slug, field: "careersUrl" });
      d.careersUrl = prev.careersUrl;
    }
    if (prev.website && prev.website !== d.website) {
      if (d.website) report.preservedHandEdits.push({ company: prev.slug, field: "website" });
      d.website = prev.website;
    }
    for (const s of prev.sourceLists) d.sourceLists.add(s);
  }

  // Guard against slug collisions between distinct companies.
  const slugCount = new Map<string, number>();
  for (const d of drafts) slugCount.set(d.slug, (slugCount.get(d.slug) ?? 0) + 1);
  for (const d of drafts) {
    if ((slugCount.get(d.slug) ?? 0) > 1 && d.cseSymbol && !findExisting(d)) {
      d.slug = `${d.slug}-${d.cseSymbol.split(".")[0]!.toLowerCase()}`;
    }
  }
  // Anything still colliding (e.g. two tech names with one slug) gets a numeric suffix.
  // Slugs inherited from companies.json are reserved first so they never move.
  const taken = new Set(drafts.filter((d) => findExisting(d)).map((d) => d.slug));
  for (const d of drafts) {
    if (findExisting(d)) continue;
    let slug = d.slug;
    for (let n = 2; taken.has(slug); n++) slug = `${d.slug}-${n}`;
    d.slug = slug;
    taken.add(slug);
  }

  // ---- 4. Derive parent groups (shared careers domain, else shared website) -
  const parentOf = new Map<Draft, string>();
  const groupVia = new Map<string, "careers" | "website">();
  const bucket = (key: (d: Draft) => string | null) => {
    const m = new Map<string, Draft[]>();
    for (const d of drafts) {
      const k = key(d);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return m;
  };
  for (const [dom, members] of bucket((d) => ownerDomainOf(d.careersUrl))) {
    if (members.length < 2) continue;
    const g = groupSlugFromDomain(dom);
    groupVia.set(g, "careers");
    for (const m of members) parentOf.set(m, g);
  }
  for (const [dom, members] of bucket((d) => ownerDomainOf(d.website))) {
    const ungrouped = members.filter((m) => !parentOf.has(m));
    if (members.length < 2 || ungrouped.length === 0) continue;
    const g = groupSlugFromDomain(dom);
    if (!groupVia.has(g)) groupVia.set(g, "website");
    for (const m of ungrouped) parentOf.set(m, g);
  }

  // ---- 5. Build final Company records --------------------------------------
  const companies: Company[] = drafts.map((d) => {
    const prev = findExisting(d);
    const adapter: Adapter = prev?.adapter ?? "none";
    let status: CompanyStatus;
    if (prev?.status === "disabled") status = "disabled";
    else if (d.careersUrl) status = adapter === "none" ? "needs-adapter" : "ready";
    else if (d.website) status = "needs-discovery";
    else status = "needs-research";

    const base: Company = {
      slug: d.slug,
      name: d.name,
      website: d.website,
      careersUrl: d.careersUrl,
      adapter,
      adapterConfig: prev?.adapterConfig ?? {},
      industry: d.industry,
      cseSymbol: d.cseSymbol,
      parentGroup: prev?.parentGroup ?? parentOf.get(d) ?? null,
      sourceLists: (["tech", "cse", "community"] as const).filter((s) => d.sourceLists.has(s)),
      status,
      active: prev?.active ?? true,
    };
    const notes = prev?.notes ?? d.notes;
    if (notes) base.notes = notes;
    if (prev?.logo) base.logo = prev.logo;
    if (prev) {
      for (const f of HAND_EDITED) {
        if (f === "notes" && d.notes && prev.notes && d.notes !== prev.notes) {
          report.preservedHandEdits.push({ company: d.slug, field: f });
        }
      }
    }

    const wd = domainOf(d.website);
    const cd = domainOf(d.careersUrl);
    if (wd && cd && wd !== cd) {
      report.crossDomainCareers.push({ company: d.slug, website: wd, careers: cd });
    }
    return base;
  });
  // Community entries (added by hand / issue form) are in no source list: keep them, recomputing status.
  const produced = new Set(companies.map((c) => c.slug));
  for (const prev of input.existing) {
    if (produced.has(prev.slug) || !prev.sourceLists.includes("community")) continue;
    let status: CompanyStatus;
    if (prev.status === "disabled") status = "disabled";
    else if (prev.careersUrl) status = prev.adapter === "none" ? "needs-adapter" : "ready";
    else if (prev.website) status = "needs-discovery";
    else status = "needs-research";
    companies.push({ ...prev, status });
    produced.add(prev.slug);
  }
  companies.sort((a, b) => a.slug.localeCompare(b.slug));

  // ---- 6. Groups -----------------------------------------------------------
  const prevGroupNames = new Map(input.existingGroups.map((g) => [g.slug, g.name]));
  const usedGroups = new Set(companies.map((c) => c.parentGroup).filter((g): g is string => !!g));
  const groups: Group[] = [...usedGroups].sort().map((slug) => ({ slug, name: prevGroupNames.get(slug) ?? groupName(slug) }));
  for (const g of groups) {
    report.groups.push({
      slug: g.slug,
      name: g.name,
      via: groupVia.get(g.slug) ?? "website",
      members: companies.filter((c) => c.parentGroup === g.slug).map((c) => c.slug),
    });
  }

  // ---- 7. Crawl targets: one per canonical careers URL ---------------------
  const targetMap = new Map<string, Company[]>();
  for (const c of companies) {
    if (!c.careersUrl || !c.active) continue;
    if (c.status === "disabled" || c.status === "needs-research") continue;
    const key = canonicalCareersUrl(c.careersUrl);
    targetMap.set(key, [...(targetMap.get(key) ?? []), c]);
  }
  const targets: CrawlTarget[] = [...targetMap.entries()]
    .map(([canonicalUrl, members]) => {
      const adapters = [...new Set(members.map((m) => m.adapter))];
      const known = adapters.filter((a) => a !== "none");
      let adapter: Adapter = "none";
      if (known.length === 1) adapter = known[0]!;
      else if (known.length > 1) report.adapterConflicts.push({ target: canonicalUrl, adapters: known });
      const groupsHere = [...new Set(members.map((m) => m.parentGroup))];
      return {
        id: targetSlug(canonicalUrl),
        canonicalUrl,
        adapter,
        companySlugs: members.map((m) => m.slug).sort(),
        parentGroup: members.length > 1 && groupsHere.length === 1 ? (groupsHere[0] ?? null) : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  // ---- 8. Totals -----------------------------------------------------------
  for (const c of companies) report.statusCounts[c.status]++;
  const disc = companies.filter((c) => c.status === "needs-discovery");
  report.discovery.companies = disc.length;
  report.discovery.uniqueDomains = new Set(disc.map((c) => domainOf(c.website))).size;
  report.totals = { companies: companies.length, crawlTargets: targets.length, groups: groups.length };

  return { companies, groups, targets, report };
}
