import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// A local-only QA server for the exact frontend bytes packaged for the Worker.
// It never substitutes a development entry for the application. The separate
// procedural harness is exposed here only, never included in production assets.
const root = new URL('../', import.meta.url);
const assets = JSON.parse(await readFile(new URL('.sites-runtime/frontend-assets.json', root), 'utf8'));
const harnessPath = new URL('.qa/icon-built-check.js', root);
await build({
  entryPoints: [fileURLToPath(new URL('tests/icon-collection-browser-check.ts', root))],
  outfile: fileURLToPath(harnessPath), bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  define: { 'import.meta.env.DEV': 'true', 'import.meta.env.BASE_URL': '"/"' },
});
const harnessHtml = (await readFile(new URL('.qa/icon-library-check.html', root), 'utf8'))
  .replace('/tests/icon-collection-browser-check.ts', '/.qa/icon-built-check.js');
await writeFile(new URL('.qa/icon-built-check.html', root), harnessHtml);
const harnessJs = await readFile(harnessPath);
const portArgument = process.argv.indexOf('--port');
const port = Number(portArgument >= 0 ? process.argv[portArgument + 1] : process.env.FOLIO_PREVIEW_PORT ?? process.env.PORT ?? 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a local preview port from 1024 to 65535.');
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  let mime, body;
  if (pathname === '/.qa/icon-library-check.html') { mime = 'text/html; charset=utf-8'; body = harnessHtml; }
  else if (pathname === '/.qa/icon-built-check.js') { mime = 'text/javascript; charset=utf-8'; body = harnessJs; }
  else {
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset) { response.writeHead(404); response.end('No asset at this path.'); return; }
    mime = asset.mime; body = Buffer.from(asset.body, 'base64');
  }
  response.setHeader('Content-Type', mime);
  response.writeHead(200); response.end(request.method === 'HEAD' ? undefined : body);
});
server.listen(port, '0.0.0.0', () => console.log(`Exact built frontend and local-only QA harness: http://localhost:${port}/.qa/icon-library-check.html`));
