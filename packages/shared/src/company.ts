import { z } from "zod";
import { IndustrySlug } from "./industries.js";

export const ADAPTERS = [
  "lever",
  "greenhouse",
  "workable",
  "smartrecruiters",
  "teamtailor",
  "jsonld",
  "html",
  "custom",
  "none",
] as const;
export const Adapter = z.enum(ADAPTERS);
export type Adapter = z.infer<typeof Adapter>;

/**
 * ready            careers URL known AND adapter verified against the live page
 * needs-adapter    careers URL known, adapter not yet verified (added in M1 — see report)
 * needs-discovery  website known, careers page unknown → `pnpm discover`
 * needs-research   no website → manual work, never crawled
 * disabled         deliberately not crawled (see notes)
 */
export const CompanyStatus = z.enum([
  "ready",
  "needs-adapter",
  "needs-discovery",
  "needs-research",
  "disabled",
]);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

export const SourceList = z.enum(["tech", "cse"]);
export type SourceList = z.infer<typeof SourceList>;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case slug");

export const Company = z
  .object({
    slug,
    name: z.string().min(1),
    website: z.string().url().nullable(),
    careersUrl: z.string().url().nullable(),
    adapter: Adapter,
    adapterConfig: z.record(z.unknown()),
    industry: IndustrySlug,
    cseSymbol: z.string().regex(/^[A-Z0-9]+\.[A-Z]\d{4}$/).nullable(),
    parentGroup: slug.nullable(),
    sourceLists: z.array(SourceList).min(1),
    status: CompanyStatus,
    logo: z.string().optional(),
    active: z.boolean(),
    notes: z.string().optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.status === "ready" && (!c.careersUrl || c.adapter === "none")) {
      ctx.addIssue({ code: "custom", message: "ready requires careersUrl and an adapter other than 'none'" });
    }
    if (c.status === "needs-research" && c.website) {
      ctx.addIssue({ code: "custom", message: "needs-research implies no website" });
    }
  });
export type Company = z.infer<typeof Company>;

export const CompaniesFile = z.array(Company).superRefine((list, ctx) => {
  const seen = new Set<string>();
  for (const c of list) {
    if (seen.has(c.slug)) ctx.addIssue({ code: "custom", message: `duplicate slug ${c.slug}` });
    seen.add(c.slug);
  }
});

export const Group = z.object({ slug, name: z.string().min(1) }).strict();
export type Group = z.infer<typeof Group>;

export const CrawlTarget = z
  .object({
    id: slug,
    canonicalUrl: z.string().url(),
    adapter: Adapter,
    companySlugs: z.array(slug).min(1),
    parentGroup: slug.nullable(),
  })
  .strict();
export type CrawlTarget = z.infer<typeof CrawlTarget>;
