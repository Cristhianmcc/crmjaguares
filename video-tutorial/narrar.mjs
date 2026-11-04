// Genera la narración del tour y deja audio/narracion.js con la duración de cada
// clip para que el tour ajuste sus tiempos.
//   node video-tutorial/narrar.mjs Camila   -> Azure, español de Perú (mujer)
//   node video-tutorial/narrar.mjs Alex     -> Azure, español de Perú (hombre)
//   node video-tutorial/narrar.mjs eleven   -> ElevenLabs (voz de ELEVENLABS_VOICE_ID)
//   node video-tutorial/narrar.mjs voces    -> lista las voces de tu cuenta ElevenLabs
//   node video-tutorial/narrar.mjs Laura    -> voz local de Windows (también Helena o Pablo)
// Las llaves (AZURE_SPEECH_*, ELEVENLABS_*) se leen del .env del proyecto.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const DIR = path.resolve("video-tutorial");
const AUD = path.join(DIR, "audio");
const VOICE = process.argv[2] ?? "eleven";
const AZURE_VOICES = { Camila: "es-PE-CamilaNeural", Alex: "es-PE-AlexNeural" };
const AZURE_RATE = "+4%"; // velocidad de lectura en Azure

// .env del proyecto (sin dependencias)
const env = { ...process.env };
const envFile = path.resolve(".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

mkdirSync(AUD, { recursive: true });

const falta = (v) => !v || v.startsWith("REEMPLAZA");
const ELEVEN = "https://api.elevenlabs.io/v1";
if (VOICE === "voces") {
  if (falta(env.ELEVENLABS_API_KEY)) { console.error("Falta ELEVENLABS_API_KEY en .env"); process.exit(1); }
  const r = await fetch(ELEVEN + "/voices", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
  if (!r.ok) { console.error("ElevenLabs:", r.status, await r.text()); process.exit(1); }
  for (const v of (await r.json()).voices) console.log(v.voice_id, "|", v.name, "|", v.category, "|", JSON.stringify(v.labels ?? {}));
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(DIR, "index.html")).href + "?record");
const textos = await page.evaluate(() => window.__textos());
await browser.close();
writeFileSync(path.join(AUD, "textos.json"), JSON.stringify(textos, null, 2), "utf8");

if (VOICE === "eleven") {
  const key = env.ELEVENLABS_API_KEY;
  if (falta(key)) { console.error("Falta ELEVENLABS_API_KEY en .env (ver la guía junto a esa línea)."); process.exit(1); }
  const voiceId = falta(env.ELEVENLABS_VOICE_ID) ? "pNInz6obpgDQGcFmaJgB" : env.ELEVENLABS_VOICE_ID; // por defecto: Adam
  const SR = 24000; // PCM crudo (disponible en el plan gratis); se envuelve en WAV
  const wav = (pcm) => { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
  let prev = null;
  for (const t of textos) {
    let res;
    for (let intento = 1; intento <= 5; intento++) {
      res = await fetch(`${ELEVEN}/text-to-speech/${voiceId}?output_format=pcm_${SR}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: t.text, model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.05 },
          ...(prev ? { previous_text: prev } : {}),
        }),
      });
      if (res.ok) break;
      if (res.status === 401) { console.error("ElevenLabs rechazó la llave (401)."); process.exit(1); }
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
    if (!res.ok) { console.error("ElevenLabs falló en", t.file, res.status, await res.text()); process.exit(1); }
    writeFileSync(path.join(AUD, t.file), wav(Buffer.from(await res.arrayBuffer())));
    prev = t.text;
    console.log("ok", t.file);
  }
} else if (AZURE_VOICES[VOICE]) {
  const key = env.AZURE_SPEECH_KEY, region = env.AZURE_SPEECH_REGION;
  if (!key || !region || key.startsWith("REEMPLAZA") || region.startsWith("REEMPLAZA")) {
    console.error("Falta AZURE_SPEECH_KEY / AZURE_SPEECH_REGION en .env (ver la guía junto a esas líneas).");
    process.exit(1);
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (const t of textos) {
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-PE">` +
      `<voice name="${AZURE_VOICES[VOICE]}"><prosody rate="${AZURE_RATE}">${esc(t.text)}</prosody></voice></speak>`;
    let res;
    for (let intento = 1; intento <= 4; intento++) {
      res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
          "User-Agent": "monterrial-video-tutorial",
        },
        body: ssml,
      });
      if (res.ok) break;
      if (res.status === 401 || res.status === 403) { console.error("Azure rechazó la llave o la región (", res.status, ")."); process.exit(1); }
      await new Promise((r) => setTimeout(r, 1500 * intento)); // 429/5xx: reintenta
    }
    if (!res.ok) { console.error("Azure falló:", res.status, await res.text()); process.exit(1); }
    writeFileSync(path.join(AUD, t.file), Buffer.from(await res.arrayBuffer()));
    console.log("ok", t.file);
  }
} else {
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(DIR, "tts.ps1"),
    "-Json", path.join(AUD, "textos.json"), "-OutDir", AUD, "-Voice", VOICE, "-Rate", "1.15"], { stdio: "inherit" });
}

function wavMs(file) {
  const b = readFileSync(file);
  const byteRate = b.readUInt32LE(28);
  let off = 12;
  while (off < b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "data") return Math.round((size / byteRate) * 1000);
    off += 8 + size;
  }
  throw new Error("WAV sin datos: " + file);
}

const durs = {};
for (const t of textos) durs[t.file.replace(".wav", "")] = wavMs(path.join(AUD, t.file));
writeFileSync(path.join(AUD, "narracion.js"), `window.NARRACION = ${JSON.stringify(durs)};\n`, "utf8");
const total = Object.values(durs).reduce((a, b) => a + b, 0);
console.log(`${textos.length} clips, ${(total / 1000).toFixed(1)} s de voz con ${VOICE}`);
