/**
 * Landing page — extracted from the original App.tsx placeholder.
 * Shows the project identity and links to the commissioning dashboard.
 */

import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] text-center px-4">
      <h1 className="text-4xl font-bold mb-4">Baltic Wind Alpha</h1>
      <p className="text-lg text-slate-300 mb-2">
        510 MW Offshore Wind HV Control Simulation Platform
      </p>
      <p className="text-sm text-slate-500 mb-8">
        34 &times; Vestas V236-15.0 MW &mdash; 66 kV array &mdash; 220 kV
        export (45 km) &mdash; 400 kV PSE grid
      </p>
      <Link
        to="/commissioning"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        Open Commissioning Dashboard
      </Link>
    </div>
  );
}
