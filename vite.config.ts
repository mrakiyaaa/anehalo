import { fileURLToPath, URL } from 'node:url';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const developmentHost = process.env.TAURI_DEV_HOST;
const resolveDependency = createRequire(import.meta.url).resolve;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The DOM decoder cannot run in the search worker; both decode the same entities.
      'decode-named-character-reference': resolveDependency('decode-named-character-reference'),
    },
  },
  clearScreen: false,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'preload-helper', test: /vite[\\/]preload-helper/, priority: 40 },
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'motion',
              test: /[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
            },
            { name: 'radix', test: /[\\/]node_modules[\\/]@radix-ui[\\/]/ },
            { name: 'tiptap', test: /[\\/]node_modules[\\/]@tiptap[\\/]/ },
            {
              name: 'tiptap-core',
              test: /[\\/]node_modules[\\/]@tiptap[\\/]core[\\/]/,
              priority: 20,
            },
            { name: 'prosemirror', test: /[\\/]node_modules[\\/]prosemirror-/ },
            {
              name: 'markdown',
              test: /[\\/]node_modules[\\/](marked|mdast-|micromark|decode-named|character-entities|entities|parse-entities)/,
            },
            { name: 'pdf', test: /[\\/]node_modules[\\/]jspdf[\\/]/ },
            { name: 'canvas', test: /[\\/]node_modules[\\/]html2canvas[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    // Tauri connects to this fixed port when starting the native window.
    port: 1420,
    strictPort: true,
    host: developmentHost || false,
    ...(developmentHost ? { hmr: { protocol: 'ws', host: developmentHost, port: 1421 } } : {}),
    watch: { ignored: ['**/src-tauri/**'] },
  },
});
