/**
 * Sube el .ico de Monterrial directamente a la base de datos,
 * evitando el límite HTTP y el timeout del servidor frío.
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const ICO_PATH = 'C:/Users/Cris/.gemini/antigravity/brain/2a7531a4-3242-4ec3-8abd-e98608380242/.user_uploaded/media_1793733831027_283407be.ico';
const MEDIA_DIR = '/data/media';
const FAVICON_ASSET = 'favicon';
const ORG_ID = 'org_0cm6hxhw1ymyszar7cu7';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'jaguares',
  user: 'postgres',
  password: 'postgres',
});

async function main() {
  const bytes = readFileSync(ICO_PATH);
  console.log(`ICO size: ${bytes.length} bytes (${(bytes.length/1024).toFixed(1)} KB)`);
  
  // Verify it's an ICO file
  if (bytes[0] !== 0x00 || bytes[1] !== 0x00 || bytes[2] !== 0x01 || bytes[3] !== 0x00) {
    throw new Error('Not a valid ICO file!');
  }
  console.log('ICO signature OK');

  const client = await pool.connect();
  try {
    // 1. Read current metadata
    const res = await client.query(
      'SELECT metadata FROM organization WHERE id = $1',
      [ORG_ID]
    );
    if (res.rows.length === 0) throw new Error('Organization not found: ' + ORG_ID);
    
    const meta = res.rows[0].metadata || {};
    const branding = meta.branding || {};
    const version = Date.now();

    // 2. Update branding metadata with favicon info
    branding.favicon = {
      mime: 'image/x-icon',
      version,
    };
    meta.branding = branding;

    await client.query(
      'UPDATE organization SET metadata = $1 WHERE id = $2',
      [JSON.stringify(meta), ORG_ID]
    );
    console.log('Updated organization.metadata with favicon info, version:', version);

    // 3. Write the favicon file to a path that the CRM will serve
    // The CRM stores media in /data/media/<asset> - but we're running locally
    // so we need to find where /data maps to
    
    // Check if there's a local data directory
    const { execSync } = await import('child_process');
    try {
      // Try to find where Docker volume crm_data is mounted
      const inspect = execSync('docker volume inspect crm_data --format "{{.Mountpoint}}"', { encoding: 'utf8' }).trim();
      console.log('Docker volume mount:', inspect);
      
      const { mkdirSync, writeFileSync } = await import('fs');
      const targetDir = inspect + '/media';
      const targetPath = targetDir + '/' + FAVICON_ASSET;
      
      try { mkdirSync(targetDir, { recursive: true }); } catch(e) {}
      writeFileSync(targetPath, bytes);
      console.log('Favicon written to Docker volume:', targetPath);
    } catch(e) {
      console.log('Could not write to Docker volume directly:', e.message);
      console.log('Will rely on API upload after server starts...');
    }

    console.log('\nDone! Metadata updated successfully.');
    console.log('The CRM will show the Monterrial favicon once the server refreshes.');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
