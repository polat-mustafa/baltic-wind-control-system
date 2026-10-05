/**
 * Application root — React Router setup.
 *
 * Routes:
 *   /                → LandingPage (wind farm map + KPIs)
 *   /wind-resource   → WindResourcePage (P1 AEP analysis)
 *   /hv-grid         → HVGridPage (P2 grid integration)
 *   /scada           → SCADAPage (P3 IEC 61850)
 *   /forecast        → ForecastPage (P4 AI forecasting)
 *   /commissioning   → CommissioningPage (P5 switching programme)
 *   /turbine-physics → TurbinePhysicsPage (dynamic simulation)
 *   /digital-twin    → DigitalTwinPage (condition monitoring)
 *   /develop         → SitePermitsPage, /develop/layout → LayoutPage
 *   /academy         → AcademyPage (courses, scored missions)
 *
 * All routes are wrapped in AppShell (top bar + sidebar + content area).
 */

import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import ErrorBoundary from "./components/common/ErrorBoundary";
import AppShell from "./components/layout/AppShell";

// Route-level code splitting: each page (and its heavy deps — Plotly, three.js,
// XYFlow, Leaflet) is downloaded on first visit. AppShell holds the <Suspense>.
const AcademyPage = lazy(() => import("./pages/AcademyPage"));
const CommissioningPage = lazy(() => import("./pages/CommissioningPage"));
const DigitalTwinPage = lazy(() => import("./pages/DigitalTwinPage"));
const ForecastPage = lazy(() => import("./pages/ForecastPage"));
const HVGridPage = lazy(() => import("./pages/HVGridPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const SCADAPage = lazy(() => import("./pages/SCADAPage"));
const SitePermitsPage = lazy(() => import("./pages/SitePermitsPage"));
const LayoutPage = lazy(() => import("./pages/LayoutPage"));
const TurbinePhysicsPage = lazy(() => import("./pages/TurbinePhysicsPage"));
const WindResourcePage = lazy(() => import("./pages/WindResourcePage"));

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<LandingPage />} />
            <Route path="develop" element={<SitePermitsPage />} />
            <Route path="develop/layout" element={<LayoutPage />} />
            <Route path="wind-resource" element={<WindResourcePage />} />
            <Route path="hv-grid" element={<HVGridPage />} />
            <Route path="scada" element={<SCADAPage />} />
            <Route path="forecast" element={<ForecastPage />} />
            <Route path="commissioning" element={<CommissioningPage />} />
            <Route path="turbine-physics" element={<TurbinePhysicsPage />} />
            <Route path="digital-twin" element={<DigitalTwinPage />} />
            <Route path="academy" element={<AcademyPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
