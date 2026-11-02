import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = process.env['QBANK_API_PORT'] ?? '3000';

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: { outDir: '../../dist/web', emptyOutDir: true },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.dev.remote.e-m.sa'],
    // xfwd: the API sees the browser's host in X-Forwarded-Host (QBANK_TRUST_PROXY=true).
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, xfwd: true } },
  },
});
