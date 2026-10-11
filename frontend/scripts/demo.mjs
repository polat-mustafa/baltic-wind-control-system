// npm run demo:record | demo:check — see playwright.demo.config.ts (env set here: npm scripts run in cmd.exe on Windows)
import { execSync } from "node:child_process";

if (process.argv[2] === "check") process.env.DEMO_CHECK = "1";
execSync("npx playwright test -c playwright.demo.config.ts", { stdio: "inherit" });
