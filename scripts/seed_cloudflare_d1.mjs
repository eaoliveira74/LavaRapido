import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const cloudflareDir = resolve(root, 'cloudflare');
const seedFile = resolve(cloudflareDir, 'seed_appointments.sql');

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('ERROR: CLOUDFLARE_API_TOKEN is not defined in the environment.');
  console.error('Create a Cloudflare API token and set CLOUDFLARE_API_TOKEN before running this script.');
  process.exit(1);
}

try {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'lava_rapido_db', '--remote', '--file', seedFile, '-y'],
    {
      cwd: cloudflareDir,
      stdio: 'inherit',
      env: { ...process.env }
    }
  );
  process.exit(0);
} catch (error) {
  console.error('Failed to seed Cloudflare D1.');
  if (error.status !== undefined) process.exit(error.status);
  process.exit(1);
}
