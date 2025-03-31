/**
 * Plain constants with no runtime dependencies, safe to import in the browser bundle
 * (`@rekiya/shared/constants`). The zod schemas build on these.
 */
export const INDUSTRY_SLUGS = [
  "banking",
  "insurance",
  "financial-services",
  "investment",
  "diversified",
  "hotels-leisure",
  "plantations-agriculture",
  "food-beverage-tobacco",
  "consumer-goods-retail",
  "materials-chemicals",
  "manufacturing-industrials",
  "construction-engineering",
  "automotive",
  "energy",
  "real-estate",
  "healthcare",
  "telecommunications",
  "technology",
  "apparel-textiles",
  "logistics-shipping",
  "media-printing",
  "trading",
  "services",
] as const;
export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];

export const INDUSTRY_LABELS: Record<IndustrySlug, string> = {
  banking: "Banking",
  insurance: "Insurance",
  "financial-services": "Financial Services",
  investment: "Investment",
  diversified: "Diversified Holdings",
  "hotels-leisure": "Hotels & Leisure",
  "plantations-agriculture": "Plantations & Agriculture",
  "food-beverage-tobacco": "Food, Beverage & Tobacco",
  "consumer-goods-retail": "Consumer Goods & Retail",
  "materials-chemicals": "Materials & Chemicals",
  "manufacturing-industrials": "Manufacturing & Industrials",
  "construction-engineering": "Construction & Engineering",
  automotive: "Automotive",
  energy: "Energy",
  "real-estate": "Real Estate",
  healthcare: "Healthcare",
  telecommunications: "Telecommunications",
  technology: "Technology",
  "apparel-textiles": "Apparel & Textiles",
  "logistics-shipping": "Logistics & Shipping",
  "media-printing": "Media & Printing",
  trading: "Trading",
  services: "Services",
};

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
export type FieldSlug = (typeof FIELD_SLUGS)[number];

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

export const SENIORITIES = ["intern", "trainee", "junior", "mid", "senior", "lead", "manager", "principal", "unspecified"] as const;
export const JOB_TYPES = ["full-time", "part-time", "contract", "internship", "unspecified"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote", "unspecified"] as const;
export type Seniority = (typeof SENIORITIES)[number];
export type JobType = (typeof JOB_TYPES)[number];
export type WorkMode = (typeof WORK_MODES)[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: "Intern",
  trainee: "Trainee",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
  manager: "Manager",
  principal: "Principal",
  unspecified: "Not specified",
};
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
  unspecified: "Not specified",
};
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
  unspecified: "Not specified",
};

export const SNIPPET_MAX = 300;
