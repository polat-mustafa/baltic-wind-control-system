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
 *
 * All routes are wrapped in AppShell (top bar + sidebar + content area).
 */

import { BrowserRouter, Route, Routes } from "react-router-dom";

import ErrorBoundary from "./components/common/ErrorBoundary";
import AppShell from "./components/layout/AppShell";
import CommissioningPage from "./pages/CommissioningPage";
import ForecastPage from "./pages/ForecastPage";
import HVGridPage from "./pages/HVGridPage";
import LandingPage from "./pages/LandingPage";
import SCADAPage from "./pages/SCADAPage";
import WindResourcePage from "./pages/WindResourcePage";

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<LandingPage />} />
            <Route path="wind-resource" element={<WindResourcePage />} />
            <Route path="hv-grid" element={<HVGridPage />} />
            <Route path="scada" element={<SCADAPage />} />
            <Route path="forecast" element={<ForecastPage />} />
            <Route path="commissioning" element={<CommissioningPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
