import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {hashBytes, SharedWorkspaceClient, SharedWorkspaceError, SHARED_CHUNK_BYTES, SHARED_DOCUMENT_BYTES, validateBlobReference} from '../src/shared/client';
import {decodeDataset, emptyDataset, encodeDataset, reconcileDatasets, resolveRecord, selectSharedRecords, stableJson, validateDataset} from '../src/shared/codec';
import type {DatasetRecords} from '../src/shared/codec';
import {readDatasetDocument, writeDatasetDocument} from '../src/shared/documents';
import {sharedIconIdentity, validateSharedIconSvg} from '../src/shared/icon-trust';
import {configureSharedWorkspace, resolveSharedRecord, sharedDatabaseName} from '../src/shared/runtime';
import {parseArchive} from '../src/archive';
import {createEmbeddedRasterSvg} from '../src/raster-input';
import {createPngFixtures} from './png-fixture-generator';
import {createSharedMemoryServer} from './shared-client-fixture';
import {sameMigrationRecord} from '../src/shared/migration-equality';
import {resolveIconNameCollisions} from '../src/shared/icon-names';
import {buildSvgZip} from '../src/png-svg-download';
import type {IconRecord} from '../src/icon-types';

test('default and injected browser fetch receive a valid global receiver during workspace startup', async () => {
  const calls: string[] = [];
  // Browser-native fetch rejects a class instance as its receiver. Arrow-based
  // transports ignore this contract and previously hid the production failure.
  const browserFetch = async function(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    assert.ok(this === undefined || this === globalThis, 'fetch must not receive the shared client as its receiver');
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal instanceof AbortSignal);
    const path = String(input); calls.push(path);
    const name = path.split('/').at(-1);
    return Response.json({name, revision: 0, data: null, blobs: [], updatedAt: null});
  } as typeof fetch;
  const originalFetch = globalThis.fetch;
  let defaultClient: SharedWorkspaceClient;
  try {globalThis.fetch = browserFetch; defaultClient = new SharedWorkspaceClient();}
  finally {globalThis.fetch = originalFetch;}
  const injectedClient = new SharedWorkspaceClient(browserFetch);
  try {
    for (const client of [defaultClient!, injectedClient]) {
      const documents = await Promise.all(['library', 'icons', 'appearance'].map(name => client.read(name as 'library' | 'icons' | 'appearance')));
      assert.deepEqual(documents.map(document => document.name), ['library', 'icons', 'appearance']);
    }
    assert.equal(calls.length, 6);
  } finally {defaultClient!.close(); injectedClient.close();}
});

test('two independent clients preserve exact large bytes through bounded chunks and reject stale CAS', async () => {
  const server = createSharedMemoryServer(), first = new SharedWorkspaceClient(server.fetcher), second = new SharedWorkspaceClient(server.fetcher);
  const bytes = new Uint8Array(SHARED_CHUNK_BYTES + 71); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const reference = await first.upload(new Blob([bytes], {type: 'image/png'}));
  assert.equal(reference.chunks.length, 2);
  const [left, right] = await Promise.all([first.read('library'), second.read('library')]);
  await first.write('library', {reference}, reference.chunks.map(chunk => chunk.hash), left.revision);
  await assert.rejects(second.write('library', {changed: true}, [], right.revision), (error: unknown) => error instanceof SharedWorkspaceError && error.code === 'conflict' && error.status === 409);
  const reconstructed = await second.download(reference); assert.equal(reconstructed.type, 'image/png'); assert.deepEqual(new Uint8Array(await reconstructed.arrayBuffer()), bytes);
  assert.ok(server.calls.filter(call => call.path.includes('/blobs/') && call.method === 'PUT').every(call => call.bytes <= SHARED_CHUNK_BYTES));
  first.close(); second.close();
});

test('packed slices retain exact boundaries, MIME and hashes; invalid slices and corrupt chunks are rejected', async () => {
  const server = createSharedMemoryServer(), writer = new SharedWorkspaceClient(server.fetcher), reader = new SharedWorkspaceClient(server.fetcher);
  const originals = [new Blob(['alpha'], {type: 'text/html'}), new Blob([new Uint8Array([0, 255, 23])], {type: 'image/png'}), new Blob(['γδ'], {type: 'image/svg+xml'})];
  const references = await writer.uploadMany(originals), hashes = [...new Set(references.flatMap(reference => reference.chunks.map(chunk => chunk.hash)))];
  assert.equal(hashes.length, 1); await writer.write('library', {references}, hashes, 0);
  for (const [index, reference] of references.entries()) {
    const restored = await reader.download(reference); assert.equal(restored.type, originals[index].type); assert.deepEqual(await restored.arrayBuffer(), await originals[index].arrayBuffer());
  }
  assert.equal(server.calls.filter(call => call.method === 'GET' && call.path.includes('/blobs/')).length, 1, 'verified pack is reused without repeated requests');
  const invalid = structuredClone(references[0]); invalid.chunks[0].offset = invalid.chunks[0].size;
  assert.throws(() => validateBlobReference(invalid), /slice/);
  const corrupt = new SharedWorkspaceClient(server.fetcher); server.chunks.set(hashes[0], new Uint8Array(server.chunks.get(hashes[0])!.length));
  await assert.rejects(corrupt.download(references[0]), /integrity/);
  writer.close(); reader.close(); corrupt.close();
});

test('a real 20,000-entry ZIP is atomically shared through bounded metadata manifests and file packs', async () => {
  const zip = new JSZip();
  for (let i = 0; i < 20_000; i++) zip.file(`page-${i}.html`, `<!doctype html><title>Fixture ${i}</title>`, {createFolders: false});
  const bundle = await parseArchive(await zip.generateAsync({type: 'arraybuffer', compression: 'STORE'}), '20k-fixture.zip');
  assert.equal(bundle.files.length, 20_000);
  const server = createSharedMemoryServer(), writer = new SharedWorkspaceClient(server.fetcher), reader = new SharedWorkspaceClient(server.fetcher);
  const records = {...emptyDataset('library').stores, archives: bundle.archives, files: bundle.files, pages: bundle.pages} as unknown as DatasetRecords;
  const encoded = await encodeDataset('library', records, writer);
  assert.ok(new Blob([stableJson(encoded.data)]).size > SHARED_DOCUMENT_BYTES);
  await writeDatasetDocument(writer, 'library', encoded.data, encoded.blobs, 0);
  const published = server.documents.get('library')!;
  assert.ok(published.blobs.length < 10, `packed root references ${published.blobs.length} chunks`);
  assert.ok(server.calls.filter(call => call.path.includes('/documents/') && call.method === 'PUT').every(call => call.bytes <= SHARED_DOCUMENT_BYTES));
  const document = await readDatasetDocument(reader, 'library'), decoded = decodeDataset(validateDataset(document.data, 'library', document.blobs));
  assert.equal(decoded.files.length, 20_000); assert.equal(decoded.pages.length, 20_000);
  for (const index of [0, 9999, 19999]) {
    const restored = await resolveRecord(decoded.files[index], reader);
    assert.equal(await (restored.blob as Blob).text(), await bundle.files[index].blob.text());
  }
  assert.deepEqual(document.data, encoded.data);
  const addition = await parseArchive(await new JSZip().file('extra.html', '<title>Additional import</title>').generateAsync({type: 'arraybuffer'}), 'additional.zip');
  const cumulative = await encodeDataset('library', {...decoded, archives: [...decoded.archives, ...addition.archives as unknown as Record<string, unknown>[]], files: [...decoded.files, ...addition.files as unknown as Record<string, unknown>[]], pages: [...decoded.pages, ...addition.pages as unknown as Record<string, unknown>[]]}, writer);
  await writeDatasetDocument(writer, 'library', cumulative.data, cumulative.blobs, 1);
  assert.equal(validateDataset((await readDatasetDocument(reader, 'library')).data, 'library').stores.files.length, 20_001, '20k is a per-import bound, not a cumulative workspace ceiling');
  writer.close(); reader.close();
});

test('migration recognizes identical bytes after pack layout changes and refuses actual content changes', async () => {
  const server = createSharedMemoryServer(), client = new SharedWorkspaceClient(server.fetcher);
  const original = new Blob(['unchanged file'], {type: 'text/html'}), first = (await client.uploadMany([original]))[0];
  await client.write('library', {reference: first}, first.chunks.map(chunk => chunk.hash), 0);
  const repacked = (await client.uploadMany([original, new Blob(['new file'])]))[0];
  assert.notDeepEqual(first, repacked);
  assert.equal(await sameMigrationRecord({id: 'same', blob: first}, {id: 'same', blob: repacked}, {id: 'same', blob: original}, client), true);
  assert.equal(await sameMigrationRecord({id: 'same', blob: first}, {id: 'same', blob: repacked}, {id: 'same', blob: new Blob(['different file'])}, client), false);
  client.close();
});

test('SHA256 remains exact on managed HTTP previews without SubtleCrypto', async () => {
  const prior = Object.getOwnPropertyDescriptor(crypto, 'subtle');
  Object.defineProperty(crypto, 'subtle', {configurable: true, value: undefined});
  try {assert.equal(await hashBytes(new TextEncoder().encode('abc').buffer), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');}
  finally {if (prior) Object.defineProperty(crypto, 'subtle', prior); else delete (crypto as unknown as {subtle?: unknown}).subtle;}
});

test('metadata validates all UI-required fields and excludes curated files, device preferences and worker leases', () => {
  const selected = selectSharedRecords('library', {archives: [{id: 'cloud-root', cloud: true}, {id: 'local-root'}], pages: [{id: 'cloud-root/a', archiveId: 'cloud-root'}], prefs: [{key: 'favoriteFolders', value: ['local-root']}, {key: 'ai-token', value: 'private'}]});
  assert.deepEqual(selected.archives, [{id: 'local-root'}]); assert.equal(selected.pages.length, 0); assert.deepEqual(selected.prefs, [{key: 'favoriteFolders', value: ['local-root']}]);
  const pending = selectSharedRecords('icons', {icons: [{id: 'one', status: 'processing', claim: {token: 'secret'}, sharedPending: true}, {id: 'two', status: 'ready', sharedPending: true}]});
  assert.equal(pending.icons[0].status, 'cancelled'); assert.equal(pending.icons[0].sharedPending, true); assert.equal(pending.icons[0].claim, undefined); assert.equal(pending.icons[1].sharedPending, undefined);
  const bad = emptyDataset('icons'); bad.stores.savedIcons.push({id: 'one', folderId: 'folder', revision: 1, name: 'incomplete'});
  assert.throws(() => validateDataset(bad, 'icons'), /metadata/);
  const prefs = emptyDataset('library'); prefs.stores.prefs.push({key: 'favoriteFolders', value: 'not-an-array'});
  assert.throws(() => validateDataset(prefs, 'library'), /metadata/);
  const source = emptyDataset('icons'); source.stores.sources.push({id: 'missing-bytes'});
  assert.throws(() => validateDataset(source, 'icons'), /file reference/);
});

test('explicit recovery merges independent edits and rejects a changed same record', () => {
  const base = emptyDataset('library'); base.stores.folders.push({id: 'a', name: 'One', createdAt: 1});
  const candidate = structuredClone(base), latest = structuredClone(base);
  candidate.stores.folders.push({id: 'b', name: 'Two', createdAt: 2}); latest.stores.folders[0].name = 'Renamed';
  const reconciled = reconcileDatasets(base, candidate, latest);
  assert.deepEqual(reconciled.stores.folders.map(row => row.name), ['Renamed', 'Two']);
  candidate.stores.folders[0].name = 'Different';
  assert.throws(() => reconcileDatasets(base, candidate, latest), /same record/);
});

test('concurrent same-name icon and Saved additions keep safe ZIP names, including a lost retry acknowledgement', async () => {
  const server = createSharedMemoryServer(), client = new SharedWorkspaceClient(server.fetcher), fixture = createPngFixtures()[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fixture.width}" height="${fixture.height}" viewBox="0 0 ${fixture.width} ${fixture.height}"><path d="M0 0H1V1Z"/></svg>`;
  const source = new Blob([fixture.bytes], {type: 'image/png'}), output = new Blob([svg], {type: 'image/svg+xml'});
  const base = emptyDataset('icons'); base.stores.folders.push({id: 'folder', parentId: null, name: 'Uncategorized', createdAt: 0, favorite: false});
  const fidelity = {status: 'unavailable', differingPixels: null, totalPixels: fixture.width * fixture.height};
  const engine = {id: 'fixture', name: 'Fixture', version: '1'}, verification = {checkedAt: '2026-10-31T00:00:00Z', browser: 'Synthetic fixture', colorSpace: 'srgb', pixelFormat: 'rgba8'};
  const candidate = async (id: string) => {
    const stores = structuredClone(base.stores), saved = `saved-${id}`;
    stores.icons.push({id, folderId: 'folder', name: 'mark.png', sourceName: 'mark.png', sourcePath: 'mark.png', filename: 'mark.svg', size: source.size, lastModified: 1, createdAt: 1, updatedAt: 1, mode: 'pixels', revision: 1, status: 'ready', message: 'Fixture', favorite: false, result: {mode: 'pixels', width: fixture.width, height: fixture.height, rectangleCount: 1, pathCount: null, engine, verification, sourceFormat: 'png', sourceBytes: source.size, outputBytes: output.size, fidelity, warnings: []}});
    stores.sources.push({id, blob: source}); stores.outputs.push({id, revision: 1, blob: output});
    stores.savedIcons.push({id: saved, folderId: 'folder', name: 'mark.svg', filename: 'mark.svg', createdAt: 1, updatedAt: 1, favorite: false, revision: 1, width: fixture.width, height: fixture.height, outputBytes: output.size, baseOutputBytes: output.size, source: {kind: 'icons', id, revision: 1, name: 'mark.png', mime: 'image/png', size: source.size}, provenance: {kind: 'conversion', mode: 'pixels', engine}, recolorable: true, color: null, fidelity, baseFidelity: fidelity});
    stores.savedSources.push({id: saved, blob: source}); stores.savedSvg.push({id: saved, revision: 1, base: output, output});
    return (await encodeDataset('icons', stores, client)).data;
  };
  const staged = await candidate('staged'), latest = await candidate('latest'), merged = reconcileDatasets(base, staged, latest);
  for (const store of ['icons', 'savedIcons']) {
    const records = merged.stores[store];
    assert.equal(records.find(row => String(row.id).endsWith('latest'))?.filename, 'mark.svg');
    assert.equal(records.find(row => String(row.id).endsWith('staged'))?.filename, 'mark (2).svg');
    assert.equal(new Set(records.map(row => String(row.name).toLowerCase())).size, 2);
    assert.ok((await buildSvgZip(records.map(row => ({filename: String(row.filename), svg})))).size > 0);
  }
  assert.deepEqual(reconcileDatasets(base, staged, merged), merged, 'retry after a lost acknowledgement preserves already allocated names');
  const migrationMerge = {...latest, stores: Object.fromEntries(Object.keys(latest.stores).map(store => [store, store === 'folders' ? latest.stores[store] : [...latest.stores[store], ...staged.stores[store]]]))};
  assert.deepEqual(resolveIconNameCollisions(migrationMerge, latest).stores.savedIcons.map(row => row.filename), ['mark.svg', 'mark (2).svg']);
  client.close();
});

test('shared SVGs reject active payloads and forged embedded wrappers; checks bind exact chunk identities', async () => {
  const fixture = createPngFixtures()[0], source = new Blob([fixture.bytes], {type: 'image/png'});
  const item = {id: 'icon-one', revision: 1, mode: 'pixels', result: {width: fixture.width, height: fixture.height}} as IconRecord;
  const active = `<svg xmlns="http://www.w3.org/2000/svg" width="${fixture.width}" height="${fixture.height}"><script>alert(1)</script></svg>`;
  await assert.rejects(validateSharedIconSvg(new Blob([active]), source, item), /unsupported|vector/);
  await assert.rejects(validateSharedIconSvg(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H1V1Z"/></svg>']), source, item), /native width/);
  const embedded = createEmbeddedRasterSvg(fixture.bytes, fixture.width, fixture.height);
  assert.equal(await validateSharedIconSvg(new Blob([embedded]), source, {...item, mode: 'embedded'}), embedded);
  await assert.rejects(validateSharedIconSvg(new Blob([embedded.replace('</svg>', '<script>x</script></svg>')]), source, {...item, mode: 'embedded'}), /exact original/);
  const first = sharedIconIdentity(item, {__folioSharedBlobs: {blob: {chunks: [{hash: 'one'}]}}}, {__folioSharedBlobs: {blob: {chunks: [{hash: 'old'}]}}});
  const changed = sharedIconIdentity(item, {__folioSharedBlobs: {blob: {chunks: [{hash: 'one'}]}}}, {__folioSharedBlobs: {blob: {chunks: [{hash: 'new'}]}}});
  assert.notEqual(first, changed);
});

test('logout aborts response bodies and shared placeholders cannot fall through to the original local databases', async () => {
  let signal: AbortSignal | undefined, bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    signal = init?.signal ?? undefined;
    return new Response(new ReadableStream<Uint8Array>({start(controller) {bodyController = controller; signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), {once: true});}}), {headers: {'content-type': 'application/json'}});
  };
  const client = new SharedWorkspaceClient(fetcher), pending = client.read('library');
  await Promise.resolve(); assert.ok(bodyController); client.close(); assert.equal(signal?.aborted, true);
  await assert.rejects(pending, (error: unknown) => error instanceof SharedWorkspaceError && error.code === 'signed-out');
  configureSharedWorkspace({enabled: true});
  assert.throws(() => sharedDatabaseName('folio-workspace'), /Sign in/);
  await assert.rejects(resolveSharedRecord({blob: new Blob(), __folioSharedBlobs: {blob: {}}}), /Sign in/);
  configureSharedWorkspace({enabled: false}); assert.equal(sharedDatabaseName('folio-workspace'), 'folio-workspace');
});
