// Captura los apartados que faltaban en docs/capturas-guia para el video tutorial.
// Uso: node video-tutorial/capturar-extra.mjs  (con el CRM corriendo en BASE)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3010";
const OUT = "video-tutorial/capturas";
// Mismas credenciales de desarrollo que scripts/tomar-capturas.mjs
const EMAIL = "cris@jaguares.com";
const PASSWORD = "Monterrial2026!";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  locale: "es-PE",
});
const auth = await context.request.fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { origin: BASE },
  data: { email: EMAIL, password: PASSWORD },
});
if (!auth.ok()) {
  console.error("Login falló", auth.status(), await auth.text());
  process.exit(1);
}

async function capture(urlPath, file, wait = 3500, action) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    if (page.url().includes("/login")) throw new Error("rebotó a /login en " + urlPath);
    try { await page.waitForSelector("text=Cargando", { state: "detached", timeout: 15000 }); } catch {}
    await page.waitForTimeout(wait);
    if (action) { await action(page); await page.waitForTimeout(1500); }
    await page.screenshot({ path: path.join(OUT, file) });
    console.log("ok", file, await page.title());
  } catch (e) {
    console.log("FALLÓ", file, e.message);
  } finally {
    await page.close();
  }
}

await capture("/contacts", "07_contactos.png");
await capture("/agent", "08_agente.png");
await capture("/lab", "09_laboratorio.png");
await capture("/results", "10_resultados.png", 5000);
await capture("/settings/brand", "11_marca.png");
await capture("/onboarding", "12_guia_inicio.png");
await capture("/settings", "13_ajustes.png");
// Ficha del trato: clic en la primera tarjeta del embudo
await capture("/pipeline", "14_embudo_ficha.png", 4000, async (p) => {
  await p.getByText("Luis Huamán").first().click();
});
// Nueva campaña abierta
await capture("/campanas", "15_campana_nueva.png", 3500, async (p) => {
  await p.getByRole("button", { name: /Nueva Campaña/i }).first().click();
});

await browser.close();
