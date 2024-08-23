import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppStateProvider, useApp } from "./lib/app-state";
import { DataProvider } from "./lib/data";
import { Companies } from "./pages/Companies";
import { Company } from "./pages/Company";
import { Feed } from "./pages/Feed";
import { Landing, NotFound } from "./pages/Landing";
import { Onboarding } from "./pages/Onboarding";
import { Saved } from "./pages/Saved";
import { Settings } from "./pages/Settings";
import "./index.css";

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
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="jobs" element={<Feed />} />
              <Route path="companies" element={<Companies />} />
              <Route path="companies/:slug" element={<Company />} />
              <Route path="saved" element={<Saved />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      </DataProvider>
    </AppStateProvider>
  </StrictMode>,
);
