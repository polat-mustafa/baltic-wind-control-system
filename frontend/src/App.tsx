/**
 * Application root — React Router setup.
 *
 * Routes:
 *   /                → LandingPage (project overview + link to dashboard)
 *   /commissioning   → CommissioningPage (P5 simulator)
 *
 * All routes are wrapped in AppShell (top bar + sidebar + content area).
 * Future P1-P4 dashboards will be added as sibling routes.
 */

import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import CommissioningPage from "./pages/CommissioningPage";
import LandingPage from "./pages/LandingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LandingPage />} />
          <Route path="commissioning" element={<CommissioningPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
