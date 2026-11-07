import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' + single-file output: dist/index.html works on GitHub Pages
// under any repo path AND when opened straight from disk (file://).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { target: 'es2019', chunkSizeWarningLimit: 1500 },
});
