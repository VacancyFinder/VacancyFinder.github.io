import { FIELD_LABELS, type FieldSlug } from "@rekiya/shared/constants";
import { FieldPicker, SeniorityPicker } from "../components/FieldPicker";
import { RssIcon } from "../components/Icons";
import { InstallButton } from "../components/Pwa";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import type { Theme } from "../lib/storage";
import { usePageTitle } from "../lib/usePageTitle";

export function Settings() {
  usePageTitle("Settings");
  const { prefs, setPrefs, theme, setTheme } = useApp();
  const { meta } = useData();
  const feedFields: FieldSlug[] = prefs.fields.length ? prefs.fields : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">Saved on this device. Changes apply straight away.</p>

      <section aria-labelledby="s-fields" className="mt-8">
        <h2 id="s-fields" className="text-lg font-semibold">
          Your fields
        </h2>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Your job feed starts with these. None selected shows every field.</p>
        <FieldPicker value={prefs.fields} onChange={(fields) => setPrefs({ ...prefs, fields, onboarded: true })} counts={meta?.byField} />
      </section>

      <section aria-labelledby="s-sen" className="mt-8">
        <h2 id="s-sen" className="text-lg font-semibold">
          Seniority
        </h2>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Optional. Leave empty to see every level.</p>
        <SeniorityPicker value={prefs.seniority} onChange={(seniority) => setPrefs({ ...prefs, seniority, onboarded: true })} />
      </section>

      <section aria-labelledby="s-theme" className="mt-8">
        <h2 id="s-theme" className="text-lg font-semibold">
          Appearance
        </h2>
        <div role="radiogroup" aria-labelledby="s-theme" className="mt-3 inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => setTheme(t)}
              className={`min-h-[44px] px-4 text-sm font-medium capitalize ${theme === t ? "bg-brand-800 text-white dark:bg-brand-300 dark:text-brand-950" : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="s-alerts" className="mt-8">
        <h2 id="s-alerts" className="text-lg font-semibold">
          Alerts
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Rekiya shows how many jobs are new since your last visit. To be told elsewhere, subscribe to a field's RSS feed in any feed reader.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(feedFields.length ? feedFields : (Object.keys(FIELD_LABELS) as FieldSlug[])).map((f) => (
            <li key={f}>
              <a href={`${import.meta.env.BASE_URL}feeds/${f}.xml`} className="chip min-h-[36px] border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                <RssIcon width={14} height={14} /> {FIELD_LABELS[f]}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="s-app" className="mt-8">
        <h2 id="s-app" className="text-lg font-semibold">
          App
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Install Rekiya to open it like an app. Jobs you've already loaded stay available offline.</p>
        <div className="mt-3">
          <InstallButton />
        </div>
      </section>
    </div>
  );
}
