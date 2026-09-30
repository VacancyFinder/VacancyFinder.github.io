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

export const FIELD_SLUGS = [...TECH_FIELD_SLUGS, ...EXTENDED_FIELD_SLUGS] as const;
export const FieldSlug = z.enum(FIELD_SLUGS);
export type FieldSlug = z.infer<typeof FieldSlug>;

export const FIELD_LABELS: Record<FieldSlug, string> = {
  "software-engineering": "Software Engineering",
  "data-ai-ml": "Data & AI / ML",
  "cloud-devops": "Cloud & DevOps",
  cybersecurity: "Cybersecurity",
  "qa-testing": "QA & Testing",
  "ui-ux-design": "UI/UX & Design",
  "digital-graphics": "Digital & Graphics",
  "human-resource": "Human Resource",
  "product-project-business": "Product, Project & Business",
  "finance-accounting": "Finance & Accounting",
  "banking-insurance": "Banking & Insurance",
  "sales-marketing": "Sales & Marketing",
  "hospitality-tourism": "Hospitality & Tourism",
  "engineering-manufacturing": "Engineering & Manufacturing",
  "operations-logistics": "Operations, Logistics & Supply Chain",
  healthcare: "Healthcare",
  "admin-customer-service": "Admin & Customer Service",
  "legal-compliance": "Legal & Compliance",
  other: "Other",
};

export const FIELD_DESCRIPTIONS: Record<FieldSlug, string> = {
  "software-engineering": "Web, mobile, backend, frontend, full-stack",
  "data-ai-ml": "Data science, ML, AI, analytics",
  "cloud-devops": "Cloud, DevOps, SRE, platform, automation",
  cybersecurity: "Security engineering, infosec, SOC, pentesting",
  "qa-testing": "QA, automation testing, quality engineering",
  "ui-ux-design": "UI, UX, product/interaction design, UX research",
  "digital-graphics": "Graphic design, video, digital content, creative",
  "human-resource": "HR, recruitment, talent acquisition, people ops",
  "product-project-business": "Product & project management, business analysis",
  "finance-accounting": "Accounting, audit, tax, finance",
  "banking-insurance": "Banking, credit, insurance, underwriting",
  "sales-marketing": "Sales, marketing, brand, business development",
  "hospitality-tourism": "Hotels, food & beverage, travel, tourism",
  "engineering-manufacturing": "Mechanical, electrical, civil, production",
  "operations-logistics": "Operations, logistics, supply chain, procurement",
  healthcare: "Medical, nursing, pharmacy, lab",
  "admin-customer-service": "Administration, front office, customer service",
  "legal-compliance": "Legal, compliance, risk, company secretarial",
  other: "Everything else",
};
