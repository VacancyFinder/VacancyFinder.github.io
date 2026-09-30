import { z } from "zod";
import { EXTENDED_FIELD_SLUGS, FIELD_DESCRIPTIONS, FIELD_LABELS, FIELD_SLUGS, TECH_FIELD_SLUGS, type FieldSlug as FieldSlugT } from "./constants.js";

export { EXTENDED_FIELD_SLUGS, FIELD_DESCRIPTIONS, FIELD_LABELS, FIELD_SLUGS, TECH_FIELD_SLUGS };
export const FieldSlug = z.enum(FIELD_SLUGS);
export type FieldSlug = FieldSlugT;
