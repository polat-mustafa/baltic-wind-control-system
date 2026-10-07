import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initProjectSync } from "./store/projectSync";
import "./index.css";

initProjectSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
