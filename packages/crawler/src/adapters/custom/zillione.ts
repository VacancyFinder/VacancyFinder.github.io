import type { AdapterFn, RawJob } from "../types.js";

/** ZILLIONe's careers page reads apisv1.zillione.com/api/careers (verified Sep 2026). */
interface ZilJob {
  id: number;
  title: string;
  category?: string;
  location?: string;
  responsibilities?: string[];
  idealCandidate?: string[];
  isActive?: boolean;
  createdAt?: string;
}

export function parseZillione(body: unknown): RawJob[] {
  const data = ((body as { data?: ZilJob[] })?.data ?? []).filter((j) => j && j.title && j.isActive !== false);
  return data.map((j) => ({
    title: j.title,
    url: `https://www.zillione.com/careers/apply?role=${encodeURIComponent(j.title)}&jobId=${j.id}`,
    location: j.location ?? null,
    description: [...(j.responsibilities ?? []), ...(j.idealCandidate ?? [])].join(" "),
    department: j.category ?? null,
    postedAt: j.createdAt ?? null,
  }));
}

export const zillione: AdapterFn = async (ctx) => {
  const r = await ctx.fetcher.get("https://apisv1.zillione.com/api/careers", { headers: { accept: "application/json" } });
  return { jobs: parseZillione(JSON.parse(r.text)) };
};
