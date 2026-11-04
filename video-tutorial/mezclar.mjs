// Une la narración (audio/*.wav) al video mudo.
//  1) Mezcla todos los clips en UNA pista exacta (OfflineAudioContext) y la graba en Opus.
//  2) Con el ffmpeg de Playwright copia (sin recomprimir) video VP8 + Opus -> WebM final.
//  3) Reproduce ese WebM en Chrome y lo graba como MP4 (H.264 + AAC) para WhatsApp.
// Variables: MUDO=<archivo>  MAX_SECONDS=<n> (pruebas cortas)  SOLO_MP4=1
import { createServer } from "node:http";
import { createReadStream, writeFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const DIR = path.resolve("video-tutorial");
const MUDO = process.env.MUDO ?? "Monterrial-CRM-tutorial-mudo.webm";
const MAX_S = Number(process.env.MAX_SECONDS ?? 0);
const OUT_MP4 = path.join(DIR, "Monterrial-CRM-tutorial.mp4");
const OUT_WEBM = path.join(DIR, "Monterrial-CRM-tutorial.webm");
const PISTA = path.join(DIR, "audio", "_pista.webm");

const pwDir = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
const FFMPEG = path.join(pwDir, readdirSync(pwDir).filter((d) => d.startsWith("ffmpeg")).sort().pop(), "ffmpeg-win64.exe");

// Servidor local con soporte de rangos (streaming, sin cargar el archivo entero)
const types = { ".html": "text/html", ".js": "text/javascript", ".webm": "video/webm", ".wav": "audio/wav", ".png": "image/png" };
const server = createServer((req, res) => {
  const p = path.join(DIR, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(DIR)) { res.writeHead(403).end(); return; }
  let st; try { st = statSync(p); } catch { res.writeHead(404).end(); return; }
  const type = types[path.extname(p)] ?? "application/octet-stream";
  const m = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  const start = m ? +m[1] : 0, end = m && m[2] ? +m[2] : st.size - 1;
  res.writeHead(m ? 206 : 200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": end - start + 1,
    ...(m ? { "Content-Range": `bytes ${start}-${end}/${st.size}` } : {}) });
  createReadStream(p, { start, end }).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const destinos = { mp4: OUT_MP4, aud: PISTA };
await page.exposeFunction("guardar", (cual, b64) => appendFileSync(destinos[cual], Buffer.from(b64, "base64")));
await page.goto(`${BASE}/index.html?record`);
const pistas = await page.evaluate(() => window.__pistas());
const TOTAL = MAX_S ? MAX_S * 1000 : await page.evaluate(() => window.__TOTAL);
await page.setContent("<p>mezcla</p>");

// Utilidades del lado del navegador
const helpers = `
  window.toB64 = async (b) => { const u8 = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  window.grabar = (stream, opts, cual) => {
    const r = new MediaRecorder(stream, opts); let q = Promise.resolve();
    r.ondataavailable = (e) => { if (e.data.size) { const d = e.data; q = q.then(async () => window.guardar(cual, await toB64(d))); } };
    const done = new Promise((ok) => (r.onstop = () => ok(q)));
    return { r, done };
  };`;
await page.addScriptTag({ content: helpers });

if (!process.env.SOLO_MP4) {
  // 1) Pista de voz exacta
  writeFileSync(PISTA, "");
  console.log(`Mezclando ${pistas.length} clips (${(TOTAL / 1000).toFixed(0)} s, en tiempo real)…`);
  await page.evaluate(async ({ pistas, BASE, TOTAL }) => {
    const SR = 48000;
    const off = new OfflineAudioContext(2, Math.ceil((TOTAL / 1000 + 0.5) * SR), SR);
    for (const p of pistas) {
      if (p.start >= TOTAL) continue;
      const buf = await off.decodeAudioData(await (await fetch(`${BASE}/audio/${p.file}`)).arrayBuffer());
      const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start(p.start / 1000);
    }
    const mix = await off.startRendering();
    const ctx = new AudioContext({ sampleRate: SR });
    await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource(); src.buffer = mix; src.connect(dest);
    const { r, done } = grabar(dest.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 160000 }, "aud");
    r.start(1000); src.start();
    await new Promise((ok) => (src.onended = ok));
    r.stop(); await done;
  }, { pistas, BASE, TOTAL });

  // 2) WebM final sin recomprimir el video
  const r = spawnSync(FFMPEG, ["-y", "-i", path.join(DIR, MUDO), "-i", PISTA, "-map", "0:v", "-map", "1:a", "-c", "copy",
    ...(MAX_S ? ["-t", String(MAX_S)] : []), OUT_WEBM], { encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stderr.slice(-1500)); process.exit(1); }
  console.log("WebM con voz:", OUT_WEBM);
}

// 3) MP4: el propio <video> mantiene audio y video sincronizados
writeFileSync(OUT_MP4, "");
console.log("Generando MP4 (en tiempo real)…");
const info = await page.evaluate(async ({ BASE, MAX_S }) => {
  document.body.innerHTML = `<video id="v" src="${BASE}/Monterrial-CRM-tutorial.webm" playsinline preload="auto"></video>`;
  const v = document.getElementById("v");
  await new Promise((ok) => v.readyState >= 4 ? ok() : v.addEventListener("canplaythrough", ok, { once: true }));
  const type = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2"].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) return { type: null };
  const stream = v.captureStream();
  const { r, done } = grabar(stream, { mimeType: type, videoBitsPerSecond: 8000000, audioBitsPerSecond: 160000 }, "mp4");
  r.start(1000);
  await v.play();
  await new Promise((ok) => { v.addEventListener("ended", ok, { once: true }); if (MAX_S) setTimeout(ok, MAX_S * 1000); });
  r.stop(); await done;
  return { type, dropped: v.getVideoPlaybackQuality().droppedVideoFrames, total: v.getVideoPlaybackQuality().totalVideoFrames };
}, { BASE, MAX_S });
await browser.close();
server.close();
console.log(info.type ? `MP4 listo (${info.type}) · cuadros perdidos ${info.dropped}/${info.total}: ${OUT_MP4}` : "Este Chrome no graba MP4");
