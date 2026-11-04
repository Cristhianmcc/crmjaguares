import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EMAIL = "cris@jaguares.com";
const PASSWORD = "Monterrial2026!";
const ICON_PATH = "C:\\Users\\Cris\\.gemini\\antigravity\\brain\\2a7531a4-3242-4ec3-8abd-e98608380242\\.user_uploaded\\media_1793733831027_283407be.ico";

const icoBuffer = await readFile(ICON_PATH);
console.log("Leído archivo ICO:", icoBuffer.byteLength, "bytes");

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
});

const context = await browser.newContext();

// 1. Login
console.log("Iniciando sesión...");
const authRes = await context.request.fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { origin: BASE },
  data: { email: EMAIL, password: PASSWORD },
});

if (!authRes.ok()) {
  console.error("Fallo login:", authRes.status(), await authRes.text());
  process.exit(1);
}
console.log("✓ Autenticado");

// 2. Subir icono a /api/settings/branding/favicon
console.log("Subiendo logo de marca...");
const uploadRes = await context.request.fetch(`${BASE}/api/settings/branding/favicon`, {
  method: "PUT",
  headers: {
    "content-type": "image/x-icon",
  },
  data: icoBuffer,
});

console.log("Resultado subida:", uploadRes.status(), await uploadRes.text());

await browser.close();

