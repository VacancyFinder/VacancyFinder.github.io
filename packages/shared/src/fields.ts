import { z } from "zod";

export const TECH_FIELD_SLUGS = [
  "software-engineering",
  "data-ai-ml",
  "cloud-devops",
  "cybersecurity",
  "qa-testing",
  "ui-ux-design",
  "digital-graphics",
  "human-resource",
  "product-project-business",
] as const;

export const EXTENDED_FIELD_SLUGS = [
  "finance-accounting",
  "banking-insurance",
  "sales-marketing",
  "hospitality-tourism",
  "engineering-manufacturing",
  "operations-logistics",
  "healthcare",
  "admin-customer-service",
  "legal-compliance",
  "other",
] as const;

export const FieldSlug = z.enum([...TECH_FIELD_SLUGS, ...EXTENDED_FIELD_SLUGS]);
export type FieldSlug = z.infer<typeof FieldSlug>;
