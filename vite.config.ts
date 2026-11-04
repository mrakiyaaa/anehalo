import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const developmentHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  clearScreen: false,
  server: {
    // Tauri connects to this fixed port when starting the native window.
    port: 1420,
    strictPort: true,
    host: developmentHost || false,
    ...(developmentHost ? { hmr: { protocol: 'ws', host: developmentHost, port: 1421 } } : {}),
    watch: { ignored: ['**/src-tauri/**'] },
  },
});
