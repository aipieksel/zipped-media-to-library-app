import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Keep the pinned package's relative entry → worker → WASM URLs together.
// Only executable app assets and its license are published, never package demos.
export function vtracerAssets(): Plugin {
  const prefix = '/vendor/vtracer/';
  const packageRoot = new URL('../node_modules/vtracer-browser/', import.meta.url);
  const files = new Map([
    ['index.js', 'dist/index.js'],
    ['worker.js', 'dist/worker.js'],
    ['vtracer_bg.wasm', 'dist/vtracer_bg.wasm'],
    ['LICENSE', 'LICENSE'],
  ]);
  return {
    name: 'folio-local-tracer-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? '').split('?')[0];
        if (!pathname.startsWith(prefix)) return next();
        const filename = files.get(pathname.slice(prefix.length));
        if (!filename) return next();
        void readFile(fileURLToPath(new URL(filename, packageRoot))).then(bytes => {
          response.setHeader('Content-Type', filename.endsWith('.wasm') ? 'application/wasm' : filename.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8');
          response.end(bytes);
        }).catch(next);
      });
    },
    async generateBundle() {
      for (const [name, filename] of files) {
        this.emitFile({type: 'asset', fileName: `vendor/vtracer/${name}`, source: await readFile(new URL(filename, packageRoot))});
      }
    },
  };
}
