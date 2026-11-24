import { fileURLToPath, URL } from 'node:url';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const developmentHost = process.env.TAURI_DEV_HOST;
const resolveDependency = createRequire(import.meta.url).resolve;
const excalidrawPackage = /[\\/]node_modules[\\/]@excalidraw[\\/]/;

function isAppDependency(id: string, pattern: RegExp) {
  return pattern.test(id) && !excalidrawPackage.test(id);
}

const excalidrawFontCdn = /`https:\/\/esm\.sh\/\$\{[\s\S]*?\}\/dist\/prod\/`/;

/**
 * Excalidraw lists a CDN after the local copy in every font source. Chromium checks each source
 * against the CSP even when the local one loads, so the CDN entry only produces errors, and it
 * would reach the network if the CSP ever allowed it. Point the fallback at the bundled fonts
 * too (the folder scripts/copy-excalidraw-assets.mjs fills). Fails loudly after an upgrade that
 * changes this code.
 */
function offlineExcalidrawFonts(): Plugin {
  return {
    name: 'anehalo-offline-excalidraw-fonts',
    transform(code, id) {
      if (!excalidrawPackage.test(id) || !code.includes('ASSETS_FALLBACK_URL')) return null;
      const patched = code.replace(excalidrawFontCdn, '`${window.location.origin}/excalidraw/`');
      if (patched === code) this.error(`Excalidraw's font CDN fallback was not found in ${id}.`);
      return { code: patched, map: null };
    },
  };
}

const fontSubsetStubs: Readonly<Record<string, string>> = {
  './subset-shared.chunk.js': fileURLToPath(
    new URL('./src/features/diagrams/font-subset-shared-stub.ts', import.meta.url),
  ),
  './subset-worker.chunk.js': fileURLToPath(
    new URL('./src/features/diagrams/font-subset-worker-stub.ts', import.meta.url),
  ),
};

/**
 * SVG export embeds fonts, and Excalidraw first subsets them with WebAssembly code that creates
 * functions from strings, which the app's CSP refuses (and must keep refusing). That logged
 * errors on every export before Excalidraw fell back to whole fonts. The two chunks that do the
 * subsetting are replaced by ones that pass fonts through unchanged: the same result, without
 * the errors, and without shipping the WebAssembly.
 */
function plainExcalidrawFonts(): Plugin {
  return {
    name: 'anehalo-plain-excalidraw-fonts',
    enforce: 'pre',
    resolveId(source, importer) {
      const stub = fontSubsetStubs[source];
      return stub && importer && excalidrawPackage.test(importer) ? stub : null;
    },
  };
}

export default defineConfig({
  plugins: [offlineExcalidrawFonts(), plainExcalidrawFonts(), react(), tailwindcss()],
  // Development pre-bundles dependencies without the plugins above.
  optimizeDeps: {
    rolldownOptions: { plugins: [offlineExcalidrawFonts(), plainExcalidrawFonts()] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The DOM decoder cannot run in the search worker; both decode the same entities.
      'decode-named-character-reference': resolveDependency('decode-named-character-reference'),
      // Excalidraw's Mermaid converter (text-to-diagram) is replaced by a stub, so it is never
      // bundled and can never load, from a menu, a shortcut, or a paste.
      '@excalidraw/mermaid-to-excalidraw': fileURLToPath(
        new URL('./src/features/diagrams/text-to-diagram-unavailable.ts', import.meta.url),
      ),
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
            {
              name: 'radix',
              // Excalidraw nests its own @radix-ui copies. They belong in its lazy chunks, not in
              // this chunk, which loads at startup.
              test: (id: string) => isAppDependency(id, /[\\/]node_modules[\\/]@radix-ui[\\/]/),
            },
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
