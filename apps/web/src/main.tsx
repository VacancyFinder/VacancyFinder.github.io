import { lazy, StrictMode, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppStateProvider, useApp } from "./lib/app-state";
import { DataProvider } from "./lib/data";
import { Landing, NotFound } from "./pages/Landing";
import "./index.css";

// Route-level code splitting: the landing page loads without the feed's search index or the directory.
const Feed = lazy(() => import("./pages/Feed").then((m) => ({ default: m.Feed })));
const Companies = lazy(() => import("./pages/Companies").then((m) => ({ default: m.Companies })));
const Company = lazy(() => import("./pages/Company").then((m) => ({ default: m.Company })));
const Onboarding = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })));
const Saved = lazy(() => import("./pages/Saved").then((m) => ({ default: m.Saved })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));

const page = (el: ReactNode) => <Suspense fallback={<p role="status">Loading…</p>}>{el}</Suspense>;

/** Returning users land on their feed; first-timers on the overview. */
function Home() {
  const { prefs } = useApp();
  return prefs.onboarded ? <Navigate to="/jobs" replace /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStateProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<Landing />} />
              <Route path="onboarding" element={page(<Onboarding />)} />
              <Route path="jobs" element={page(<Feed />)} />
              <Route path="companies" element={page(<Companies />)} />
              <Route path="companies/:slug" element={page(<Company />)} />
              <Route path="saved" element={page(<Saved />)} />
              <Route path="settings" element={page(<Settings />)} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      </DataProvider>
    </AppStateProvider>
  </StrictMode>,
);
