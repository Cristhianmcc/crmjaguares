/**
 * Sube el favicon de Monterrial via API HTTP.
 * El servidor ya está corriendo en localhost:3000.
 */
import { readFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const ICO_PATH = 'C:/Users/Cris/.gemini/antigravity/brain/2a7531a4-3242-4ec3-8abd-e98608380242/.user_uploaded/media_1793733831027_283407be.ico';

async function login() {
  console.log('Logging in...');
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE,
    },
    body: JSON.stringify({
      email: 'cris@jaguares.com',
      password: 'Monterrial2026!',
    }),
    redirect: 'manual',
  });
  
  console.log('Login status:', res.status);
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');
  console.log('Got cookies:', cookieHeader.length > 0 ? 'YES' : 'NO');
  return cookieHeader;
}

async function uploadFavicon(cookieHeader) {
  const bytes = readFileSync(ICO_PATH);
  console.log(`\nUploading favicon: ${bytes.length} bytes (${(bytes.length/1024).toFixed(1)} KB)`);
  
  // The route uses PUT with raw binary body (no multipart)
  const res = await fetch(`${BASE}/api/settings/branding/favicon`, {
    method: 'PUT',
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'image/x-icon',
      'Origin': BASE,
    },
    body: bytes,
  });
  
  console.log('Upload status:', res.status);
  const text = await res.text();
  console.log('Response:', text.slice(0, 500));
  return res.status;
}

async function main() {
  // First warm up the server
  console.log('Warming up server...');
  try {
    await fetch(`${BASE}/`, { signal: AbortSignal.timeout(30000) });
    console.log('Server is up');
  } catch(e) {
    console.log('Server warmup:', e.message);
  }
  
  const cookies = await login();
  if (!cookies) {
    console.log('Login failed, no cookies');
    process.exit(1);
  }
  
  const status = await uploadFavicon(cookies);
  if (status === 200 || status === 201 || status === 204) {
    console.log('\n✅ Favicon uploaded successfully!');
  } else {
    console.log('\n❌ Upload failed with status:', status);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
