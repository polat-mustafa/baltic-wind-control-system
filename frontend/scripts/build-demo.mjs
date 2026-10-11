// Static demo for GitHub Pages: the app with recorded API responses, no backend → dist-demo/.
// VITE_BASE = where it is served (the site workflow puts it under /<repo>/demo/).
import { cpSync } from "node:fs";
import { execSync } from "node:child_process";

const env = { ...process.env, VITE_DEMO: "1", VITE_BASE: process.env.VITE_BASE ?? "/offshoreforge/demo/" };
execSync("npx vite build --outDir dist-demo --emptyOutDir", { stdio: "inherit", env });
cpSync("demo-api", "dist-demo/demo-api", { recursive: true });
