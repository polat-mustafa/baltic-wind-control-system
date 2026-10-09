import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initFarmHeader } from "./lib/project/farmHeader";
import { initLibrary } from "./lib/project/library";
import { initProjectSync } from "./store/projectSync";
import "./index.css";

initLibrary(); // before the sync: a pre-library project is filed, reference mode shows SB-510
initProjectSync();
initFarmHeader();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
