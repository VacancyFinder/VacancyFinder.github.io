import { z } from "zod";

/** Fixed industry enum. Every company must map to exactly one of these. */
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

export const IndustrySlug = z.enum(INDUSTRY_SLUGS);
export type IndustrySlug = z.infer<typeof IndustrySlug>;

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

/**
 * Raw industry strings seen in source lists → enum slug.
 * Keys are compared case-insensitively after whitespace collapse.
 * An unknown raw value is an import error (reported, not silently defaulted).
 */
export const INDUSTRY_MAP: Record<string, IndustrySlug> = {
  banking: "banking",
  insurance: "insurance",
  "financial services": "financial-services",
  investment: "investment",
  conglomerate: "diversified",
  hotels: "hotels-leisure",
  "hotels & leisure": "hotels-leisure",
  plantations: "plantations-agriculture",
  agriculture: "plantations-agriculture",
  "agriculture / chemicals": "plantations-agriculture",
  "tea / fmcg": "food-beverage-tobacco",
  "food products": "food-beverage-tobacco",
  "food & beverage": "food-beverage-tobacco",
  beverages: "food-beverage-tobacco",
  tobacco: "food-beverage-tobacco",
  "consumer goods": "consumer-goods-retail",
  "consumer durables": "consumer-goods-retail",
  retail: "consumer-goods-retail",
  "retail / fmcg": "consumer-goods-retail",
  "e-commerce": "consumer-goods-retail",
  materials: "materials-chemicals",
  chemicals: "materials-chemicals",
  manufacturing: "manufacturing-industrials",
  industrials: "manufacturing-industrials",
  "capital goods": "manufacturing-industrials",
  "construction & engineering": "construction-engineering",
  engineering: "construction-engineering",
  automotive: "automotive",
  "automotive / engineering": "automotive",
  energy: "energy",
  "real estate": "real-estate",
  healthcare: "healthcare",
  "healthcare technology": "healthcare",
  telecommunications: "telecommunications",
  technology: "technology",
  "technology / mobility": "technology",
  apparel: "apparel-textiles",
  "apparel / textiles": "apparel-textiles",
  logistics: "logistics-shipping",
  shipping: "logistics-shipping",
  media: "media-printing",
  printing: "media-printing",
  trading: "trading",
  commodities: "trading",
  services: "services",
};

export function normaliseIndustry(raw: string): IndustrySlug | null {
  const key = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return INDUSTRY_MAP[key] ?? null;
}
