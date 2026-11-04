import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3010";
const OUT = "video-tutorial/capturas";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EMAIL = "cris@jaguares.com";
const PASSWORD = "Monterrial2026!";

await mkdir(OUT, { recursive: true });

console.log("Iniciando Google Chrome...");
const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  locale: "es-PE",
});

// Autenticación por API que inyecta las cookies de sesión en el context
console.log("Iniciando sesión en Monterrial CRM vía API...");
const authRes = await context.request.fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { origin: BASE },
  data: { email: EMAIL, password: PASSWORD },
});

if (!authRes.ok()) {
  console.error("Error autenticando:", authRes.status(), await authRes.text());
  process.exit(1);
}
console.log("✓ Autenticado con éxito como", EMAIL);

async function capture(urlPath, filename, contentSelector, extraWaitMs = 2500) {
  console.log(`\nCapturando ${urlPath} -> ${filename}...`);
  const page = await context.newPage();
  try {
    // 120 segundos de timeout para tolerar la primera compilación en frío de Next.js dev
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

    // Verificar que NO hayamos rebotado al login
    if (page.url().includes("/login")) {
      throw new Error(`¡Error! Redirigido a /login al intentar cargar ${urlPath}`);
    }

    // Esperar a que los textos "Cargando..." desaparezcan
    try {
      await page.waitForSelector("text=Cargando", { state: "detached", timeout: 15000 });
    } catch {}

    // Esperar selector clave de contenido si se proporcionó
    if (contentSelector) {
      try {
        await page.waitForSelector(contentSelector, { timeout: 15000 });
      } catch (e) {
        console.log(`  (Aviso: ${contentSelector} tardó, continuando...)`);
      }
    }

    await page.waitForTimeout(extraWaitMs);
    const outPath = path.join(OUT, filename);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`✓ Guardada auténtica: ${outPath} (${await page.title()})`);
  } finally {
    await page.close();
  }
}

try {
  // 1. Bandeja de Entrada con chat activo de Luis Huamán
  await capture(
    "/inbox?conversation=cv_9actnof61zdzpy88pxjj",
    "01_bandeja.png",
    "button:has-text('Responder'), textarea",
    3000
  );

  // 2. Embudo de Ventas (Pipeline Kanban con resumen financiero y etapas)
  await capture(
    "/pipeline",
    "02_embudo.png",
    "text=Nuevo Interesado, text=Gestionar etapas, input[placeholder*='Buscar']",
    3500
  );

  // 3. Cupos y Vacantes por clase
  await capture(
    "/cupos",
    "03_cupos.png",
    "text=Fútbol, text=BABY FUTBOL, text=Vacantes",
    3000
  );

  // 4. Campañas Masivas
  await capture(
    "/campanas",
    "04_campanas.png",
    "text=Campañas, button, main",
    3000
  );

  // 5. Respuestas Rápidas (Ajustes con archivos adjuntos)
  await capture(
    "/settings/quick-replies",
    "05_respuestas_rapidas.png",
    "button:has-text('Nueva respuesta'), text=Respuestas rápidas",
    3500
  );

  // 6. Agente IA (Ajustes de IA y Conocimiento)
  await capture(
    "/settings/ai",
    "06_agente_ia.png",
    "input, textarea, text=Jagua",
    3500
  );

  console.log("\n🎉 ¡Todas las capturas se tomaron autenticadas con éxito!");
} catch (err) {
  console.error("Error capturando:", err);
  process.exit(1);
} finally {
  await browser.close();
}
