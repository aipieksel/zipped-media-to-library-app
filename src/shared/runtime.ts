import {deleteDB, openDB} from 'idb';
import type {IDBPDatabase} from 'idb';
import {uniqueId} from '../identity';
import {DEFAULT_APPEARANCE, normalizeAppearance, validateAppearance} from '../appearance';
import type {AppearancePalette} from '../appearance';
import {SharedWorkspaceClient, SharedWorkspaceError} from './client';
import type {DocumentName, SharedDocument} from './client';
import {decodeDataset, emptyDataset, encodeDataset, ICON_STORES, LIBRARY_STORES, reconcileDatasets, resolveRecord, SHARED_BLOB_FIELDS, SHARED_PREFERENCE_KEYS, stableJson, validateDataset} from './codec';
import type {DataRecord, DatasetData, DatasetName, DatasetRecords} from './codec';
import {readDatasetDocument, writeDatasetDocument} from './documents';

// Any is confined to the dynamic IndexedDB boundary; dataset records are validated before installation.
export type SharedDatabase = IDBPDatabase<any>;
export interface SharedWorkspaceChange {library?: boolean; icons?: boolean; appearance?: boolean; error?: string}
export interface SharedWorkspaceConfiguration {enabled: boolean; fetcher?: typeof fetch; pollIntervalMs?: number; onUnauthorized?: () => void}
export interface RecoveryChange {id: string; kind: DatasetName; createdAt: number; error: string; stageName: string; base: DatasetData; baseRevision: number}
export const SHARED_LIBRARY_DB = 'folio-workspace-shared-v1';
export const SHARED_ICONS_DB = 'folio-icons-shared-v1';
export const MIGRATION_LEDGER_KEY = '__sharedMigrationLedger';
const RECOVERY_DB = 'folio-shared-recovery-v1';
const datasets = new Map<DatasetName, SharedDatabase>();
const documents = new Map<DocumentName, SharedDocument>();
const listeners = new Set<(change: SharedWorkspaceChange) => void>();
const chains = new Map<string, Promise<unknown>>();
let mode: 'local' | 'active' | 'locked' = 'local';
let configuration: SharedWorkspaceConfiguration = {enabled: false};
let client: SharedWorkspaceClient | undefined;
let epoch = 0;
let poll: ReturnType<typeof setInterval> | undefined;
let channel: BroadcastChannel | undefined;
let refreshPromise: Promise<void> | undefined;

export function configureSharedWorkspace(options: SharedWorkspaceConfiguration): void {
  if (mode === 'active') throw new Error('Stop the current shared workspace before changing its configuration.');
  configuration = options;
  mode = options.enabled ? 'locked' : 'local';
  epoch++;
}
export const isSharedWorkspaceEnabled = (): boolean => mode === 'active';
export const sharedWorkspaceEpoch = (): number => epoch;
export function sharedDatabaseName(local: string): string {
  if (!['folio-workspace', 'folio-icons'].includes(local)) return local;
  if (mode === 'locked') throw new SharedWorkspaceError('Sign in to reopen the shared workspace.', 'signed-out', 401);
  return mode === 'active' ? local === 'folio-workspace' ? SHARED_LIBRARY_DB : SHARED_ICONS_DB : local;
}
export function requireSharedClient(): SharedWorkspaceClient {
  if (mode !== 'active' || !client) throw new SharedWorkspaceError('Sign in to use the shared workspace.', 'signed-out', 401);
  return client;
}
export function registerSharedDatabase(kind: DatasetName, db: SharedDatabase): void {
  if (mode === 'active' && db.name === (kind === 'library' ? SHARED_LIBRARY_DB : SHARED_ICONS_DB) && !datasets.has(kind)) datasets.set(kind, db);
}
export function subscribeSharedWorkspace(listener: (change: SharedWorkspaceChange) => void): () => void {listeners.add(listener); return () => {listeners.delete(listener);};}
function announce(change: SharedWorkspaceChange, broadcast = false): void {
  for (const listener of listeners) listener(change);
  if (broadcast) channel?.postMessage({refresh: true});
}
function currentAttempt(expected: number): void {if (mode !== 'active' || epoch !== expected) throw new SharedWorkspaceError('This workspace session ended. Sign in again; staged changes are retained.', 'signed-out', 401);}

async function serial<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`folio-shared:${key}`, action);
    return action();
  });
  chains.set(key, pending);
  try {return await pending;} finally {if (chains.get(key) === pending) chains.delete(key);}
}

export async function readDatabase(db: SharedDatabase): Promise<DatasetRecords> {
  const names = Array.from(db.objectStoreNames).filter(name => name !== 'galleryThumbnails'), tx = db.transaction(names, 'readonly');
  const records = Object.fromEntries(await Promise.all(names.map(async name => [name, await tx.objectStore(name).getAll() as DataRecord[]])));
  await tx.done; return records;
}

async function cloneDatabase(source: SharedDatabase, name: string): Promise<SharedDatabase> {
  const names = Array.from(source.objectStoreNames), tx = source.transaction(names, 'readonly');
  const schema = names.map(storeName => {
    const store = tx.objectStore(storeName);
    return {name: storeName, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes: Array.from(store.indexNames).map(indexName => {const index = store.index(indexName); return {name: indexName, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry};})};
  });
  const records = Object.fromEntries(await Promise.all(names.map(async store => [store, store === 'galleryThumbnails' ? [] : await tx.objectStore(store).getAll()])));
  await tx.done;
  const copy = await openDB(name, 1, {upgrade(db) {
    for (const definition of schema) {
      const store = db.createObjectStore(definition.name, {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement});
      for (const index of definition.indexes) store.createIndex(index.name, index.keyPath, {unique: index.unique, multiEntry: index.multiEntry});
    }
  }});
  const write = copy.transaction(names, 'readwrite');
  for (const store of names) for (const row of records[store]) await write.objectStore(store).put(row);
  await write.done; return copy;
}

/** Install only the shared overlay. Cached curated metadata and device preferences remain separate. */
export async function installDataset(db: SharedDatabase, data: DatasetData, queueSource?: DatasetRecords): Promise<void> {
  const decoded = decodeDataset(data), names = data.kind === 'library' ? LIBRARY_STORES : [...ICON_STORES, 'prefs'];
  const tx = db.transaction(names, 'readwrite');
  try {
    if (data.kind === 'library') {
      for (const store of LIBRARY_STORES) {
        for (const row of await tx.objectStore(store).getAll() as DataRecord[]) {
          const keep = store === 'prefs' ? !SHARED_PREFERENCE_KEYS.has(String(row.key)) : store === 'archives' ? !!row.cloud || String(row.id).startsWith('cloud-') : store === 'pages' || store === 'files' ? String(row.archiveId).startsWith('cloud-') : false;
          if (!keep) await tx.objectStore(store).delete(row[store === 'prefs' ? 'key' : store === 'snapshots' ? 'pageId' : 'id']);
        }
        for (const row of decoded[store]) await tx.objectStore(store).put(row);
      }
      const hidden = new Set((decoded.prefs.find(row => row.key === 'hiddenCloudRoots')?.value as string[] | undefined) ?? []);
      if (hidden.size) {
        for (const store of ['archives', 'pages']) for (const row of await tx.objectStore(store).getAll() as DataRecord[]) if (String(row.rootId).startsWith('cloud-') && hidden.has(String(row.rootId))) await tx.objectStore(store).delete(row.id);
      }
    } else {
      const localItems = new Map<string, DataRecord>((await tx.objectStore('icons').getAll() as DataRecord[]).map(row => [String(row.id), row]));
      for (const row of queueSource?.icons ?? []) if (!localItems.has(String(row.id)) || Number(row.revision) > Number(localItems.get(String(row.id))?.revision)) localItems.set(String(row.id), row);
      for (const row of decoded.icons) {
        const local = localItems.get(String(row.id));
        if (row.sharedPending === true && local && local.revision === row.revision && local.mode === row.mode && ['queued', 'processing'].includes(String(local.status))) {
          row.status = local.status; row.claim = local.claim; row.message = local.message; row.updatedAt = local.updatedAt;
        }
      }
      for (const store of ICON_STORES) {await tx.objectStore(store).clear(); for (const row of decoded[store]) await tx.objectStore(store).put(row);}
      if (!await tx.objectStore('folders').getKey('icon-folder-uncategorized')) await tx.objectStore('folders').put({id: 'icon-folder-uncategorized', parentId: null, name: 'Uncategorized', createdAt: 0, favorite: false});
    }
    await tx.objectStore('prefs').put({key: MIGRATION_LEDGER_KEY, value: data.migrations ?? []});
    await tx.done;
  } catch (error) {try {tx.abort();} catch { /* Already aborted. */ } await tx.done.catch(() => undefined); throw error;}
}

async function recoveryDatabase(): Promise<SharedDatabase> {
  return openDB(RECOVERY_DB, 1, {upgrade(db) {db.createObjectStore('changes', {keyPath: 'id'});}});
}
async function retainChange(change: RecoveryChange): Promise<void> {const db = await recoveryDatabase(); try {await db.put('changes', change);} finally {db.close();}}
async function forgetChange(id: string, stageName: string): Promise<void> {const db = await recoveryDatabase(); try {await db.delete('changes', id);} finally {db.close();} await deleteDB(stageName);}
export async function listRecoveryChanges(): Promise<RecoveryChange[]> {
  requireSharedClient(); const db = await recoveryDatabase();
  try {return (await db.getAll('changes') as RecoveryChange[]).sort((a, b) => a.createdAt - b.createdAt);} finally {db.close();}
}

/** Shared writes are staged; the live cache is never a false server acknowledgement. */
export async function withSharedWrite<T, D extends SharedDatabase>(kind: DatasetName, db: D, action: (stage: D) => Promise<T>): Promise<T> {
  const expectedName = kind === 'library' ? SHARED_LIBRARY_DB : SHARED_ICONS_DB;
  if (db.name !== expectedName) return action(db);
  const attempt = epoch, service = requireSharedClient();
  return serial(kind, async () => {
    currentAttempt(attempt);
    const baseDocument = documents.get(kind);
    if (!baseDocument) throw new SharedWorkspaceError('Load the shared workspace before editing it.', 'not-ready');
    if ((await listRecoveryChanges()).length >= 20) throw new SharedWorkspaceError('Review the retained changes in Settings before creating more shared changes.', 'recovery-limit');
    const id = uniqueId(), stageName = `folio-shared-stage-${kind}-${id}`;
    const stage = await cloneDatabase(db, stageName);
    const base = baseDocument.data ? validateDataset(baseDocument.data, kind, baseDocument.blobs) : emptyDataset(kind);
    const retained: RecoveryChange = {id, kind, createdAt: Date.now(), error: 'This change was interrupted before it finished.', stageName, base, baseRevision: baseDocument.revision};
    let changed = false;
    try {
      await retainChange(retained);
      currentAttempt(attempt);
      const result = await action(stage as D);
      changed = true;
      const records = await readDatabase(stage);
      const migrations = records.prefs?.find(row => row.key === MIGRATION_LEDGER_KEY)?.value as string[] | undefined;
      const candidate = await encodeDataset(kind, records, service, migrations ?? base.migrations);
      currentAttempt(attempt);
      if (stableJson(candidate.data) === stableJson(base)) {changed = false; return result;}
      const committed = await writeDatasetDocument(service, kind, candidate.data, candidate.blobs, baseDocument.revision);
      currentAttempt(attempt);
      const valid = validateDataset(committed.data, kind, committed.blobs);
      await installDataset(db, valid, records);
      currentAttempt(attempt);
      documents.set(kind, committed);
      announce({[kind]: true}, true);
      changed = false;
      return result;
    } catch (error) {
      if (changed) {
        const message = error instanceof Error ? error.message : 'The shared change failed.';
        await retainChange({...retained, error: message}).catch(() => undefined);
        throw new SharedWorkspaceError(`${message} Your staged changes are retained in Settings → Workspace.`, error instanceof SharedWorkspaceError ? error.code : 'write-failed', error instanceof SharedWorkspaceError ? error.status : 0);
      }
      throw error;
    } finally {
      stage.close();
      if (!changed) await forgetChange(id, stageName).catch(() => undefined);
    }
  });
}

export async function resolveSharedRecord<T>(row: T): Promise<T> {
  if (!row || typeof row !== 'object' || !Object.hasOwn(row, SHARED_BLOB_FIELDS)) return row;
  const attempt = epoch, service = requireSharedClient();
  const resolved = await resolveRecord(row, service);
  currentAttempt(attempt);
  return resolved;
}

async function refreshDataset(kind: DatasetName): Promise<void> {
  const attempt = epoch, service = requireSharedClient();
  await serial(kind, async () => {
    currentAttempt(attempt);
    const document = await readDatasetDocument(service, kind);
    currentAttempt(attempt);
    const db = datasets.get(kind); if (!db) throw new Error('The shared collection cache is not open.');
    const previous = documents.get(kind);
    if (previous?.revision === document.revision) return;
    const data = document.data ? validateDataset(document.data, kind, document.blobs) : emptyDataset(kind);
    await installDataset(db, data);
    currentAttempt(attempt);
    documents.set(kind, document); announce({[kind]: true});
  });
}

async function refreshAppearance(): Promise<void> {
  const attempt = epoch, service = requireSharedClient();
  await serial('appearance', async () => {
    currentAttempt(attempt);
    const document = await service.read('appearance'); currentAttempt(attempt);
    if (document.data !== null && !validateAppearance(document.data).valid) throw new SharedWorkspaceError('The saved workspace colors are invalid.', 'invalid-data');
    const changed = documents.get('appearance')?.revision !== document.revision;
    documents.set('appearance', document); if (changed) announce({appearance: true});
  });
}

export async function refreshSharedWorkspace(): Promise<void> {
  if (mode !== 'active') return;
  if (refreshPromise) return refreshPromise;
  const attempt = epoch, pending = Promise.all([refreshDataset('library'), refreshDataset('icons'), refreshAppearance()]).then(() => undefined);
  refreshPromise = pending;
  try {await pending;} catch (error) {if (mode === 'active' && epoch === attempt) announce({error: error instanceof Error ? error.message : 'The workspace could not be refreshed.'}); throw error;}
  finally {if (refreshPromise === pending) refreshPromise = undefined;}
}

const visibilityRefresh = () => {if (typeof document === 'undefined' || document.visibilityState === 'visible') void refreshSharedWorkspace().catch(() => undefined);};

export async function startSharedWorkspace(): Promise<void> {
  if (!configuration.enabled) return;
  if (mode === 'active' && client) {await refreshSharedWorkspace(); return;}
  mode = 'active'; epoch++;
  const attempt = epoch;
  client = new SharedWorkspaceClient(configuration.fetcher, configuration.onUnauthorized);
  try {
    const [library, icons] = await Promise.all([import('../db'), import('../icon-collection')]);
    registerSharedDatabase('library', await library.openWorkspaceDatabase());
    registerSharedDatabase('icons', await icons.openSharedIconDatabase());
    await refreshSharedWorkspace();
    currentAttempt(attempt);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', visibilityRefresh); document.addEventListener('visibilitychange', visibilityRefresh);
      if (typeof BroadcastChannel !== 'undefined') {channel = new BroadcastChannel('folio-shared-workspace'); channel.onmessage = visibilityRefresh;}
      poll = setInterval(visibilityRefresh, Math.max(5000, Math.min(60000, configuration.pollIntervalMs ?? 20000)));
    }
  } catch (error) {if (epoch === attempt) await stopSharedWorkspace(); throw error;}
}

export async function stopSharedWorkspace(): Promise<void> {
  mode = configuration.enabled ? 'locked' : 'local'; epoch++;
  refreshPromise = undefined;
  clearInterval(poll); poll = undefined;
  if (typeof window !== 'undefined') {window.removeEventListener('focus', visibilityRefresh); document.removeEventListener('visibilitychange', visibilityRefresh);}
  channel?.close(); channel = undefined; client?.close(); client = undefined;
  for (const db of datasets.values()) db.close(); datasets.clear(); documents.clear();
}

export function getSharedAppearance(): AppearancePalette {return normalizeAppearance(documents.get('appearance')?.data ?? DEFAULT_APPEARANCE);}
export async function saveSharedAppearance(value: AppearancePalette): Promise<AppearancePalette> {
  const validated = validateAppearance(value); if (!validated.valid) throw new SharedWorkspaceError(validated.message, 'invalid-data');
  const attempt = epoch, service = requireSharedClient();
  return serial('appearance', async () => {
    currentAttempt(attempt);
    const document = documents.get('appearance');
    if (!document) throw new SharedWorkspaceError('Load workspace settings before saving colors.', 'not-ready');
    const committed = await service.write('appearance', validated.palette, [], document.revision);
    currentAttempt(attempt); documents.set('appearance', committed); announce({appearance: true}, true);
    return getSharedAppearance();
  });
}

export async function retryRecoveryChange(id: string): Promise<void> {
  const attempt = epoch, service = requireSharedClient();
  const change = (await listRecoveryChanges()).find(item => item.id === id);
  if (!change) throw new Error('This retained change is no longer available.');
  await serial(change.kind, async () => {
    currentAttempt(attempt);
    const stage = await openDB(change.stageName);
    try {
      const records = await readDatabase(stage), latest = await readDatasetDocument(service, change.kind);
      const latestData = latest.data ? validateDataset(latest.data, change.kind, latest.blobs) : emptyDataset(change.kind);
      const candidate = await encodeDataset(change.kind, records, service, records.prefs?.find(row => row.key === MIGRATION_LEDGER_KEY)?.value as string[] | undefined);
      const reconciled = reconcileDatasets(change.base, candidate.data, latestData);
      const {datasetBlobHashes} = await import('./codec');
      const committed = stableJson(reconciled) === stableJson(latestData) ? latest : await writeDatasetDocument(service, change.kind, reconciled, datasetBlobHashes(reconciled), latest.revision);
      currentAttempt(attempt);
      await installDataset(datasets.get(change.kind)!, committed.data === null ? emptyDataset(change.kind) : validateDataset(committed.data, change.kind, committed.blobs), records);
      currentAttempt(attempt);
      documents.set(change.kind, committed); announce({[change.kind]: true}, true);
    } finally {stage.close();}
    await forgetChange(change.id, change.stageName);
  });
}

export async function discardRecoveryChange(id: string): Promise<void> {
  const change = (await listRecoveryChanges()).find(item => item.id === id);
  if (change) await forgetChange(change.id, change.stageName);
}

export function sharedDatasetDatabase(kind: DatasetName): SharedDatabase {
  requireSharedClient(); const db = datasets.get(kind); if (!db) throw new Error('The shared collection is not loaded.'); return db;
}
