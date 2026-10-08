import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initFarmHeader } from "./lib/project/farmHeader";
import { initProjectSync } from "./store/projectSync";
import "./index.css";

initProjectSync();
initFarmHeader();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
