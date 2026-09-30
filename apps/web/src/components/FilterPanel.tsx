import { useId, useState } from "react";
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
import { POSTED_LABELS, POSTED_WITHIN, type Filters, type PostedWithin } from "../lib/filters";
import type { Employer } from "../lib/types";

export interface FilterOptions {
  industries: [IndustrySlug, number][];
  companies: [Employer, number][];
  locations: [string, number][];
  fieldCounts: Record<string, number>;
  seniorityCounts: Record<string, number>;
}

const FIELDS_SHOWN = 8;

function Pill({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`pill max-w-full whitespace-normal py-1 text-left ${on ? "pill-on" : "pill-off"} has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-400`}
    >
      <input type="checkbox" className="sr-only" checked={on} onChange={onToggle} />
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <legend className="label float-left mb-2 w-full">{title}</legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  );
}

export function FilterPanel({ f, set, options }: { f: Filters; set: (patch: Partial<Filters>) => void; options: FilterOptions }) {
  const id = useId();
  const [allFields, setAllFields] = useState(false);
  const fields = FIELD_SLUGS.filter((s) => (options.fieldCounts[s] ?? 0) > 0 || f.fields.includes(s)).sort(
    (a, b) => (options.fieldCounts[b] ?? 0) - (options.fieldCounts[a] ?? 0),
  );
  const visibleFields = allFields ? fields : fields.filter((s, i) => i < FIELDS_SHOWN || f.fields.includes(s));

  return (
    <div className="flex flex-col gap-4">
      <Section title="Field">
        <div className="flex flex-wrap gap-1.5">
          {visibleFields.map((s: FieldSlug) => {
            const on = f.fields.includes(s);
            return (
              <Pill key={s} on={on} onToggle={() => set({ fields: on ? f.fields.filter((x) => x !== s) : [...f.fields, s] })}>
                {FIELD_LABELS[s]}
                <span className={on ? "opacity-80" : "text-slate-500 dark:text-slate-400"}>{options.fieldCounts[s] ?? 0}</span>
              </Pill>
            );
          })}
        </div>
        {fields.length > FIELDS_SHOWN && (
          <button
            type="button"
            className="link mt-1 min-h-[44px] text-sm"
            aria-expanded={allFields}
            onClick={() => setAllFields((v) => !v)}
          >
            {allFields ? "Show fewer fields" : `Show all ${fields.length} fields`}
          </button>
        )}
      </Section>

      <Section title="Date posted">
        <div className="grid gap-1">
          {(["", ...POSTED_WITHIN] as PostedWithin[]).map((p) => (
            <label key={p || "any"} className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name={`${id}-posted`}
                className="h-4 w-4 accent-brand-800 dark:accent-brand-300"
                checked={f.posted === p}
                onChange={() => set({ posted: p })}
              />
              {p ? POSTED_LABELS[p] : "Any time"}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Experience level">
        <div className="flex flex-wrap gap-1.5">
          {SENIORITIES.filter((s) => s !== "unspecified").map((s: Seniority) => {
            const on = f.seniority.includes(s);
            return (
              <Pill key={s} on={on} onToggle={() => set({ seniority: on ? f.seniority.filter((x) => x !== s) : [...f.seniority, s] })}>
                {SENIORITY_LABELS[s]}
                {options.seniorityCounts[s] ? (
                  <span className={on ? "opacity-80" : "text-slate-500 dark:text-slate-400"}>{options.seniorityCounts[s]}</span>
                ) : null}
              </Pill>
            );
          })}
        </div>
      </Section>

      <Section title="Work mode & type">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-wm`} className="sr-only">
              Work mode
            </label>
            <select
              id={`${id}-wm`}
              className="input"
              value={f.workMode}
              onChange={(e) => set({ workMode: e.target.value as WorkMode | "" })}
            >
              <option value="">Any work mode</option>
              {WORK_MODES.filter((m) => m !== "unspecified").map((m) => (
                <option key={m} value={m}>
                  {WORK_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-ty`} className="sr-only">
              Job type
            </label>
            <select id={`${id}-ty`} className="input" value={f.type} onChange={(e) => set({ type: e.target.value as JobType | "" })}>
              <option value="">Any type</option>
              {JOB_TYPES.filter((t) => t !== "unspecified").map((t) => (
                <option key={t} value={t}>
                  {JOB_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Location">
        <label htmlFor={`${id}-loc`} className="sr-only">
          Location
        </label>
        <input
          id={`${id}-loc`}
          className="input"
          list={`${id}-locs`}
          value={f.location}
          placeholder="e.g. Colombo"
          onChange={(e) => set({ location: e.target.value })}
        />
        <datalist id={`${id}-locs`}>
          {options.locations.map(([l]) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.locations.slice(0, 5).map(([l, n]) => (
            <button
              key={l}
              type="button"
              className={`pill ${f.location.toLowerCase() === l.toLowerCase() ? "pill-on" : "pill-off"}`}
              aria-pressed={f.location.toLowerCase() === l.toLowerCase()}
              onClick={() => set({ location: f.location.toLowerCase() === l.toLowerCase() ? "" : l })}
            >
              {l} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Employer">
        <div className="grid gap-3">
          <div>
            <label htmlFor={`${id}-co`} className="sr-only">
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
          <div>
            <label htmlFor={`${id}-ind`} className="sr-only">
              Industry
            </label>
            <select
              id={`${id}-ind`}
              className="input"
              value={f.industry}
              onChange={(e) => set({ industry: e.target.value as IndustrySlug | "" })}
            >
              <option value="">All industries</option>
              {options.industries.map(([s, n]) => (
                <option key={s} value={s}>
                  {INDUSTRY_LABELS[s]} ({n})
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-800 dark:accent-brand-300"
              checked={f.cse}
              onChange={(e) => set({ cse: e.target.checked })}
            />
            CSE-listed companies only
          </label>
          <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-800 dark:accent-brand-300"
              checked={f.newOnly}
              onChange={(e) => set({ newOnly: e.target.checked })}
            />
            New since my last visit
          </label>
        </div>
      </Section>
    </div>
  );
}
