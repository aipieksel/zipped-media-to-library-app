import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Keep the pinned package's relative entry → worker → WASM URLs together.
// Only executable app assets and their notices are published, never package demos.
export function vtracerAssets(): Plugin {
  const prefix = '/vendor/vtracer/';
  const packageRoot = new URL('../node_modules/vtracer-browser/', import.meta.url);
  const files = new Map<string, URL>([
    ['index.js', new URL('dist/index.js', packageRoot)],
    ['worker.js', new URL('dist/worker.js', packageRoot)],
    ['vtracer_bg.wasm', new URL('dist/vtracer_bg.wasm', packageRoot)],
    ['LICENSE', new URL('LICENSE', packageRoot)],
    ['THIRD_PARTY_NOTICES.txt', new URL('../THIRD_PARTY_NOTICES.md', import.meta.url)],
  ]);
  return {
    name: 'folio-local-tracer-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? '').split('?')[0];
        if (!pathname.startsWith(prefix)) return next();
        const name = pathname.slice(prefix.length);
        const filename = files.get(name);
        if (!filename) return next();
        void readFile(fileURLToPath(filename)).then(bytes => {
          response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8');
          response.end(bytes);
        }).catch(next);
      });
    },
    async generateBundle() {
      for (const [name, filename] of files) {
        this.emitFile({type: 'asset', fileName: `vendor/vtracer/${name}`, source: await readFile(filename)});
      }
    },
  };
}
