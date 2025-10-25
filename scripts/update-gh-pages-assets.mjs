import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const targetDir = path.join(rootDir, 'gh-pages');
const targetAssetsDir = path.join(targetDir, 'assets');

async function ensureDistExists() {
  try {
    const stats = await fs.stat(distDir);
    if (!stats.isDirectory()) {
      throw new Error();
    }
  } catch (err) {
    throw new Error('Expected dist/ directory after build, but it was not found.');
  }
}

async function copyManifest() {
  const manifestSource = path.join(distDir, 'manifest.json');
  try {
    await fs.copyFile(manifestSource, path.join(targetDir, 'manifest.json'));
  } catch (err) {
    throw new Error('Failed to copy manifest.json from dist/. Did you enable build.manifest in Vite config?');
  }
}

async function copyAssets() {
  await fs.mkdir(targetAssetsDir, { recursive: true });
  const entries = await fs.readdir(distAssetsDir);
  await Promise.all(
    entries.map((entry) =>
      fs.copyFile(path.join(distAssetsDir, entry), path.join(targetAssetsDir, entry))
    )
  );
}

async function cleanTarget() {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
}

async function main() {
  await ensureDistExists();
  await cleanTarget();
  await copyAssets();
  await copyManifest();
  console.log('gh-pages assets synchronized successfully.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
