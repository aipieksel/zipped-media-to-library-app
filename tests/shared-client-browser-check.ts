/// <reference types="vite/client" />
import {deleteDB} from 'idb';
import JSZip from 'jszip';
import {importImages, parseArchive} from '../src/archive';
import {createFolder, getFile, listWorkspace, moveItemsToFolder, openWorkspaceDatabase, saveImport, setItemFavorite, setPreference} from '../src/db';
import {openIconCollection} from '../src/icon-collection';
import type {IconCollectionStore} from '../src/icon-collection';
import {convertPng} from '../src/png-svg-browser';
import {buildSvgZip} from '../src/png-svg-download';
import {createPngFixtures} from './png-fixture-generator';
import {createSharedMemoryServer} from './shared-client-fixture';
import {configureSharedWorkspace, inspectBrowserData, listRecoveryChanges, migrateBrowserData, refreshSharedWorkspace, retryRecoveryChange, startSharedWorkspace, stopSharedWorkspace} from '../src/shared/workspace';
import {readDatabase, sharedDatasetDatabase, withSharedWrite} from '../src/shared/runtime';
import {SharedWorkspaceClient} from '../src/shared/client';
import {emptyDataset, validateDataset} from '../src/shared/codec';
import {readDatasetDocument, writeDatasetDocument} from '../src/shared/documents';

if (!import.meta.env.DEV) throw new Error('These synthetic persistence checks are development-only.');
const assert = (value: unknown, message: string) => {if (!value) throw new Error(message);};
const report: {scope: string; browser: string; passed: string[]; failed: string[]; completedAt?: string} = {scope: 'Real IndexedDB and native SVG rendering; isolated synthetic in-memory server, no production account/provider calls.', browser: navigator.userAgent, passed: [], failed: []};
const output = document.getElementById('shared-check-report')!;
const publish = () => {
  output.textContent = JSON.stringify(report, null, 2); (window as unknown as {__folioSharedChecks: unknown}).__folioSharedChecks = report;
  if (window.parent !== window) window.parent.postMessage({type: 'folio-shared-native-checks', report, credentialless: (window as unknown as {credentialless?: boolean}).credentialless}, location.origin);
};
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function run() {
  const originalDatabases = new Set((await indexedDB.databases()).map(db => db.name));
  if ([...originalDatabases].some(name => name?.startsWith('folio-'))) throw new Error('Use a fresh development origin. Existing Folio databases are never reset by this check.');
  let legacyIcons: IconCollectionStore | undefined, sharedIcons: IconCollectionStore | undefined;
  const server = createSharedMemoryServer(), other = new SharedWorkspaceClient(server.fetcher);
  try {
    configureSharedWorkspace({enabled: false});
    const fixture = createPngFixtures()[0], file = new File([fixture.bytes], 'shared-fixture.png', {type: 'image/png', lastModified: 1700000000000});
    const zip = new JSZip(); zip.file('index.html', '<!doctype html><title>Shared fixture</title><h1>Fixture</h1>');
    const html = await parseArchive(await zip.generateAsync({type: 'arraybuffer'}), 'Shared fixture.zip'), images = await importImages([file]);
    await saveImport(html); await saveImport(images);
    const folder = await createFolder('Legacy folder'); await setItemFavorite(images.pages[0].id, true); await moveItemsToFolder([images.pages[0].id], folder.id);
    legacyIcons = await openIconCollection();
    const imported = await legacyIcons.importEntries({files: [{file, relativePath: file.name}], directories: []}, 'pixels');
    const claim = await legacyIcons.claimNext('native-fixture'); assert(claim, 'Legacy queued conversion must be claimed.');
    const converted = await convertPng(file, {mode: 'pixels'}); await legacyIcons.complete(claim!, converted);
    const saved = await legacyIcons.saveConverted(imported.added[0].id, 1); await legacyIcons.recolorSaved(saved.id, '#1777cc', 1);
    const savedBefore = await legacyIcons.getSavedOutput(saved.id, 2), inventory = await inspectBrowserData();
    assert(inventory.library.items === 2 && inventory.icons.items === 1 && inventory.icons.saved === 1, 'Read-only inventory must include both libraries and curated saved artwork.');
    assert(server.calls.length === 0, 'Inventory must not upload any files.'); report.passed.push('Legacy inventory is read-only and reports HTML, images, conversions and saved colors.'); publish();
    legacyIcons.close(); legacyIcons = undefined;

    configureSharedWorkspace({enabled: true, fetcher: server.fetcher, pollIntervalMs: 60000}); await startSharedWorkspace();
    assert((await listWorkspace()).pages.length === 0, 'Shared cache must not automatically expose or upload old device data.');
    await migrateBrowserData();
    const state = await listWorkspace(), sharedFile = await getFile(images.pages[0].id);
    assert(state.pages.length === 2 && state.folders.some(value => value.id === folder.id), 'Migration must preserve identities and folder organization.');
    assert(state.organization.some(value => value.id === images.pages[0].id && value.favorite && value.folderId === folder.id), 'Migration must preserve favorites and folder assignment.');
    assert(sharedFile?.blob && await sharedFile.blob.text() === await file.text(), 'Migrated raster source bytes must be exact.');
    sharedIcons = await openIconCollection();
    const migratedIcons = await sharedIcons.snapshot(), savedAfter = await sharedIcons.getSavedOutput(saved.id, 2);
    assert(migratedIcons.saved[0]?.color === '#1777cc' && savedAfter && await savedAfter.text() === await savedBefore!.text(), 'Saved color, base/current SVG and source identity must survive migration.');
    assert(migratedIcons.saved[0]?.fidelity.status === 'unavailable', 'Remote pixel-match claims must be rechecked in this browser.');
    const beforeRetry = server.calls.filter(call => call.method === 'PUT' && call.path.includes('/documents/')).length;
    const repeat = await migrateBrowserData();
    assert(repeat.library === 0 && repeat.icons === 0 && beforeRetry === server.calls.filter(call => call.method === 'PUT' && call.path.includes('/documents/')).length, 'Migration retry must not duplicate or republish unchanged records.');
    assert((await listRecoveryChanges()).length === 0, 'Idempotent no-op migrations must not leak recovery stages.');
    report.passed.push('Migration preserves IDs, sources, saved SVG/color, folders/favorites and is idempotent.'); publish();

    await withSharedWrite('library', sharedDatasetDatabase('library'), async () => true);
    assert((await listRecoveryChanges()).length === 0, 'No-op mutations must remove their staging database and journal.');
    server.failWrites(true); let failed = false;
    try {await createFolder('Retained after failed publication');} catch {failed = true;}
    assert(failed && !(await listWorkspace()).folders.some(value => value.name === 'Retained after failed publication'), 'Failed publication must not appear as live server success.');
    const retained = await listRecoveryChanges(); assert(retained.length === 1, 'Failed publication must retain one recoverable staged copy.');
    server.failWrites(false); await retryRecoveryChange(retained[0].id);
    assert((await listWorkspace()).folders.some(value => value.name === 'Retained after failed publication') && (await listRecoveryChanges()).length === 0, 'Explicit retry must commit and clear the retained change.');
    report.passed.push('No-op stage cleanup and interrupted publication retain honest, explicitly retryable state.'); publish();

    const remote = await readDatasetDocument(other, 'library'), remoteData = validateDataset(remote.data, 'library', remote.blobs);
    remoteData.stores.folders.push({id: 'remote-folder', name: 'Other client folder', createdAt: Date.now()});
    await writeDatasetDocument(other, 'library', remoteData, remote.blobs, remote.revision);
    failed = false; try {await createFolder('Concurrent local folder');} catch {failed = true;}
    assert(failed, 'A stale local document must not overwrite the other client.');
    const conflict = await listRecoveryChanges(); assert(conflict.length === 1, 'CAS conflict must retain the attempted change.');
    await retryRecoveryChange(conflict[0].id);
    const merged = await listWorkspace(); assert(merged.folders.some(value => value.id === 'remote-folder') && merged.folders.some(value => value.name === 'Concurrent local folder'), 'Explicit three-way retry must preserve independent edits.');
    report.passed.push('Two independent client revisions conflict honestly; explicit retry preserves both independent edits.'); publish();

    const nativeImport = await sharedIcons.importEntries({files: [{file, relativePath: file.name}], directories: []}, 'pixels');
    const own = (await sharedIcons.snapshot()).items.find(item => item.id === nativeImport.added[0].id)!;
    assert(own.status === 'queued', 'The importing device must retain its own local conversion queue.');
    const remoteIcons = await readDatasetDocument(other, 'icons'), remoteIcon = validateDataset(remoteIcons.data, 'icons', remoteIcons.blobs).stores.icons.find(item => item.id === own.id)!;
    assert(remoteIcon.status === 'cancelled' && remoteIcon.sharedPending === true && !remoteIcon.claim, 'Other devices must not inherit a live conversion claim or auto-run the importing queue.');
    const sharedClaim = await sharedIcons.claimNext('native-shared-fixture'); assert(sharedClaim, 'Shared importer must claim its local queue.');
    const networkBeforeHeartbeat = server.calls.length; await sharedIcons.heartbeat(sharedClaim!);
    assert(server.calls.length === networkBeforeHeartbeat, 'Heartbeat must remain device-only.');
    server.failWrites(true); let publicationFailure = '';
    try {await sharedIcons.complete(sharedClaim!, converted);} catch (error) {publicationFailure = error instanceof Error ? error.message : String(error); await sharedIcons.pauseAfterSharedFailure(sharedClaim!, publicationFailure);}
    assert(publicationFailure && (await sharedIcons.snapshot()).items.find(item => item.id === own.id)?.status === 'cancelled', 'Failed completed-output publication must pause the local job.');
    assert(!await sharedIcons.claimNext('no-automatic-rerun'), 'A paused completed result must not enter the automatic conversion queue again.');
    const completedRecovery = await listRecoveryChanges(); assert(completedRecovery.length === 1, 'The completed SVG must be retained as one recoverable stage.');
    server.failWrites(false); await retryRecoveryChange(completedRecovery[0].id);
    assert((await listRecoveryChanges()).length === 0, 'Explicit completed-output retry must clean its retained stage.');
    const sharedOutput = await sharedIcons.getOutput(own.id, own.revision);
    assert(sharedOutput && await sharedOutput.text() === converted.svg, 'Completed shared SVG bytes must match the actual local conversion.');
    const checked = (await sharedIcons.snapshot()).items.find(item => item.id === own.id)!;
    assert(checked.result?.fidelity.status === converted.fidelity.status, 'The actual native shared SVG check must restore its verified/different status.');
    const ready = (await sharedIcons.snapshot()).items.filter(item => item.status === 'ready');
    const exportEntries = await Promise.all(ready.map(async item => ({filename: item.filename, svg: (await sharedIcons!.getOutput(item.id, item.revision))!})));
    assert((await buildSvgZip(await Promise.all(exportEntries.map(async entry => ({filename: entry.filename, svg: await entry.svg.text()}))))).size > 0, 'The shared conversion collection must export a ZIP with safe unique filenames.');
    report.passed.push('Only the importing device runs its queue; completed SVGs publish and receive a fresh native pixel check.'); publish();

    const cache = await openWorkspaceDatabase();
    await cache.put('archives', {id: 'cloud-qa', rootId: 'cloud-qa', parentId: null, name: 'Existing curated fixture', mountPath: '', createdAt: 0, fileCount: 1, pageCount: 1, byteSize: 0, warnings: [], cloud: {manifest: 'fixture', generation: 'fixture'}});
    await cache.put('pages', {id: 'cloud-qa/index.html', archiveId: 'cloud-qa', rootId: 'cloud-qa', path: 'index.html', label: 'Curated fixture', isIndex: true, size: 0});
    await setPreference('hiddenCloudRoots', ['cloud-qa']);
    assert(!(await listWorkspace()).archives.some(value => value.id === 'cloud-qa') && !(await listWorkspace()).pages.some(value => value.id.startsWith('cloud-qa/')), 'Shared hidden roots must remove cached curated metadata from views.');
    const manifest = validateDataset((await readDatasetDocument(other, 'library')).data, 'library');
    assert(!manifest.stores.archives.some(row => String(row.id).startsWith('cloud-')), 'The original curated collection must not be reuploaded.');
    report.passed.push('Hidden cloud roots refresh locally without republishing curated source files.'); publish();

    sharedIcons.close(); sharedIcons = undefined;
    const active = sharedDatasetDatabase('library'); let entered!: () => void, resume!: () => void;
    const started = new Promise<void>(resolve => {entered = resolve;}), held = new Promise<void>(resolve => {resume = resolve;});
    const first = withSharedWrite('library', active, async stage => {entered(); await held; await stage.put('folders', {id: 'old-session-staged', name: 'Old staged session', createdAt: 1});});
    void first.catch(() => undefined); await started;
    let queuedRan = false;
    const second = withSharedWrite('library', active, async () => {queuedRan = true;}); void second.catch(() => undefined);
    await stopSharedWorkspace(); resume(); await Promise.allSettled([first, second]);
    assert(!queuedRan, 'Queued work from the logged-out session must never execute in a later session.');
    await startSharedWorkspace(); await refreshSharedWorkspace();
    assert(!(await listWorkspace()).folders.some(value => value.id === 'old-session-staged'), 'Interrupted old-session stage must not be published on a later sign-in.');
    const pendingOld = await listRecoveryChanges(); assert(pendingOld.length === 1, 'Interrupted original input must remain recoverable after sign-in.');
    report.passed.push('Logout fences queued work, aborts publication and keeps recoverable staged inputs across sign-in.'); publish();

    const legacyInventory = await inspectBrowserData();
    assert(legacyInventory.library.items === inventory.library.items && legacyInventory.icons.saved === inventory.icons.saved && legacyInventory.totalBytes === inventory.totalBytes, 'Original legacy data must remain unchanged throughout shared work.');
    const finalRecords = await readDatabase(sharedDatasetDatabase('library'));
    assert(finalRecords.pages.length >= 2 && emptyDataset('library').stores.pages.length === 0, 'Hydrated shared state remains separate from original local data.');
    report.passed.push('Original browser databases remain byte-for-byte inventoried and untouched.');
  } finally {
    legacyIcons?.close(); sharedIcons?.close(); other.close(); await stopSharedWorkspace();
    await pause();
    for (const db of await indexedDB.databases()) if (db.name?.startsWith('folio-') && !originalDatabases.has(db.name)) await deleteDB(db.name);
    configureSharedWorkspace({enabled: false});
  }
}

run().catch(error => {report.failed.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));}).finally(() => {report.completedAt = new Date().toISOString(); publish();});
