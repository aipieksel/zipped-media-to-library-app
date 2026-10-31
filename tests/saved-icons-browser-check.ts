/// <reference types="vite/client" />
/** Real-browser storage checks. Load only from an ignored .qa page on the development origin. */
import JSZip from 'jszip';
import {uniqueId} from '../src/identity';
import {openIconCollection, UNCATEGORIZED_ICON_FOLDER_ID} from '../src/icon-collection';
import type {IconCollectionStore} from '../src/icon-collection';
import type {IconRecord, SaveArtworkInput} from '../src/icon-types';
import {convertRaster, decodeRasterPixels, verifySvgPixels} from '../src/png-svg-browser';
import {sanitizeSvg} from '../src/saved-svg';
import {buildSvgZip} from '../src/png-svg-download';
import {createPngFixtures} from './png-fixture-generator';

if (!import.meta.env.DEV) throw new Error('Saved Icons checks are available only in the development server.');
const prefix = 'folio-saved-icons-qa-';
const fixture = createPngFixtures().find(value => value.category === 'partial-alpha')!;
const file = () => new File([fixture.bytes], 'mark.png', {type: 'image/png', lastModified: 1_700_000_000_000});
function assert(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
async function rejected(action: () => Promise<unknown>, message: string): Promise<void> {try {await action();} catch {return;} throw new Error(message);}
function request<T>(value: IDBRequest<T>): Promise<T> {return new Promise((resolve, reject) => {value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error);});}
function committed(value: IDBTransaction): Promise<void> {return new Promise((resolve, reject) => {value.oncomplete = () => resolve(); value.onabort = () => reject(value.error ?? new Error('Transaction aborted')); value.onerror = () => reject(value.error);});}
async function sameBytes(a: Blob | undefined, b: Blob): Promise<boolean> {
  if (!a || a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const expected = new Uint8Array(right);
  return new Uint8Array(left).every((byte, index) => byte === expected[index]);
}
const verification = () => ({checkedAt: new Date().toISOString(), browser: navigator.userAgent, colorSpace: 'srgb' as const, pixelFormat: 'rgba8' as const});

async function withDatabase(operation: (state: {name: string; open: () => Promise<IconCollectionStore>; close: (store: IconCollectionStore) => void}) => Promise<unknown>): Promise<unknown> {
  const name = prefix + uniqueId();
  const handles = new Set<IconCollectionStore>();
  const open = async () => {const store = await openIconCollection(name); handles.add(store); return store;};
  const close = (store: IconCollectionStore) => {store.close(); handles.delete(store);};
  try {return await operation({name, open, close});}
  finally {
    for (const store of handles) store.close();
    assert(name.startsWith(prefix), 'Refusing to delete outside QA storage.');
    await request(indexedDB.deleteDatabase(name));
  }
}

async function counts(name: string): Promise<Record<string, number>> {
  const db = await request(indexedDB.open(name));
  try {
    const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly'), done = committed(tx);
    const entries = await Promise.all(names.map(async store => [store, await request(tx.objectStore(store).count())] as const));
    await done; return Object.fromEntries(entries);
  } finally {db.close();}
}

async function converted(store: IconCollectionStore, mode: 'pixels' | 'embedded' = 'pixels', folder?: string) {
  const report = await store.importEntries(folder ? {files: [{file: file(), relativePath: `${folder}/mark.png`, rootKey: folder}], directories: []} : {files: [{file: file(), relativePath: 'mark.png'}], directories: []}, mode);
  const item = report.added[0], job = await store.claimNext('saved-qa');
  assert(job?.id === item.id, 'The procedural source did not reach the queue.');
  const result = await convertRaster(file(), {mode});
  assert(await store.complete(job, result), 'The procedural conversion did not commit.');
  return {item, result};
}

function aiInput(sourceId: string, revision: number, folderId = UNCATEGORIZED_ICON_FOLDER_ID): SaveArtworkInput {
  const result = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fixture.width} ${fixture.height}"><circle cx="4" cy="4" r="3" fill="#56789a"/></svg>`, {width: fixture.width, height: fixture.height});
  return {name: 'mark.svg', folderId, svg: result.svg, width: fixture.width, height: fixture.height, source: {kind: 'icons', id: sourceId, revision, name: 'mark.png', mime: 'image/png', blob: file()}, provenance: {kind: 'ai', provider: 'qa-fixture', model: 'procedural-no-provider-call'}};
}

export async function runSavedIconChecks() {
  const report = {browser: navigator.userAgent, startedAt: new Date().toISOString(), completedAt: '', passed: 0, failed: 0, checks: [] as {name: string; status: 'pass' | 'fail'; details?: unknown; error?: string}[]};
  const check = async (name: string, operation: () => Promise<unknown>) => {
    try {const details = await operation(); report.passed++; report.checks.push({name, status: 'pass', details});}
    catch (error) {report.failed++; report.checks.push({name, status: 'fail', error: error instanceof Error ? error.message : String(error)});}
  };

  await check('Native v1→v2 migration retains original, output, folder and preferences without reset', () => withDatabase(async ({name, open}) => {
    const result = await convertRaster(file(), {mode: 'pixels'}), oldId = 'icon-existing-v1';
    const opening = indexedDB.open(name, 1);
    opening.onupgradeneeded = () => {
      const db = opening.result, icons = db.createObjectStore('icons', {keyPath: 'id'});
      icons.createIndex('byFolder', 'folderId'); icons.createIndex('byStatus', 'status');
      for (const store of ['folders', 'sources', 'outputs']) db.createObjectStore(store, {keyPath: 'id'});
      db.createObjectStore('prefs', {keyPath: 'key'});
    };
    const legacy = await request(opening), tx = legacy.transaction(['icons', 'folders', 'sources', 'outputs', 'prefs'], 'readwrite'), done = committed(tx);
    const {svg: originalSvg, ...metadata} = result;
    const item: IconRecord = {id: oldId, folderId: UNCATEGORIZED_ICON_FOLDER_ID, name: 'mark.png', sourceName: 'mark.png', sourcePath: 'mark.png', filename: 'mark.svg', size: file().size, lastModified: file().lastModified, createdAt: 1, updatedAt: 1, mode: 'pixels', revision: 1, status: 'ready', message: 'Existing saved conversion', favorite: true, result: metadata};
    tx.objectStore('icons').add(item); tx.objectStore('sources').add({id: oldId, blob: file()}); tx.objectStore('outputs').add({id: oldId, revision: 1, blob: new Blob([originalSvg], {type: 'image/svg+xml'})});
    tx.objectStore('folders').add({id: UNCATEGORIZED_ICON_FOLDER_ID, parentId: null, name: 'Uncategorized', createdAt: 1, favorite: true});
    tx.objectStore('prefs').add({key: 'workspace', value: {selectedId: oldId, defaultMode: 'smooth', zoom: '4', background: 'dark', expanded: [UNCATEGORIZED_ICON_FOLDER_ID], order: {sort: 'newest', group: 'folders'}}});
    await done; legacy.close();
    const store = await open(), snapshot = await store.snapshot();
    assert(snapshot.items.length === 1 && snapshot.saved.length === 0 && snapshot.items[0].favorite, 'Migration lost existing metadata.');
    assert(snapshot.preferences.selectedId === oldId && snapshot.preferences.defaultMode === 'smooth' && snapshot.preferences.zoom === '4' && snapshot.preferences.view === 'convert', 'Migration changed existing preferences.');
    assert(await (await store.getOutput(oldId, 1))?.text() === originalSvg, 'Migration changed existing output bytes.');
    assert(await sameBytes(await store.getSource(oldId), file()), 'Migration changed existing source bytes.');
    const saved = await store.saveConverted(oldId, 1);
    assert(saved.source.mime === 'image/png' && saved.recolorable, 'Legacy PNG result could not be saved.');
    return {from: 1, to: 2, stores: await counts(name), outputBytes: saved.outputBytes};
  }));

  await check('Save survives source/folder deletion and reload; recolor/reset/ZIP retain exact selected bytes', () => withDatabase(async ({name, open, close}) => {
    let store = await open(); const {item, result} = await converted(store, 'pixels', 'Source folder');
    const saved = await store.saveConverted(item.id, item.revision);
    await store.createFolder(saved.name, UNCATEGORIZED_ICON_FOLDER_ID);
    await store.remove(item.id); await store.removeFolder(item.folderId);
    close(store); store = await open();
    let record = (await store.snapshot()).saved.find(value => value.id === saved.id)!;
    assert(record?.folderId === UNCATEGORIZED_ICON_FOLDER_ID, 'Saved artwork was deleted with its conversion folder.');
    assert(record.name !== saved.name, 'Rehoming did not resolve a destination folder/name collision.');
    assert(await sameBytes(await store.getSavedSource(saved.id), file()), 'Saved source snapshot did not survive deletion/reload.');
    assert(await (await store.getSavedOutput(saved.id))?.text() === result.svg, 'Saved base changed after deletion/reload.');
    record = await store.recolorSaved(saved.id, '#1a73e8', record.revision);
    assert(record.color === '#1a73e8' && record.fidelity.status === 'unavailable' && record.fidelity.differingPixels === null && !record.verification, 'Color inherited a stale match badge.');
    const colored = await store.getSavedOutput(record.id, record.revision); assert(colored, 'Colored output is unavailable.');
    const decoded = await decodeRasterPixels(file());
    const fidelity = await verifySvgPixels(await colored.text(), decoded.pixels, record.width, record.height);
    assert(fidelity.status === 'different' && fidelity.differingPixels! > 0, 'Actual native check did not observe changed color.');
    assert(await store.recordSavedVerification(record.id, record.revision, fidelity, verification()), 'Actual current color verification could not be committed.');
    const zip = await JSZip.loadAsync(await buildSvgZip([{filename: record.filename, svg: await colored.text()}]));
    assert(await zip.file(record.filename)?.async('string') === await colored.text(), 'ZIP bytes differ from the current preview output.');
    const oldRevision = record.revision;
    record = await store.recolorSaved(record.id, null, record.revision);
    assert(await (await store.getSavedOutput(record.id, record.revision))?.text() === result.svg, 'Reset failed to restore exact original SVG bytes.');
    assert(JSON.stringify(record.fidelity) === JSON.stringify(result.fidelity), 'Reset did not restore the base check.');
    assert(!await store.recordSavedVerification(record.id, oldRevision, fidelity, verification()), 'A late color check stamped a newer reset.');
    close(store); store = await open();
    assert(await (await store.getSavedOutput(record.id))?.text() === result.svg, 'Reset did not persist across reload.');
    await store.removeSaved(record.id);
    assert(!await store.getSavedSource(record.id) && !await store.getSavedOutput(record.id), 'Explicit removal left saved blobs accessible.');
    const totals = await counts(name);
    assert(totals.savedIcons === 0 && totals.savedSvg === 0 && totals.savedSources === 0, 'Explicit removal left orphaned saved blobs.');
    return {nativeColorDifference: fidelity.differingPixels, clearedSavedStores: true};
  }));

  await check('Saved artwork transaction failure rolls back source/base/output/metadata and selection', () => withDatabase(async ({name, open}) => {
    const store = await open(), {item} = await converted(store), before = await counts(name), beforePreferences = (await store.snapshot()).preferences;
    const original = IDBObjectStore.prototype.add; let aborted = false;
    IDBObjectStore.prototype.add = function(value: unknown, key?: IDBValidKey) {
      const result = key === undefined ? original.call(this, value) : original.call(this, value, key);
      if (this.transaction.db.name === name && this.name === 'savedIcons') {aborted = true; this.transaction.abort();}
      return result;
    };
    try {await rejected(() => store.saveConverted(item.id, item.revision), 'An aborted saved transaction reported success.');}
    finally {IDBObjectStore.prototype.add = original;}
    assert(aborted, 'The actual saved transaction was not aborted.');
    assert(JSON.stringify(await counts(name)) === JSON.stringify(before), 'Aborted save left partial rows.');
    assert(JSON.stringify((await store.snapshot()).preferences) === JSON.stringify(beforePreferences), 'Aborted save changed selection.');
    const recovery = await store.saveConverted(item.id, item.revision); assert(recovery.id, 'Save failed after transaction recovery.');
    return {actualNativeTransactionAborted: true, recovered: true};
  }));

  await check('Retry during save and late saved-color mutations reject without overwriting newer data', () => withDatabase(async ({open}) => {
    const store = await open(), {item} = await converted(store), originalRead = Blob.prototype.arrayBuffer;
    let changed = false;
    Blob.prototype.arrayBuffer = async function() {
      if (!changed && this.type === 'image/png') {changed = true; await store.retry(item.id);}
      return originalRead.call(this);
    };
    try {await rejected(() => store.saveConverted(item.id, item.revision), 'A save accepted a source that retried during validation.');}
    finally {Blob.prototype.arrayBuffer = originalRead;}
    assert(changed && !(await store.snapshot()).saved.length, 'Stale conversion save created artwork.');
    await rejected(() => store.saveArtwork(aiInput(item.id, item.revision)), 'A late AI result accepted an old conversion revision.');
    const current = (await store.snapshot()).items[0], saved = await store.saveArtwork(aiInput(current.id, current.revision));
    const colored = await store.recolorSaved(saved.id, '#ff00cc', saved.revision);
    await rejected(() => store.recolorSaved(saved.id, '#00ccff', saved.revision), 'A late color write replaced a newer color.');
    const retained = (await store.snapshot()).saved[0]; assert(retained.revision === colored.revision && retained.color === '#ff00cc', 'Late color changed metadata.');
    await store.removeSaved(saved.id);
    assert(!await store.recordSavedVerification(saved.id, colored.revision, {status: 'verified', differingPixels: 0, totalPixels: fixture.width * fixture.height}, verification()), 'A late check resurrected removed saved artwork.');
    return {retryRejected: true, lateAIRejected: true, staleColorRejected: true, removedNotResurrected: true};
  }));

  await check('Trusted embedded save preserves exact original wrapper; forged wrappers, generic images and recolor remain rejected', () => withDatabase(async ({name, open}) => {
    const store = await open(), {item, result} = await converted(store, 'embedded');
    const saved = await store.saveConverted(item.id, item.revision);
    assert(!saved.recolorable && saved.provenance.kind === 'conversion' && saved.provenance.mode === 'embedded', 'Embedded save was mislabeled as editable.');
    assert(await (await store.getSavedOutput(saved.id))?.text() === result.svg, 'Embedded original-byte wrapper changed.');
    await rejected(() => store.recolorSaved(saved.id, '#ffffff', saved.revision), 'Embedded bitmap accepted vector recoloring.');
    await rejected(() => store.saveArtwork({...aiInput(item.id, item.revision), svg: result.svg}), 'AI save accepted a raster image element.');
    const forged = result.svg.replace('base64,i', 'base64,j'); assert(forged !== result.svg && forged.length === result.svg.length, 'The procedural forged wrapper must keep metadata byte length.');
    const native = await request(indexedDB.open(name)), tx = native.transaction('outputs', 'readwrite'), done = committed(tx);
    tx.objectStore('outputs').put({id: item.id, revision: item.revision, blob: new Blob([forged], {type: 'image/svg+xml'})});
    await done; native.close();
    await rejected(() => store.saveConverted(item.id, item.revision), 'A forged embedded wrapper passed original-byte validation.');
    await store.remove(item.id);
    assert(await sameBytes(await store.getSavedSource(saved.id), file()), 'Saved bitmap source was removed with conversion.');
    return {exactBytes: true, recolorable: false};
  }));

  await check('Distinct saves have stable safe names, favorites/move persistence and validated pixel metadata', () => withDatabase(async ({open, close}) => {
    let store = await open(); const {item} = await converted(store);
    const a = await store.saveArtwork(aiInput(item.id, item.revision)), b = await store.saveArtwork(aiInput(item.id, item.revision));
    assert(a.id !== b.id && a.filename.toLowerCase() !== b.filename.toLowerCase(), 'Distinct saves collided.');
    const folder = await store.createFolder('Saved family');
    await store.moveSaved(a.id, folder.id); await store.setSavedFavorite(a.id, true);
    await store.setPreferences({view: 'saved', savedSelectedId: a.id});
    await rejected(() => store.recordSavedVerification(a.id, a.revision, {status: 'verified', differingPixels: 1, totalPixels: fixture.width * fixture.height}, verification()), 'Inconsistent verification count was accepted.');
    close(store); store = await open(); const snapshot = await store.snapshot(), restored = snapshot.saved.find(value => value.id === a.id);
    assert(restored?.folderId === folder.id && restored.favorite && snapshot.preferences.savedSelectedId === a.id && snapshot.preferences.view === 'saved', 'Saved organization/selection failed to persist.');
    return {savedCount: snapshot.saved.length, filenames: snapshot.saved.map(value => value.filename)};
  }));
  report.completedAt = new Date().toISOString(); return report;
}
