import type { AdapterFn, RawJob } from "../types.js";

/**
 * Rootcode's careers page is filled from its own JSON endpoint (rootcode.ai/api/jobs, verified Sep 2026).
 * Listing URLs follow the site's pattern /careers/<slugified title>-<id>.
 */
interface RootcodeJob {
  id: number;
  position_name: string;
  description?: string;
  location_display?: string;
  city?: string;
  country?: string;
  is_remote?: boolean;
  contract_details?: string;
  organization_name?: string;
}

export function rootcodeUrl(j: Pick<RootcodeJob, "id" | "position_name">): string {
  return `https://rootcode.ai/careers/${j.position_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${j.id}`;
}

export function parseRootcode(body: unknown): RawJob[] {
  const results = ((body as { results?: RootcodeJob[] })?.results ?? []).filter((j) => j && j.position_name);
  return results.map((j) => ({
    title: j.position_name,
    url: rootcodeUrl(j),
    location: j.location_display || [j.city, j.country].filter(Boolean).join(", ") || null,
    description: j.description ?? null,
    employmentType: j.contract_details ?? null,
    workplace: j.is_remote ? "Remote" : null,
    department: j.organization_name ?? null,
  }));
}

export const rootcode: AdapterFn = async (ctx) => {
  let url: string | null = typeof ctx.config.api === "string" ? ctx.config.api : "https://rootcode.ai/api/jobs";
  const jobs: RawJob[] = [];
  for (let page = 0; url && page < 10; page++) {
    const r = await ctx.fetcher.get(url, { headers: { accept: "application/json" } });
    const body = JSON.parse(r.text) as { next?: string | null };
    jobs.push(...parseRootcode(body));
    url = body.next ?? null;
  }
  return { jobs };
};
