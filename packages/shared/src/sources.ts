import { z } from "zod";

/** One record of data/sources/cse_listed_companies_career_pages.json */
export const CseSourceRecord = z
  .object({
    company_name: z.string().min(1),
    symbol: z.string().regex(/^[A-Z0-9]+\.[A-Z]\d{4}$/),
    website: z.string(),
    career_page: z.string(),
    industry: z.string().min(1),
  })
  .strict();
export type CseSourceRecord = z.infer<typeof CseSourceRecord>;
export const CseSourceFile = z.array(CseSourceRecord);

/** One record of data/sources/tech_companies.json (hand-curated) */
export const TechSourceRecord = z
  .object({
    name: z.string().min(1),
    website: z.string().url().nullable(),
    careersUrl: z.string().url().nullable(),
    notes: z.string().optional(),
  })
  .strict();
export type TechSourceRecord = z.infer<typeof TechSourceRecord>;
export const TechSourceFile = z.array(TechSourceRecord);
