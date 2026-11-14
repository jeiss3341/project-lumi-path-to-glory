// Path to Glory · page checks (run by .github/workflows/ci.yml).
// Opens each page in a real browser against a local copy of the site, which always runs in
// demo mode (sample data, never the real database), logged out and as each kind of account.
// Fails if any page throws an error, logs a console error, or is missing a file of its own.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8080/site/";

// demo accounts (site/api.js demoApi): a player, a mentor, an assistant coach, staff
const USERS = [
  ["player", "u-jeiss"],
  ["mentor", "u-dylan"],
  ["assistant", "u-baeksu"],
  ["staff", "u-staff"],
];
const PAGES = ["index.html", "index.html?hours", "desk.html", "vods.html"];

// what each page must show once it has loaded, so a blank page fails too
const MUST = {
  "desk.html": { in: "#desk-head h1", out: "body" },
  "index.html": { in: "body", out: "body" },
  "index.html?hours": { in: "body", out: "body" },
  "vods.html": { in: "body", out: "body" },
};

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(BASE + "index.html")).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("The local test server never started.");
}

async function check(browser, path, who) {
  const context = await browser.newContext();   // fresh browser storage for every check
  const page = await context.newPage();
  const errors = [];
  const ours = (url) => !url || url.startsWith(new URL(BASE).origin);
  page.on("pageerror", (e) => errors.push("page error: " + e.message));
  page.on("console", (m) => {
    // only errors from the site's own files: a slow font or CDN isn't the site's fault
    if (m.type() === "error" && ours(m.location().url)) errors.push("console: " + m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && ours(r.url())) errors.push(`missing file: ${r.status()} ${r.url()}`);
  });

  if (who) {
    // log in as a demo account, then open the page fresh
    await page.goto(BASE + "desk.html", { waitUntil: "load" });
    await page.evaluate((id) => window.API.demo.setMe(id), who[1]);
  }
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(1500);   // let the page draw what it fetches after loading

  const sel = who ? MUST[path].in : MUST[path].out;
  const text = await page.locator(sel).first().innerText({ timeout: 5000 }).catch(() => "");
  if (!text.trim()) errors.push(`nothing showed in ${sel}`);

  await context.close();
  return errors;
}

await waitForServer();
const browser = await chromium.launch();
let failed = 0;
for (const path of PAGES) {
  for (const who of [null, ...USERS]) {
    const label = `${path} · ${who ? who[0] : "logged out"}`;
    const errors = await check(browser, path, who);
    if (errors.length) {
      failed++;
      console.log(`✗ ${label}`);
      for (const e of errors) console.log("    " + e);
    } else {
      console.log(`✓ ${label}`);
    }
  }
}
await browser.close();

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nEvery page opened with no errors.");
