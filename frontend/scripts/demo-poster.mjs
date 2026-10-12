// The control-room still behind "Start the demo" on the showcase page → showcase/public/demo-poster.webp.
// Re-shoot after a theme change: build the site (node scripts/build-site.mjs), serve dist-site under
// /offshoreforge/ (404.html as the fallback), then `node scripts/demo-poster.mjs [demo URL]`. Needs Python + Pillow for WebP.
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5181/offshoreforge/demo/";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Later" }).click();
await page.getByRole("button", { name: /^Environment/ }).first().click(); // fold the card, show the farm
await page.mouse.move(1430, 450);
await page.waitForTimeout(9000); // live wind snapped in, turbines at power
const png = join(tmpdir(), "demo-poster.png");
await page.screenshot({ path: png });
await browser.close();
execFileSync("python", ["-c", "import sys; from PIL import Image; Image.open(sys.argv[1]).save('showcase/public/demo-poster.webp', quality=82)", png]);
