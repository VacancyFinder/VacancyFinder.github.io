import { useId, useState } from "react";
import {
  EXTENDED_FIELD_SLUGS,
  FIELD_DESCRIPTIONS,
  FIELD_LABELS,
  SENIORITIES,
  SENIORITY_LABELS,
  TECH_FIELD_SLUGS,
  type FieldSlug,
  type Seniority,
} from "@rekiya/shared/constants";
import { CheckIcon } from "./Icons";

function Toggle({
  checked,
  onChange,
  label,
  hint,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  count?: number;
}) {
  return (
    <label
      className={`flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        checked
          ? "border-brand-700 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      }`}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400 ${
          checked
            ? "border-brand-800 bg-brand-800 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-brand-950"
            : "border-slate-400 dark:border-slate-600"
        }`}
      >
        {checked && <CheckIcon width={14} height={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">
          {label}
          {typeof count === "number" && <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">({count})</span>}
        </span>
        {hint && <span className="block text-xs text-slate-600 dark:text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

export function FieldPicker({
  value,
  onChange,
  counts,
}: {
  value: FieldSlug[];
  onChange: (v: FieldSlug[]) => void;
  counts?: Record<string, number>;
}) {
  const [more, setMore] = useState(() => value.some((f) => (EXTENDED_FIELD_SLUGS as readonly string[]).includes(f)));
  const moreId = useId();
  const toggle = (f: FieldSlug) => onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);
  return (
    <fieldset>
      <legend className="sr-only">Fields of interest</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TECH_FIELD_SLUGS.map((f) => (
          <Toggle
            key={f}
            checked={value.includes(f)}
            onChange={() => toggle(f)}
            label={FIELD_LABELS[f]}
            hint={FIELD_DESCRIPTIONS[f]}
            count={counts?.[f]}
          />
        ))}
      </div>
      <button
        type="button"
        className="link mt-4 min-h-[44px] text-sm"
        aria-expanded={more}
        aria-controls={moreId}
        onClick={() => setMore((m) => !m)}
      >
        {more ? "Fewer fields" : "More fields (finance, banking, sales, hospitality…)"}
      </button>
      <div id={moreId} hidden={!more} className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {EXTENDED_FIELD_SLUGS.map((f) => (
          <Toggle
            key={f}
            checked={value.includes(f)}
            onChange={() => toggle(f)}
            label={FIELD_LABELS[f]}
            hint={FIELD_DESCRIPTIONS[f]}
            count={counts?.[f]}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function SeniorityPicker({ value, onChange }: { value: Seniority[]; onChange: (v: Seniority[]) => void }) {
  const levels = SENIORITIES.filter((s) => s !== "unspecified");
  return (
    <fieldset>
      <legend className="sr-only">Preferred seniority</legend>
      <div className="flex flex-wrap gap-2">
        {levels.map((s) => {
          const on = value.includes(s);
          return (
            <label
              key={s}
              className={`chip min-h-[40px] cursor-pointer border px-3 text-sm ${on ? "border-brand-800 bg-brand-800 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-brand-950" : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
              />
              {SENIORITY_LABELS[s]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
