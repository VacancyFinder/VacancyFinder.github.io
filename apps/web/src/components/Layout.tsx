import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import { isStale, relativeTime } from "../lib/format";
import { AlertIcon, BookmarkIcon, BriefcaseIcon, BuildingIcon, GearIcon } from "./Icons";
import { UpdatePrompt } from "./Pwa";

const NAV = [
  { to: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { to: "/companies", label: "Companies", icon: BuildingIcon },
  { to: "/saved", label: "Saved", icon: BookmarkIcon },
  { to: "/settings", label: "Settings", icon: GearIcon },
];

export const REPO_URL = "https://github.com/VacancyFinder/VacancyFinder.github.io";
export const SUGGEST_URL = `${REPO_URL}/issues/new?template=suggest-company.yml`;

function StaleNotice() {
  const { meta } = useData();
  if (!meta || !isStale(meta.generatedAt)) return null;
  const never = Date.parse(meta.generatedAt) === 0;
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <AlertIcon width={16} height={16} />
        {never
          ? "Jobs haven't been collected yet — check back soon."
          : `Job data may be out of date (last updated ${relativeTime(meta.generatedAt)}).`}
      </p>
    </div>
  );
}

export function Layout() {
  const { saved } = useApp();
  const savedCount = Object.keys(saved).length;
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);

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
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight" aria-label="Rekiya home">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} className="rounded-md ring-1 ring-white/20" />
            Rekiya
          </NavLink>
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
                    {n.to === "/saved" && savedCount > 0 && <span className="chip bg-white/20 text-white">{savedCount}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <StaleNotice />

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 outline-none md:pb-12">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 pb-24 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 md:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p>Rekiya links to each company's own listing. We never host applications.</p>
          <p className="flex gap-4">
            <NavLink to="/about" className="link">
              About
            </NavLink>
            <a href={REPO_URL} className="link" rel="noopener">
              Source
            </a>
            <a href={SUGGEST_URL} className="link" rel="noopener">
              Suggest a company
            </a>
          </p>
        </div>
      </footer>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? "text-brand-800 dark:text-brand-300" : "text-slate-600 dark:text-slate-400"}`
                }
              >
                <span className="relative">
                  <n.icon width={22} height={22} />
                  {n.to === "/saved" && savedCount > 0 && (
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
      <UpdatePrompt />
    </div>
  );
}
