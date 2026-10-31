import { readFile, writeFile, readdir, mkdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
const assets = {};
const mimes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
async function collect(directory, base = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    // A previous Worker build may remain in the output directory. It is server
    // code, never a public frontend asset (and must not recursively embed itself).
    if (entry.name === '.openai' || (base === '' && entry.name === 'server')) continue;
    const relative = `${base}/${entry.name}`, local = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(local, relative);
    else assets[relative] = { mime: mimes[path.extname(entry.name)] ?? 'application/octet-stream', body: (await readFile(local)).toString('base64') };
  }
}
await collect('dist');
await mkdir('.sites-runtime', { recursive: true });
await writeFile('.sites-runtime/frontend-assets.json', JSON.stringify(assets));
await rm('dist', { recursive: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await build({ entryPoints: ['worker/index.js'], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', external: ['node:*'], outfile: 'dist/server/index.js', minify: true });
console.log(`Packaged existing frontend (${Object.keys(assets).length} assets) with private collection Worker.`);
