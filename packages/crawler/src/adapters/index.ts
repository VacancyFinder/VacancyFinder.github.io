import type { Adapter } from "@rekiya/shared";
import { greenhouse, lever, smartrecruiters, teamtailor, workable, workday } from "./ats.js";
import { CUSTOM } from "./custom/index.js";
import { html } from "./html.js";
import { jsonld } from "./jsonld.js";
import { AdapterConfigError, type AdapterFn } from "./types.js";

const BUILTIN: Partial<Record<Adapter, AdapterFn>> = { lever, greenhouse, workable, smartrecruiters, teamtailor, jsonld, html };

/** "custom" adapters pick their implementation with adapterConfig.kind (e.g. "workday"). */
export function resolveAdapter(adapter: Adapter, config: Record<string, unknown>): AdapterFn {
  if (adapter === "custom") {
    const kind = config.kind;
    if (kind === "workday") return workday;
    if (typeof kind === "string" && CUSTOM[kind]) return CUSTOM[kind]!;
    throw new AdapterConfigError(`unknown custom adapter kind ${JSON.stringify(kind)}`);
  }
  const fn = BUILTIN[adapter];
  if (!fn) throw new AdapterConfigError(`no adapter for "${adapter}"`);
  return fn;
}
