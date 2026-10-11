/**
 * The public showcase page (GitHub Pages root). Plain TypeScript, no React: it
 * reuses the app's physics (wake model, IEA-15 curves, layout, evidence) straight
 * from ../src, so the numbers on the page are the platform's own.
 *
 *   npx vite --config showcase/vite.config.ts            dev
 *   node scripts/build-site.mjs                          whole Pages site → dist-site/
 */

import { resolve } from "path";

import { defineConfig } from "vite";

// absolute address for the link-preview image (og:image must be absolute)
process.env.VITE_SITE_URL ??= "https://polat-mustafa.github.io/offshoreforge/";

export default defineConfig({
  root: __dirname,
  base: process.env.VITE_BASE ?? "/",
  publicDir: resolve(__dirname, "public"),
  build: { outDir: resolve(__dirname, "../dist-site"), emptyOutDir: true },
  server: { port: 5180 },
});
