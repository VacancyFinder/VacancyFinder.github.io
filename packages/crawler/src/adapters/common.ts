import type { RawJob } from "./types.js";

/**
 * adapterConfig options every adapter honours, applied after the adapter runs:
 *   skipTitlePattern  drop listings whose title matches (e.g. "^talent pool")
 *   defaultLocation   location for listings that have none
 * (locationFilter is applied during normalisation, after locations are cleaned.)
 */
export function applyCommonConfig(jobs: RawJob[], config: Record<string, unknown>): RawJob[] {
  const skip = typeof config.skipTitlePattern === "string" ? new RegExp(config.skipTitlePattern, "i") : null;
  const def = typeof config.defaultLocation === "string" ? config.defaultLocation : null;
  return jobs.filter((j) => !skip?.test(j.title)).map((j) => (def && !(j.location ?? "").trim() ? { ...j, location: def } : j));
}
