import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "docs/capturas-guia";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SESSION_TOKEN = "in3rE52FmVaiyPOEuQPeWc5YXRmW9w8J";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  locale: "es-PE",
});

await context.addCookies([
  {
    name: "better-auth.session_token",
    value: SESSION_TOKEN,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  },
  {
    name: "vocero-theme",
    value: "light",
    domain: "localhost",
    path: "/",
  },
]);

const page = await context.newPage();

async function capture(urlPath, filename, prepare) {
  console.log(`Navegando a ${urlPath}...`);
  await page.goto(`${BASE}${urlPath}`, { waitUntil: "load" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(2000);
  if (prepare) {
    await prepare(page);
    await page.waitForTimeout(1000);
  }
  const outPath = path.join(OUT, filename);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`✓ Guardada captura: ${outPath}`);
}

try {
  // 1. Bandeja de Entrada con chat seleccionado
  await capture("/inbox", "01_bandeja.png", async (p) => {
    // Haz clic en la primera conversación si no está seleccionada
    const item = await p.$("button[data-conversation-id], a[href*='contact']");
    if (item) await item.click();
  });

  // 2. Embudo de Ventas
  await capture("/pipeline", "02_embudo.png");

  // 3. Cupos
  await capture("/cupos", "03_cupos.png");

  // 4. Campañas
  await capture("/campanas", "04_campanas.png");

  // 5. Respuestas Rápidas (Ajustes)
  await capture("/settings/quick-replies", "05_respuestas_rapidas.png");

  // 6. Agente IA (Ajustes)
  await capture("/settings/ai", "06_agente_ia.png");

  console.log("¡Todas las capturas se tomaron con éxito!");
} catch (err) {
  console.error("Error tomando capturas:", err);
} finally {
  await browser.close();
}
