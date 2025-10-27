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

async function annotateManifest(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const manifest = JSON.parse(raw);
    manifest._comentario = 'Este manifest relaciona os arquivos de entrada do Vite aos bundles usados em produção. Ele é sobrescrito automaticamente pelo script scripts/update-gh-pages-assets.mjs durante o build.';
    await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  } catch (err) {
    console.warn('Não foi possível anotar manifest.json com o comentário esperado:', err.message || err);
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
  await annotateManifest(path.join(targetDir, 'manifest.json'));
  console.log('gh-pages assets synchronized successfully.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
