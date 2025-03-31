import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FieldSlug, Seniority } from "@rekiya/shared/constants";
import { FieldPicker, SeniorityPicker } from "../components/FieldPicker";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import { usePageTitle } from "../lib/usePageTitle";

export function Onboarding() {
  usePageTitle("Choose your fields");
  const { prefs, setPrefs } = useApp();
  const { meta } = useData();
  const nav = useNavigate();
  const [fields, setFields] = useState<FieldSlug[]>(prefs.fields);
  const [seniority, setSeniority] = useState<Seniority[]>(prefs.seniority);

  const finish = (skip = false) => {
    setPrefs({ fields: skip ? [] : fields, seniority: skip ? [] : seniority, onboarded: true });
    nav("/jobs");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What kind of work are you looking for?</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Pick one or more fields. You can change this any time in Settings.</p>

      <section aria-labelledby="fields-h" className="mt-6">
        <h2 id="fields-h" className="label">
          Fields
        </h2>
        <FieldPicker value={fields} onChange={setFields} counts={meta?.byField} />
      </section>

      <section aria-labelledby="sen-h" className="mt-8">
        <h2 id="sen-h" className="label">
          Seniority <span className="font-normal normal-case tracking-normal">(optional)</span>
        </h2>
        <SeniorityPicker value={seniority} onChange={setSeniority} />
      </section>

      <div className="sticky bottom-16 mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 py-4 dark:border-slate-800 dark:bg-slate-950/95 md:bottom-0">
        <button type="button" className="btn-primary" disabled={fields.length === 0} onClick={() => finish()}>
          Show my jobs
        </button>
        <button type="button" className="btn-secondary" onClick={() => finish(true)}>
          Skip — show all jobs
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
          {fields.length ? `${fields.length} field${fields.length > 1 ? "s" : ""} selected` : "Select at least one field"}
        </span>
      </div>
    </div>
  );
}
