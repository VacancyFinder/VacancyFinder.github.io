import type { FieldSlug, IndustrySlug, JobType, Seniority, WorkMode } from "@rekiya/shared/constants";

/** Mirrors the Job schema in @rekiya/shared (types only, so zod stays out of the bundle). */
export interface Job {
  id: string;
  title: string;
  company: string;
  industry: IndustrySlug;
  fields: FieldSlug[];
  seniority: Seniority;
  type: JobType;
  workMode: WorkMode;
  location: string;
  snippet: string;
  url: string;
  source: string;
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  status: "open" | "closed";
  missedRuns: number;
  closedAt: string | null;
}

export interface Meta {
  generatedAt: string;
  runDurationMs: number;
  totals: { open: number; companiesWithJobs: number; targets: number; targetsOk: number };
  byField: Record<string, number>;
  byCompany: Record<string, number>;
  bySeniority: Record<string, number>;
  byIndustry: Record<string, number>;
}

export type CompanyStatus = "ready" | "needs-adapter" | "needs-discovery" | "needs-research" | "disabled";

export interface DirectoryCompany {
  slug: string;
  name: string;
  industry: IndustrySlug;
  cseSymbol: string | null;
  parentGroup: string | null;
  sourceLists: ("tech" | "cse")[];
  status: CompanyStatus;
  active: boolean;
  website: string | null;
  careersUrl: string | null;
  health: { ok: boolean; lastSuccessAt: string | null; consecutiveFailures: number } | null;
}

export interface Group {
  slug: string;
  name: string;
}

export interface Directory {
  groups: Group[];
  companies: DirectoryCompany[];
}

/** A company or a parent group — whatever a job's `company` field names. */
export interface Employer {
  slug: string;
  name: string;
  cseSymbol: string | null;
  isGroup: boolean;
}
