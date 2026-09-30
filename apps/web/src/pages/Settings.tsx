import { useEffect, useRef, useState } from "react";
import { FIELD_LABELS, type FieldSlug } from "@rekiya/shared/constants";
import { FieldPicker, SeniorityPicker } from "../components/FieldPicker";
import { DownloadIcon, RssIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { InstallButton } from "../components/Pwa";
import { useToast } from "../components/Toast";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import { downloadFile, relativeDays } from "../lib/format";
import { clearAll, exportBackup, importBackup, type Theme } from "../lib/storage";
import { usePrivatePage } from "../lib/seo";

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card scroll-mt-20 p-5">
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {title}
      </h2>
      {desc && <p className="muted mt-1 text-sm">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Settings() {
  usePrivatePage("Settings");
  const { prefs, setPrefs, theme, setTheme, hidden, hiddenCompanies, unhideJob, toggleHiddenCompany } = useApp();
  const { meta, employer } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const feedFields: FieldSlug[] = prefs.fields.length ? prefs.fields : (Object.keys(FIELD_LABELS) as FieldSlug[]);
  const hiddenList = Object.values(hidden).sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt));

  // The feed links to "/settings/#hidden": scroll to that section.
  useEffect(() => {
    if (window.location.hash.includes("hidden")) document.getElementById("hidden")?.scrollIntoView();
  }, []);

  const onImport = async (file: File) => {
    try {
      const n = importBackup(JSON.parse(await file.text()));
      toast({ message: `Backup restored (${n} section${n === 1 ? "" : "s"}). Reloading…` });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast({ message: e instanceof SyntaxError ? "That file isn't valid JSON." : (e as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
      <p className="muted mt-1">Everything here is saved on this device. Changes apply straight away.</p>

      <div className="mt-6 grid gap-5">
        <Section id="fields" title="Your fields" desc="Your job feed opens with these. Choose none to see every field.">
          <FieldPicker value={prefs.fields} onChange={(fields) => setPrefs({ ...prefs, fields, onboarded: true })} counts={meta?.byField} />
        </Section>

        <Section id="seniority" title="Experience level" desc="Optional. Leave empty to see every level.">
          <SeniorityPicker value={prefs.seniority} onChange={(seniority) => setPrefs({ ...prefs, seniority, onboarded: true })} />
        </Section>

        <Section id="theme" title="Appearance">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700"
          >
            {(["system", "light", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                onClick={() => setTheme(t)}
                className={`min-h-[44px] px-4 text-sm font-medium capitalize ${theme === t ? "bg-brand-800 text-white dark:bg-brand-300 dark:text-brand-950" : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </Section>

        <Section
          id="alerts"
          title="Alerts"
          desc="Rekiya counts jobs that are new since your last visit and for each saved search. To be told elsewhere, subscribe to a field's RSS feed in any feed reader (Feedly, Inoreader, Thunderbird…)."
        >
          <ul className="flex flex-wrap gap-2">
            {feedFields.map((f) => (
              <li key={f}>
                <a href={`${import.meta.env.BASE_URL}feeds/${f}.xml`} className="pill pill-off">
                  <RssIcon width={14} height={14} /> {FIELD_LABELS[f]}
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="hidden" title="Hidden jobs and companies" desc="Jobs you marked “Not interested” don't appear in your feed.">
          {hiddenList.length === 0 && hiddenCompanies.length === 0 ? (
            <p className="muted text-sm">Nothing hidden.</p>
          ) : (
            <ul className="grid gap-1">
              {hiddenCompanies.map((c) => (
                <li key={c} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 dark:border-slate-800">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{employer(c).name}</span> <span className="muted">· all jobs</span>
                  </span>
                  <button type="button" className="btn-ghost h-10 min-h-0" onClick={() => toggleHiddenCompany(c)}>
                    Show again
                  </button>
                </li>
              ))}
              {hiddenList.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 dark:border-slate-800">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{h.title}</span>
                    <span className="muted text-xs">
                      {employer(h.company).name} · hidden {relativeDays(h.hiddenAt)}
                    </span>
                  </span>
                  <button type="button" className="btn-ghost h-10 min-h-0" onClick={() => unhideJob(h.id)}>
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="data"
          title="Your data"
          desc="Rekiya has no accounts: saved jobs, notes and settings live only in this browser. Download a backup to move them to another device."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                downloadFile(
                  `rekiya-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(exportBackup(), null, 2),
                  "application/json",
                )
              }
            >
              <DownloadIcon width={16} height={16} /> Download backup
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <UploadIcon width={16} height={16} /> Restore backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImport(file);
                e.target.value = "";
              }}
            />
            {!confirmClear ? (
              <button type="button" className="btn-danger" onClick={() => setConfirmClear(true)}>
                <TrashIcon width={16} height={16} /> Clear all data
              </button>
            ) : (
              <span
                className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-1 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
                role="alert"
              >
                Delete saved jobs, notes, searches and settings?
                <button
                  type="button"
                  className="btn-danger h-10 min-h-0"
                  onClick={() => {
                    clearAll();
                    window.location.reload();
                  }}
                >
                  Yes, delete
                </button>
                <button type="button" className="btn-ghost h-10 min-h-0" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </Section>

        <Section id="app" title="App" desc="Install Rekiya to open it like an app. Jobs you've already loaded stay available offline.">
          <InstallButton />
          <p className="muted mt-3 text-sm">
            Keyboard: press <span className="kbd">/</span> anywhere to search.
          </p>
        </Section>
      </div>
    </div>
  );
}
