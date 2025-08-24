import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import { isStale, nextSyncLabel, relativeTime } from "../lib/format";
import { SYNC_EVERY_MS } from "../lib/data";
import { useToast } from "./Toast";
import { ErrorBoundary } from "./ErrorBoundary";
import { AlertIcon, ArrowUpIcon, BookmarkIcon, BriefcaseIcon, BuildingIcon, ChartIcon, GearIcon, SearchIcon } from "./Icons";
import { UpdatePrompt } from "./Pwa";
import { ShareSiteLink } from "./ShareSite";
import { PageSkeleton } from "./Skeleton";

const NAV = [
  { to: "/jobs/", label: "Jobs", icon: BriefcaseIcon },
  { to: "/companies/", label: "Companies", icon: BuildingIcon },
  { to: "/insights/", label: "Insights", icon: ChartIcon },
  { to: "/saved/", label: "Saved", icon: BookmarkIcon },
  { to: "/settings/", label: "Settings", icon: GearIcon },
];

export const REPO_URL = "https://github.com/VacancyFinder/VacancyFinder.github.io";
export const SUGGEST_URL = `${REPO_URL}/issues/new?template=suggest-company.yml`;

/** Pages that draw their own full-width sections (hero bands) instead of sitting in the page container. */
const FULL_BLEED = new Set(["/", "/about"]);

function StaleNotice() {
  const { meta } = useData();
  if (!meta || !isStale(meta.generatedAt)) return null;
  const never = Date.parse(meta.generatedAt) === 0;
  // A fixed toast rather than a banner: it never pushes the page content down (no layout shift).
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-16 z-30 mx-auto max-w-xl rounded-lg border border-amber-300 bg-amber-50 text-amber-900 shadow-md dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="flex items-center gap-2 px-3 py-2 text-sm">
        <AlertIcon width={16} height={16} />
        {never
          ? "Jobs haven't been collected yet — check back soon."
          : `Job data may be out of date (last updated ${relativeTime(meta.generatedAt)}).`}
      </p>
    </div>
  );
}

function HeaderSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(q.trim() ? `/jobs/?q=${encodeURIComponent(q.trim())}` : "/jobs/");
    setQ("");
  };
  return (
    <form role="search" onSubmit={submit} className="relative hidden w-64 lg:block">
      <label htmlFor="header-q" className="sr-only">
        Search all jobs
      </label>
      <SearchIcon width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-200" />
      <input
        id="header-q"
        data-global-search
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search jobs"
        autoComplete="off"
        className="h-10 w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-9 text-sm text-white placeholder:text-brand-100 focus:bg-white/15"
      />
      <span className="kbd pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 border-white/30 bg-transparent text-brand-100">
        /
      </span>
    </form>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 1200);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-20 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-800 text-white shadow-lg hover:bg-brand-900 dark:bg-brand-300 dark:text-brand-950 md:bottom-6"
    >
      <ArrowUpIcon />
    </button>
  );
}

/** "/" jumps to search from anywhere (unless the user is typing). */
function useSearchShortcut() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      const pageSearch = document.getElementById("q") as HTMLInputElement | null;
      const target = pageSearch ?? (document.querySelector("[data-global-search]") as HTMLInputElement | null);
      if (target && target.offsetParent !== null) target.focus();
      else if (!loc.pathname.startsWith("/jobs")) nav("/jobs/", { state: { focusSearch: true } });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [nav, loc.pathname]);
}

/** A sync landed while the site was open: say so (the data has already been swapped in). */
function LiveUpdateNotice() {
  const { lastUpdate } = useData();
  const toast = useToast();
  useEffect(() => {
    if (!lastUpdate) return;
    const diff = lastUpdate.open - lastUpdate.previousOpen;
    toast({
      message: `Jobs updated just now — ${lastUpdate.open.toLocaleString()} open${diff > 0 ? ` (+${diff})` : ""}`,
    });
  }, [lastUpdate, toast]);
  return null;
}

function SyncStatus() {
  const { meta } = useData();
  if (!meta || Date.parse(meta.generatedAt) === 0) return null;
  return (
    <p className="mt-3 text-xs">
      Jobs sync every 3 hours · last sync {relativeTime(meta.generatedAt)} · next {nextSyncLabel(meta.generatedAt, SYNC_EVERY_MS)}
    </p>
  );
}

export function Layout() {
  const { saved } = useApp();
  const savedCount = Object.keys(saved).length;
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const bleed = FULL_BLEED.has(loc.pathname.replace(/\/+$/, "") || "/");
  useSearchShortcut();

  // The app has painted: retire the boot preloader (index.html).
  useEffect(() => document.documentElement.classList.add("app-ready"), []);

  // Move focus to the page on navigation so screen-reader users hear the new page.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-900"
        onClick={(e) => (e.preventDefault(), mainRef.current?.focus())}
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-brand-800 text-white shadow">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <NavLink to="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight" aria-label="Rekiya home">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} className="rounded-md ring-1 ring-white/20" />
            Rekiya
          </NavLink>
          <div className="flex items-center gap-3">
            {!loc.pathname.startsWith("/jobs") && <HeaderSearch />}
            <nav aria-label="Main" className="hidden md:block">
              <ul className="flex gap-1">
                {NAV.map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      className={({ isActive }) =>
                        `flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium ${isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"}`
                      }
                    >
                      <n.icon width={18} height={18} />
                      {n.label}
                      {n.to === "/saved/" && savedCount > 0 && <span className="chip bg-white/20 text-white">{savedCount}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </header>
      <StaleNotice />

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className={`min-h-[calc(100vh-3.5rem)] w-full flex-1 pb-24 outline-none md:pb-12 ${bleed ? "" : "container-page pt-6"}`}
      >
        <ErrorBoundary resetKey={loc.pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white pb-20 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 md:pb-0">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={20} height={20} className="rounded" />
              Rekiya
            </p>
            <p className="mt-2 max-w-sm">
              Open vacancies from the official career pages of Sri Lankan companies. Rekiya links to each company's own listing — we never
              host or handle applications.
            </p>
            <SyncStatus />
          </div>
          <nav aria-label="Explore">
            <p className="font-semibold text-slate-900 dark:text-white">Explore</p>
            <ul className="mt-2 grid gap-1">
              <li>
                <NavLink to="/jobs/" className="link font-normal">
                  All jobs
                </NavLink>
              </li>
              <li>
                <NavLink to="/companies/" className="link font-normal">
                  Companies
                </NavLink>
              </li>
              <li>
                <NavLink to="/insights/" className="link font-normal">
                  Job market insights
                </NavLink>
              </li>
            </ul>
          </nav>
          <nav aria-label="About Rekiya">
            <p className="font-semibold text-slate-900 dark:text-white">About</p>
            <ul className="mt-2 grid gap-1">
              <li>
                <NavLink to="/about/" className="link font-normal">
                  How it works &amp; FAQ
                </NavLink>
              </li>
              <li>
                <a href={SUGGEST_URL} className="link font-normal" rel="noopener">
                  Suggest a company
                </a>
              </li>
              <li>
                <a href={REPO_URL} className="link font-normal" rel="noopener">
                  Source code
                </a>
              </li>
              <li>
                <ShareSiteLink />
              </li>
            </ul>
          </nav>
        </div>
      </footer>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? "text-brand-800 dark:text-brand-300" : "text-slate-600 dark:text-slate-400"}`
                }
              >
                <span className="relative">
                  <n.icon width={22} height={22} />
                  {n.to === "/saved/" && savedCount > 0 && (
                    <span className="absolute -right-2 -top-1 rounded-full bg-brand-800 px-1 text-[10px] leading-4 text-white dark:bg-brand-300 dark:text-brand-950">
                      {savedCount}
                    </span>
                  )}
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <LiveUpdateNotice />
      <BackToTop />
      <UpdatePrompt />
    </div>
  );
}
