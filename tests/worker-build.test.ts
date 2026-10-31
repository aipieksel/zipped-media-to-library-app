import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

const execute = promisify(execFile);
const buildScript = fileURLToPath(new URL('../scripts/build-worker.mjs', import.meta.url));

test('repeated Worker builds serve the current frontend and exclude previous server output', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'folio-worker-build-'));
  const hosting = JSON.stringify({project_id: 'synthetic-build-fixture', d1: 'DB', r2: 'BUCKET'});
  try {
    await mkdir(path.join(directory, '.openai'), {recursive: true});
    await mkdir(path.join(directory, 'worker'), {recursive: true});
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({type: 'module'}));
    await writeFile(path.join(directory, '.openai/hosting.json'), hosting);
    await writeFile(path.join(directory, 'worker/index.js'), `
      import assets from '../.sites-runtime/frontend-assets.json';
      export default {fetch(request) {
        const pathname = new URL(request.url).pathname;
        const asset = assets[pathname === '/' ? '/index.html' : pathname];
        return asset ? new Response(Uint8Array.from(atob(asset.body), character => character.charCodeAt(0)),
          {headers: {'content-type': asset.mime}}) : new Response('Missing', {status: 404});
      }};
    `);
    const bundlePath = path.join(directory, 'dist/server/index.js');
    let previousBundle: Buffer | undefined;
    for (const version of ['first', 'second']) {
      const scriptPath = `/assets/app-${version}.js`;
      const html = `<title>${version}</title><script src="${scriptPath}"></script>`;
      const script = `document.title = '${version} current frontend';`;
      await mkdir(path.join(directory, 'dist/assets'), {recursive: true});
      await writeFile(path.join(directory, 'dist/index.html'), html);
      await writeFile(path.join(directory, 'dist', scriptPath), script);
      await execute(process.execPath, [buildScript], {cwd: directory, timeout: 30_000});
      const bytes = await readFile(bundlePath);
      if (previousBundle) assert.equal(bytes.equals(previousBundle), false, 'second output must replace the previous Worker');
      const worker = (await import(`${pathToFileURL(bundlePath).href}?version=${version}`)).default;
      assert.equal(await (await worker.fetch(new Request('https://fixture.test/'))).text(), html);
      const response = await worker.fetch(new Request(`https://fixture.test${scriptPath}`));
      assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
      assert.equal(await response.text(), script);
      assert.equal((await worker.fetch(new Request('https://fixture.test/server/index.js'))).status, 404);
      if (version === 'second') assert.equal((await worker.fetch(new Request('https://fixture.test/assets/app-first.js'))).status, 404);
      assert.equal(await readFile(path.join(directory, 'dist/.openai/hosting.json'), 'utf8'), hosting);
      previousBundle = bytes;
    }
    await assert.rejects(execute(process.execPath, [buildScript], {cwd: directory, timeout: 30_000}), /dist\/index\.html is missing/);
    assert.deepEqual(await readFile(bundlePath), previousBundle, 'missing fresh frontend must not replace the last valid Worker');
  } finally {await rm(directory, {recursive: true, force: true});}
});
