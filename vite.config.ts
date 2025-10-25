import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Allow overriding base path for GitHub Pages (e.g., "/<repo>/").
  // Some CI providers inject the variable via process.env only, so honor both sources.
  const base = env.VITE_BASE || process.env.VITE_BASE || '/';
  return {
    base,
    plugins: [vue()],
    build: {
      manifest: 'manifest.json',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    }
  };
});
