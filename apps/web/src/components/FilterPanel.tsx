import { useId } from "react";
import {
  FIELD_LABELS,
  FIELD_SLUGS,
  INDUSTRY_LABELS,
  JOB_TYPE_LABELS,
  JOB_TYPES,
  SENIORITIES,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
  WORK_MODES,
  type FieldSlug,
  type IndustrySlug,
  type JobType,
  type Seniority,
  type WorkMode,
} from "@rekiya/shared/constants";
import type { Filters } from "../lib/filters";
import type { Employer } from "../lib/types";

export interface FilterOptions {
  industries: [IndustrySlug, number][];
  companies: [Employer, number][];
  locations: string[];
  fieldCounts: Record<string, number>;
}

export function FilterPanel({ f, set, options }: { f: Filters; set: (patch: Partial<Filters>) => void; options: FilterOptions }) {
  const id = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <fieldset>
        <legend className="label">Field</legend>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_SLUGS.filter((s) => (options.fieldCounts[s] ?? 0) > 0 || f.fields.includes(s)).map((s: FieldSlug) => {
            const on = f.fields.includes(s);
            return (
              <label key={s} className={`chip min-h-[36px] cursor-pointer border px-3 text-sm ${on ? "border-brand-800 bg-brand-800 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-brand-950" : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ fields: on ? f.fields.filter((x) => x !== s) : [...f.fields, s] })} />
                {FIELD_LABELS[s]}
                <span className={on ? "opacity-80" : "text-slate-500 dark:text-slate-400"}>{options.fieldCounts[s] ?? 0}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-ind`} className="label">
          Industry
        </label>
        <select id={`${id}-ind`} className="input" value={f.industry} onChange={(e) => set({ industry: e.target.value as IndustrySlug | "" })}>
          <option value="">All industries</option>
          {options.industries.map(([s, n]) => (
            <option key={s} value={s}>
              {INDUSTRY_LABELS[s]} ({n})
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="label">Seniority</legend>
        <div className="flex flex-wrap gap-1.5">
          {SENIORITIES.map((s: Seniority) => {
            const on = f.seniority.includes(s);
            return (
              <label key={s} className={`chip min-h-[36px] cursor-pointer border px-3 text-sm ${on ? "border-brand-800 bg-brand-800 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-brand-950" : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ seniority: on ? f.seniority.filter((x) => x !== s) : [...f.seniority, s] })} />
                {SENIORITY_LABELS[s]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-co`} className="label">
          Company
        </label>
        <select id={`${id}-co`} className="input" value={f.company} onChange={(e) => set({ company: e.target.value })}>
          <option value="">All companies</option>
          {options.companies.map(([e, n]) => (
            <option key={e.slug} value={e.slug}>
              {e.name} ({n})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-wm`} className="label">
            Work mode
          </label>
          <select id={`${id}-wm`} className="input" value={f.workMode} onChange={(e) => set({ workMode: e.target.value as WorkMode | "" })}>
            <option value="">Any</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>
                {WORK_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-ty`} className="label">
            Type
          </label>
          <select id={`${id}-ty`} className="input" value={f.type} onChange={(e) => set({ type: e.target.value as JobType | "" })}>
            <option value="">Any</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-loc`} className="label">
          Location
        </label>
        <input id={`${id}-loc`} className="input" list={`${id}-locs`} value={f.location} placeholder="e.g. Colombo" onChange={(e) => set({ location: e.target.value })} />
        <datalist id={`${id}-locs`}>
          {options.locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-brand-800" checked={f.cse} onChange={(e) => set({ cse: e.target.checked })} />
          CSE-listed companies only
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-brand-800" checked={f.newOnly} onChange={(e) => set({ newOnly: e.target.checked })} />
          New since my last visit
        </label>
      </div>
    </div>
  );
}
