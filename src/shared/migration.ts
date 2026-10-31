import {openDB} from 'idb';
import {hashBytes, SharedWorkspaceError} from './client';
import {encodeDataset, recordKey, selectSharedRecords, stableJson} from './codec';
import type {DataRecord, DatasetName, DatasetRecords} from './codec';
import {installDataset, MIGRATION_LEDGER_KEY, readDatabase, requireSharedClient, sharedDatasetDatabase, withSharedWrite} from './runtime';
import type {SharedDatabase} from './runtime';

export interface MigrationInventory {
  library: {items: number; files: number; folders: number; bytes: number};
  icons: {items: number; saved: number; folders: number; bytes: number};
  totalBytes: number;
  hasData: boolean;
}

async function legacyDatabase(name: string): Promise<SharedDatabase | null> {
  if (typeof indexedDB.databases === 'function' && !(await indexedDB.databases()).some(db => db.name === name)) return null;
  try {return await openDB(name, undefined, {upgrade(_db, oldVersion, _newVersion, tx) {if (oldVersion === 0) tx.abort();}});}
  catch (error) {if (error instanceof DOMException && error.name === 'AbortError') return null; throw error;}
}

async function legacyRecords(kind: DatasetName): Promise<DatasetRecords> {
  const db = await legacyDatabase(kind === 'library' ? 'folio-workspace' : 'folio-icons');
  if (!db) return selectSharedRecords(kind, {});
  try {return selectSharedRecords(kind, await readDatabase(db));} finally {db.close();}
}

const bytesIn = (records: DatasetRecords): number => Object.values(records).reduce((total, rows) => total + rows.reduce((sum, row) => sum + Object.values(row).reduce<number>((bytes, value) => bytes + (value instanceof Blob ? value.size : 0), 0), 0), 0);

/** Read-only inventory. No file bytes are decoded, hashed, sent, removed or rewritten. */
export async function inspectBrowserData(): Promise<MigrationInventory> {
  const [library, icons] = await Promise.all([legacyRecords('library'), legacyRecords('icons')]);
  const libraryBytes = bytesIn(library), iconBytes = bytesIn(icons);
  const meaningfulFolders = icons.folders.filter(row => row.id !== 'icon-folder-uncategorized').length;
  return {
    library: {items: library.pages.length, files: library.files.length, folders: library.archives.filter(row => row.parentId === null).length + library.folders.length, bytes: libraryBytes},
    icons: {items: icons.icons.length, saved: icons.savedIcons.length, folders: meaningfulFolders, bytes: iconBytes},
    totalBytes: libraryBytes + iconBytes,
    hasData: library.pages.length + library.files.length + library.folders.length + library.organization.length + library.prefs.length + icons.icons.length + icons.savedIcons.length + meaningfulFolders > 0,
  };
}

async function migrateDataset(kind: DatasetName): Promise<number> {
  const originals = await legacyRecords(kind), client = requireSharedClient();
  if (Object.values(originals).every(rows => !rows.length) || (kind === 'icons' && Object.entries(originals).every(([name, rows]) => name === 'folders' ? rows.every(row => row.id === 'icon-folder-uncategorized' && !row.favorite) : !rows.length))) return 0;
  // Original browser stores remain untouched even if hashing/upload/commit is interrupted.
  const source = await encodeDataset(kind, originals, client);
  const marker = await hashBytes(new TextEncoder().encode(stableJson(source.data)).buffer);
  return withSharedWrite(kind, sharedDatasetDatabase(kind), async stage => {
    const rows = await readDatabase(stage);
    const ledger = (rows.prefs?.find(row => row.key === MIGRATION_LEDGER_KEY)?.value as string[] | undefined) ?? [];
    if (ledger.includes(marker)) return 0;
    const current = await encodeDataset(kind, rows, client, ledger);
    const merged = {...current.data, stores: {...current.data.stores}, migrations: [...new Set([...ledger, marker])].slice(-256)};
    let added = 0;
    for (const [store, incoming] of Object.entries(source.data.stores)) {
      const target = new Map(current.data.stores[store].map(row => [recordKey(store, row), row]));
      for (const row of incoming) {
        const key = recordKey(store, row), existing = target.get(key);
        if (!existing) {target.set(key, row); added++; continue;}
        if (kind === 'icons' && store === 'folders' && key === 'icon-folder-uncategorized') {target.set(key, {...existing, favorite: !!existing.favorite || !!row.favorite}); continue;}
        if (kind === 'library' && store === 'prefs') {
          const before = Array.isArray(existing.value) ? existing.value.filter(item => typeof item === 'string') : [];
          const incoming = Array.isArray(row.value) ? row.value.filter(item => typeof item === 'string') : [];
          target.set(key, {...existing, value: [...new Set([...before, ...incoming])].sort()}); continue;
        }
        if (stableJson(existing) !== stableJson(row)) throw new SharedWorkspaceError('A browser record with the same identity already has different shared contents. The original browser data is unchanged; review that record before sharing it.', 'migration-conflict', 409);
      }
      merged.stores[store] = [...target.values()];
    }
    // Install decoded payload references in the staging database only; publication is still atomic.
    const queue: DatasetRecords = {...originals};
    if (kind === 'icons') {
      const legacy = await legacyDatabase('folio-icons');
      if (legacy) {try {queue.icons = await legacy.getAll('icons') as DataRecord[];} finally {legacy.close();}}
    }
    await installDataset(stage, merged, queue);
    return added;
  });
}

/** User-invoked only. Each dataset is independently acknowledged and idempotently retryable. */
export async function migrateBrowserData(): Promise<{library: number; icons: number}> {
  requireSharedClient();
  const library = await migrateDataset('library');
  const icons = await migrateDataset('icons');
  return {library, icons};
}
