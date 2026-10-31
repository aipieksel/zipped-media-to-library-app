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
if (!Object.hasOwn(assets, '/index.html')) {
  throw new Error('Build the frontend before packaging: dist/index.html is missing.');
}
const assetJson = JSON.stringify(assets);
const assetManifestPath = path.resolve('.sites-runtime/frontend-assets.json');
await mkdir('.sites-runtime', { recursive: true });
await writeFile(assetManifestPath, assetJson);
await rm('dist', { recursive: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
// Select Worker-native request context. Better Auth's browser fallback uses a
// single global context and cannot isolate concurrent authenticated requests.
const result = await build({
  absWorkingDir: process.cwd(), entryPoints: ['worker/index.js'], bundle: true,
  platform: 'browser', conditions: ['workerd'], format: 'esm', target: 'es2022',
  external: ['node:*'], outfile: 'dist/server/index.js', minify: true, write: false,
  // Pin the asset input to this build's captured bytes. Return output to this
  // process so an old child-process outfile cannot be silently packaged.
  plugins: [{name: 'current-frontend-assets', setup(builder) {
    builder.onLoad({filter: /[/\\]\.sites-runtime[/\\]frontend-assets\.json$/}, args =>
      args.path === assetManifestPath ? {contents: assetJson, loader: 'json'} : undefined);
  }}],
});
if (result.outputFiles?.length !== 1) throw new Error('Expected exactly one bundled Worker.');
const workerBytes = Buffer.from(result.outputFiles[0].contents);
const workerText = workerBytes.toString('utf8');
for (const [name, asset] of Object.entries(assets)) {
  if (!workerText.includes(JSON.stringify(name)) || !workerText.includes(asset.body)) {
    throw new Error(`Bundled Worker is missing current frontend asset: ${name}`);
  }
}
await writeFile('dist/server/index.js', workerBytes);
if (!(await readFile('dist/server/index.js')).equals(workerBytes)) {
  throw new Error('Written Worker differs from the verified build output.');
}
console.log(`Packaged existing frontend (${Object.keys(assets).length} assets) with private collection Worker.`);
