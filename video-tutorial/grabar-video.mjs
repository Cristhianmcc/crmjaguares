// Graba video-tutorial/index.html cuadro a cuadro y lo codifica en WebM (VP8)
// con el ffmpeg que trae Playwright.
//   node video-tutorial/grabar-video.mjs            -> video completo
//   node video-tutorial/grabar-video.mjs --stills   -> solo fotogramas de muestra
import { spawn } from "node:child_process";
import { readdirSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const FPS = 30;
const DIR = path.resolve("video-tutorial");
const OUT = path.join(DIR, "Monterrial-CRM-tutorial-mudo.webm");
const STILLS = process.argv.includes("--stills");

const pwDir = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
const ffDir = readdirSync(pwDir).filter((d) => d.startsWith("ffmpeg")).sort().pop();
const FFMPEG = path.join(pwDir, ffDir, "ffmpeg-win64.exe");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(DIR, "index.html")).href + "?record");
await page.evaluate(() => window.__ready);
await page.evaluate(() => document.fonts.ready);
const TOTAL = await page.evaluate(() => window.__TOTAL);
console.log(`Duración: ${(TOTAL / 1000).toFixed(1)} s`);

if (STILLS) {
  mkdirSync(path.join(DIR, "muestras"), { recursive: true });
  const times = process.argv.slice(3).map(Number).filter(Boolean);
  for (const ms of times.length ? times : [3000, 9000, 15000, 30000, 60000, 90000, 120000]) {
    await page.evaluate((m) => window.__render(m), ms);
    await page.screenshot({ path: path.join(DIR, "muestras", `t${ms}.jpg`), type: "jpeg", quality: 85 });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn(FFMPEG, [
  "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
  "-c:v", "libvpx", "-b:v", "8M", "-crf", "6", "-qmin", "0", "-qmax", "30",
  "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", "-auto-alt-ref", "0", OUT,
], { stdio: ["pipe", "inherit", "pipe"] });
let ffErr = "";
ff.stderr.on("data", (d) => { ffErr = (ffErr + d).slice(-2000); });
const closed = new Promise((r) => ff.on("close", r));
closed.then((c) => { if (c !== 0) { console.error("ffmpeg falló:\n" + ffErr); process.exit(1); } });
ff.stdin.on("error", () => {});

const frames = Math.ceil((TOTAL / 1000) * FPS);
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((m) => window.__render(m), (i * 1000) / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 300 === 0) console.log(`cuadro ${i}/${frames} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
ff.stdin.end();
const code = await closed;
await browser.close();
if (code !== 0) { console.error(ffErr); process.exit(1); }
console.log("Listo:", OUT);
