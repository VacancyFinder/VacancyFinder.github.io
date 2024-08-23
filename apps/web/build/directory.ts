import type { Company, CompanyStatus, Group, HealthFile, IndustrySlug, SourceList } from "@rekiya/shared";

/** What the web app needs to know about a company (a compact projection of companies.json + health.json). */
export interface DirectoryCompany {
  slug: string;
  name: string;
  industry: IndustrySlug;
  cseSymbol: string | null;
  parentGroup: string | null;
  sourceLists: SourceList[];
  status: CompanyStatus;
  active: boolean;
  website: string | null;
  careersUrl: string | null;
  /** Crawl health of the page this company is read from, if it is crawled. */
  health: { ok: boolean; lastSuccessAt: string | null; consecutiveFailures: number } | null;
}

export interface Directory {
  groups: Group[];
  companies: DirectoryCompany[];
}

export function buildDirectory(companies: Company[], groups: Group[], health: HealthFile): Directory {
  const healthOf = new Map<string, HealthFile[string]>();
  for (const h of Object.values(health)) for (const slug of h.companies) healthOf.set(slug, h);
  return {
    groups,
    companies: companies.map((c) => {
      const h = healthOf.get(c.slug);
      return {
        slug: c.slug,
        name: c.name,
        industry: c.industry,
        cseSymbol: c.cseSymbol,
        parentGroup: c.parentGroup,
        sourceLists: c.sourceLists,
        status: c.status,
        active: c.active,
        website: c.website,
        careersUrl: c.careersUrl,
        health:
          h && h.lastRunAt
            ? { ok: h.consecutiveFailures === 0 && !h.suspect, lastSuccessAt: h.lastSuccessAt, consecutiveFailures: h.consecutiveFailures }
            : null,
      };
    }),
  };
}
