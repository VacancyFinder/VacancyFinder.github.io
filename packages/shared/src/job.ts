import { z } from "zod";
import { FieldSlug } from "./fields.js";
import { IndustrySlug } from "./industries.js";

export const SENIORITIES = ["intern", "trainee", "junior", "mid", "senior", "lead", "manager", "principal", "unspecified"] as const;
export const Seniority = z.enum(SENIORITIES);
export type Seniority = z.infer<typeof Seniority>;

export const JOB_TYPES = ["full-time", "part-time", "contract", "internship", "unspecified"] as const;
export const JobType = z.enum(JOB_TYPES);
export type JobType = z.infer<typeof JobType>;

export const WORK_MODES = ["onsite", "hybrid", "remote", "unspecified"] as const;
export const WorkMode = z.enum(WORK_MODES);
export type WorkMode = z.infer<typeof WorkMode>;

export const SNIPPET_MAX = 300;
const isoDateTime = z.string().datetime({ offset: true });
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const Job = z
  .object({
    /** sha1(company + canonical listing URL) */
    id: z.string().regex(/^[0-9a-f]{40}$/),
    title: z.string().min(1).max(300),
    /** companySlug, or the parentGroup slug for jobs from a shared group page */
    company: slug,
    industry: IndustrySlug,
    fields: z.array(FieldSlug),
    seniority: Seniority,
    type: JobType,
    workMode: WorkMode,
    location: z.string().max(200),
    snippet: z.string().max(SNIPPET_MAX),
    url: z.string().url(),
    source: z.string().min(1),
    postedAt: z.string().date().nullable(),
    firstSeenAt: isoDateTime,
    lastSeenAt: isoDateTime,
    status: z.enum(["open", "closed"]),
    missedRuns: z.number().int().min(0),
    closedAt: isoDateTime.nullable(),
  })
  .strict();
export type Job = z.infer<typeof Job>;

export const JobsFile = z.array(Job).superRefine((list, ctx) => {
  const seen = new Set<string>();
  for (const j of list) {
    if (seen.has(j.id)) ctx.addIssue({ code: "custom", message: `duplicate job id ${j.id}` });
    seen.add(j.id);
  }
});

export const HealthEntry = z
  .object({
    target: z.string(),
    url: z.string().url(),
    adapter: z.string(),
    companies: z.array(slug),
    lastRunAt: isoDateTime.nullable(),
    lastSuccessAt: isoDateTime.nullable(),
    lastError: z.string().nullable(),
    consecutiveFailures: z.number().int().min(0),
    jobCount: z.number().int().min(0),
    suspect: z.boolean(),
  })
  .strict();
export type HealthEntry = z.infer<typeof HealthEntry>;
export const HealthFile = z.record(HealthEntry);
export type HealthFile = z.infer<typeof HealthFile>;

export const Meta = z
  .object({
    generatedAt: isoDateTime,
    runDurationMs: z.number().int().min(0),
    totals: z.object({ open: z.number().int(), companiesWithJobs: z.number().int(), targets: z.number().int(), targetsOk: z.number().int() }),
    byField: z.record(z.number().int()),
    byCompany: z.record(z.number().int()),
    bySeniority: z.record(z.number().int()),
    byIndustry: z.record(z.number().int()),
  })
  .strict();
export type Meta = z.infer<typeof Meta>;

export const ChangeEntry = z.object({ id: z.string(), title: z.string(), company: z.string(), url: z.string().url() }).strict();
export const ChangesRun = z.object({ at: isoDateTime, added: z.array(ChangeEntry), closed: z.array(ChangeEntry) }).strict();
export const ChangesFile = z.array(ChangesRun);
export type ChangesRun = z.infer<typeof ChangesRun>;

const JobPatch = Job.omit({ id: true }).partial();
export const Overrides = z
  .object({
    jobs: z.record(JobPatch),
    titlePatterns: z.array(z.object({ match: z.string().min(1), flags: z.string().optional(), set: JobPatch }).strict()),
  })
  .strict();
export type Overrides = z.infer<typeof Overrides>;
