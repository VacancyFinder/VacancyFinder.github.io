import { z } from "zod";

/** Fixed industry enum. Every company must map to exactly one of these. */
import { INDUSTRY_SLUGS, INDUSTRY_LABELS, type IndustrySlug as IndustrySlugT } from "./constants.js";
export { INDUSTRY_SLUGS, INDUSTRY_LABELS };

export const IndustrySlug = z.enum(INDUSTRY_SLUGS);
export type IndustrySlug = IndustrySlugT;

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
