// The whole GitHub Pages site → dist-site/:
//   /        showcase page (showcase/)
//   /demo/   the app with recorded API responses (scripts/build-demo.mjs)
//   /docs/   MkDocs — added by the Pages workflow (Python), not here
// SITE_BASE = where the site is served: /offshoreforge/ on github.io, / on a custom domain.
import { cpSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

const base = process.env.SITE_BASE ?? "/offshoreforge/";
const sh = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
const rev = (() => {
  try {
    return execSync("git log -1 --format=%h·%cs").toString().trim();
  } catch {
    return "local";
  }
})();

sh("npx vite build --config showcase/vite.config.ts", { VITE_BASE: base, VITE_REV: rev, VITE_SITE_URL: process.env.SITE_URL ?? `https://polat-mustafa.github.io${base}` });
sh("node scripts/build-demo.mjs", { VITE_BASE: `${base}demo/` });
cpSync("dist-demo", "dist-site/demo", { recursive: true });
// GitHub Pages serves 404.html for unknown paths: the demo's deep links (/demo/hv-grid) land in the app
copyFileSync("dist-demo/index.html", "dist-site/404.html");
