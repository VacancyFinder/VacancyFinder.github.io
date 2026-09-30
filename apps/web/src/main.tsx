import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./fonts.css";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { AppStateProvider, useApp } from "./lib/app-state";
import { DataProvider } from "./lib/data";
import { Landing, NotFound } from "./pages/Landing";
import "./index.css";

// Route-level code splitting (Layout wraps each page in Suspense + an error boundary).
const Feed = lazy(() => import("./pages/Feed").then((m) => ({ default: m.Feed })));
const JobDetail = lazy(() => import("./pages/JobDetail").then((m) => ({ default: m.JobDetail })));
const Companies = lazy(() => import("./pages/Companies").then((m) => ({ default: m.Companies })));
const Company = lazy(() => import("./pages/Company").then((m) => ({ default: m.Company })));
const Insights = lazy(() => import("./pages/Insights").then((m) => ({ default: m.Insights })));
const Onboarding = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })));
const Saved = lazy(() => import("./pages/Saved").then((m) => ({ default: m.Saved })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));

/** Returning users land on their feed; first-timers on the overview. */
function Home() {
  const { prefs } = useApp();
  return prefs.onboarded ? <Navigate to="/jobs" replace /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStateProvider>
      <DataProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="about" element={<Landing />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="jobs" element={<Feed />} />
                <Route path="job/:id" element={<JobDetail />} />
                <Route path="companies" element={<Companies />} />
                <Route path="companies/:slug" element={<Company />} />
                <Route path="insights" element={<Insights />} />
                <Route path="saved" element={<Saved />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </DataProvider>
    </AppStateProvider>
  </StrictMode>,
);
