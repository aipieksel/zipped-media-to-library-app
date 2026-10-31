import {SharedWorkspaceClient, SharedWorkspaceError, validateBlobReference} from './client';
import type {SharedBlobReference} from './client';
import {validateRecordMetadata} from './metadata';

export type DatasetName = 'library' | 'icons';
export type DataRecord = Record<string, unknown>;
export type DatasetRecords = Record<string, DataRecord[]>;
export interface DatasetData {schema: 1; kind: DatasetName; stores: DatasetRecords; migrations?: string[]}
export const SHARED_BLOB_FIELDS = '__folioSharedBlobs';
export const LIBRARY_STORES = ['archives', 'pages', 'files', 'snapshots', 'folders', 'organization', 'prefs'];
export const ICON_STORES = ['icons', 'folders', 'sources', 'outputs', 'savedIcons', 'savedSvg', 'savedSources'];
export const SHARED_PREFERENCE_KEYS = new Set(['favoriteFolders', 'hiddenCloudRoots']);
const object = (value: unknown): value is DataRecord => !!value && typeof value === 'object' && !Array.isArray(value);
export const recordKey = (store: string, record: DataRecord): string => String(record[store === 'prefs' ? 'key' : store === 'snapshots' ? 'pageId' : 'id']);
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (object(value)) return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

export function selectSharedRecords(kind: DatasetName, source: DatasetRecords): DatasetRecords {
  const stores: DatasetRecords = {};
  for (const name of kind === 'library' ? LIBRARY_STORES : ICON_STORES) {
    stores[name] = (source[name] ?? []).filter(row => {
      if (kind !== 'library') return true;
      if (name === 'archives') return !row.cloud && !String(row.id).startsWith('cloud-');
      if (name === 'pages' || name === 'files') return !String(row.archiveId).startsWith('cloud-');
      if (name === 'prefs') return SHARED_PREFERENCE_KEYS.has(String(row.key));
      return true;
    }).map(row => {
      if (kind === 'icons' && name === 'icons') {
        const copy = {...row}; delete copy.claim;
        if (row.status === 'queued' || row.status === 'processing') {
          copy.status = 'cancelled'; copy.sharedPending = true; copy.message = 'Waiting to convert on the importing device. Retry here to take over.';
        } else if (row.status !== 'cancelled' || row.sharedPending !== true) delete copy.sharedPending;
        return copy;
      }
      return {...row};
    });
  }
  return stores;
}

export async function encodeDataset(kind: DatasetName, source: DatasetRecords, client: SharedWorkspaceClient, migrations: readonly string[] = []): Promise<{data: DatasetData; blobs: string[]}> {
  const input = selectSharedRecords(kind, source), stores: DatasetRecords = {}, hashes = new Set<string>();
  const payloads: Blob[] = [], targets: {row: DataRecord; key: string}[] = [];
  for (const [store, rows] of Object.entries(input)) {
    stores[store] = [];
    for (const row of rows) {
      const encoded: DataRecord = {}, references = object(row[SHARED_BLOB_FIELDS]) ? row[SHARED_BLOB_FIELDS] : {};
      for (const [key, value] of Object.entries(row)) {
        if (key === SHARED_BLOB_FIELDS || value === undefined) continue;
        if (value instanceof Blob) {
          if (value.size === 0 && references[key]) {
            const reference = validateBlobReference(references[key]); encoded[key] = reference;
            for (const chunk of reference.chunks) hashes.add(chunk.hash);
          } else {payloads.push(value); targets.push({row: encoded, key});}
        } else encoded[key] = value;
      }
      stores[store].push(encoded);
    }
  }
  for (const [index, reference] of (await client.uploadMany(payloads)).entries()) {
    targets[index].row[targets[index].key] = reference;
    for (const chunk of reference.chunks) hashes.add(chunk.hash);
  }
  const data: DatasetData = {schema: 1, kind, stores, ...(migrations.length ? {migrations: [...new Set(migrations)].slice(-256)} : {})};
  validateDataset(data, kind, [...hashes]);
  return {data, blobs: [...hashes].sort()};
}

export function validateDataset(value: unknown, kind: DatasetName, allowedBlobs?: readonly string[]): DatasetData {
  if (!object(value) || value.schema !== 1 || value.kind !== kind || !object(value.stores)) throw new SharedWorkspaceError('The shared collection format is invalid.', 'invalid-data');
  const names = kind === 'library' ? LIBRARY_STORES : ICON_STORES;
  if (Object.keys(value.stores).some(name => !names.includes(name))) throw new SharedWorkspaceError('The shared collection has an unsupported store.', 'invalid-data');
  const allowed = allowedBlobs ? new Set(allowedBlobs) : null, referenced = new Set<string>();
  for (const name of names) {
    const rows = value.stores[name];
    if (!Array.isArray(rows) || rows.length > 20000) throw new SharedWorkspaceError('The shared collection is missing bounded records.', 'invalid-data');
    const keys = new Set<string>();
    for (const row of rows) {
      if (!object(row) || Object.hasOwn(row, SHARED_BLOB_FIELDS) || Object.hasOwn(row, '__proto__')) throw new SharedWorkspaceError('The shared collection record is invalid.', 'invalid-data');
      const key = row[name === 'prefs' ? 'key' : name === 'snapshots' ? 'pageId' : 'id'];
      if (typeof key !== 'string' || !key || key.length > 8192 || keys.has(key)) throw new SharedWorkspaceError('The shared collection has missing or duplicate identifiers.', 'invalid-data');
      keys.add(key);
      validateRecordMetadata(kind, name, row);
      if (kind === 'library' && ((name === 'archives' && (row.cloud || key.startsWith('cloud-'))) || ((name === 'pages' || name === 'files') && String(row.archiveId).startsWith('cloud-')) || (name === 'prefs' && !SHARED_PREFERENCE_KEYS.has(key)))) throw new SharedWorkspaceError('The shared overlay cannot replace the curated collection or private preferences.', 'invalid-data');
      const payloadFields = kind === 'library' ? ['files', 'snapshots'].includes(name) ? ['blob'] : [] : ['sources', 'outputs', 'savedSources'].includes(name) ? ['blob'] : name === 'savedSvg' ? ['base', 'output'] : [];
      for (const field of payloadFields) validateBlobReference(row[field]);
      if (name === 'prefs' && (!Array.isArray(row.value) || row.value.some(item => typeof item !== 'string' || item.length > 8192))) throw new SharedWorkspaceError('The shared collection preference is invalid.', 'invalid-data');
      for (const item of Object.values(row)) if (object(item) && item.kind === 'folio-blob-v1') {
        const reference = validateBlobReference(item);
        if (allowed && reference.chunks.some(chunk => !allowed.has(chunk.hash))) throw new SharedWorkspaceError('A shared record references unpublished bytes.', 'invalid-data');
        for (const chunk of reference.chunks) referenced.add(chunk.hash);
      }
    }
  }
  if (allowed && (allowed.size !== referenced.size || [...allowed].some(hash => !referenced.has(hash)))) throw new SharedWorkspaceError('The shared collection has unreferenced file bytes.', 'invalid-data');
  if (value.migrations !== undefined && (!Array.isArray(value.migrations) || value.migrations.length > 256 || value.migrations.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)))) throw new SharedWorkspaceError('The shared migration ledger is invalid.', 'invalid-data');
  const data = value as unknown as DatasetData;
  validateRelationships(data);
  return data;
}

function validateRelationships(data: DatasetData): void {
  const rows = data.stores;
  if (data.kind === 'library') {
    const archives = new Map(rows.archives.map(row => [String(row.id), row]));
    const files = new Set(rows.files.map(row => String(row.id)));
    for (const row of rows.archives) {
      if (typeof row.name !== 'string' || !archives.has(String(row.rootId)) || !(row.parentId === null || archives.has(String(row.parentId)))) throw new SharedWorkspaceError('The shared library hierarchy is incomplete.', 'invalid-data');
      const seen = new Set<string>(); let item: DataRecord | undefined = row;
      while (item) {const id = String(item.id); if (seen.has(id)) throw new SharedWorkspaceError('The shared library hierarchy is cyclic.', 'invalid-data'); seen.add(id); item = item.parentId ? archives.get(String(item.parentId)) : undefined;}
    }
    for (const row of rows.files) if (!archives.has(String(row.archiveId)) || row.id !== `${row.archiveId}/${row.path}` || typeof row.mime !== 'string' || !object(row.blob)) throw new SharedWorkspaceError('A shared library file is incomplete.', 'invalid-data');
    for (const row of rows.pages) if (!files.has(String(row.id)) || !archives.has(String(row.archiveId)) || typeof row.label !== 'string' || !['html', 'image', undefined].includes(row.kind as string | undefined)) throw new SharedWorkspaceError('A shared library item is incomplete.', 'invalid-data');
  } else {
    const folders = new Map(rows.folders.map(row => [String(row.id), row]));
    for (const row of rows.folders) {
      if (typeof row.name !== 'string' || !(row.parentId === null || folders.has(String(row.parentId)))) throw new SharedWorkspaceError('The shared icon folders are incomplete.', 'invalid-data');
      const seen = new Set<string>(); let item: DataRecord | undefined = row;
      while (item) {const id = String(item.id); if (seen.has(id)) throw new SharedWorkspaceError('The shared icon hierarchy is cyclic.', 'invalid-data'); seen.add(id); item = item.parentId ? folders.get(String(item.parentId)) : undefined;}
    }
    const sources = new Map(rows.sources.map(row => [String(row.id), row])), outputs = new Map(rows.outputs.map(row => [String(row.id), row]));
    for (const row of rows.icons) if (!folders.has(String(row.folderId)) || !sources.has(String(row.id)) || !['queued', 'cancelled', 'error', 'ready'].includes(String(row.status)) || !['pixels', 'smooth', 'embedded'].includes(String(row.mode)) || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1 || (row.status === 'ready' && outputs.get(String(row.id))?.revision !== row.revision)) throw new SharedWorkspaceError('The shared icon record is incomplete.', 'invalid-data');
    const svg = new Map(rows.savedSvg.map(row => [String(row.id), row])), savedSources = new Set(rows.savedSources.map(row => String(row.id)));
    for (const row of rows.savedIcons) if (!folders.has(String(row.folderId)) || !savedSources.has(String(row.id)) || svg.get(String(row.id))?.revision !== row.revision || typeof row.name !== 'string') throw new SharedWorkspaceError('The saved artwork record is incomplete.', 'invalid-data');
  }
}

export function emptyDataset(kind: DatasetName): DatasetData {
  return {schema: 1, kind, stores: Object.fromEntries((kind === 'library' ? LIBRARY_STORES : ICON_STORES).map(name => [name, []]))};
}

export function decodeDataset(data: DatasetData): DatasetRecords {
  const stores: DatasetRecords = {};
  for (const [store, rows] of Object.entries(data.stores)) stores[store] = rows.map(row => {
    const copy: DataRecord = {...row}, references: Record<string, SharedBlobReference> = {};
    for (const [key, value] of Object.entries(copy)) if (object(value) && value.kind === 'folio-blob-v1') {
      const reference = validateBlobReference(value); copy[key] = new Blob([], {type: reference.mime}); references[key] = reference;
    }
    if (Object.keys(references).length) copy[SHARED_BLOB_FIELDS] = references;
    return copy;
  });
  return stores;
}

/** Resolve only this requested record; the database continues holding lazy, verified references. */
export async function resolveRecord<T>(row: T, client: SharedWorkspaceClient): Promise<T> {
  if (!object(row) || !object(row[SHARED_BLOB_FIELDS])) return row;
  const copy: DataRecord = {...row};
  for (const [field, value] of Object.entries(row[SHARED_BLOB_FIELDS])) {
    if (copy[field] instanceof Blob && copy[field].size === 0) copy[field] = await client.download(validateBlobReference(value));
  }
  return copy as T;
}

export function datasetBlobHashes(data: DatasetData): string[] {
  const hashes = new Set<string>();
  for (const rows of Object.values(data.stores)) for (const row of rows) for (const value of Object.values(row)) if (object(value) && value.kind === 'folio-blob-v1') for (const chunk of validateBlobReference(value).chunks) hashes.add(chunk.hash);
  return [...hashes].sort();
}

/** Explicit recovery merges independent record edits; a changed same record is never overwritten. */
export function reconcileDatasets(base: DatasetData, candidate: DatasetData, latest: DatasetData): DatasetData {
  const stores: DatasetRecords = {};
  for (const name of Object.keys(candidate.stores)) {
    const before = new Map(base.stores[name].map(row => [recordKey(name, row), row]));
    const after = new Map(candidate.stores[name].map(row => [recordKey(name, row), row]));
    const current = new Map(latest.stores[name].map(row => [recordKey(name, row), row]));
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      const old = before.get(key), next = after.get(key), now = current.get(key);
      if (stableJson(old) === stableJson(next)) continue;
      if (stableJson(now) === stableJson(next)) continue;
      if (stableJson(now) !== stableJson(old)) throw new SharedWorkspaceError('The same record changed on another device. The staged changes are retained; review the current workspace before retrying.', 'conflict', 409);
      if (next) current.set(key, next); else current.delete(key);
    }
    stores[name] = [...current.values()];
  }
  return validateDataset({schema: 1, kind: candidate.kind, stores, migrations: [...new Set([...(latest.migrations ?? []), ...(candidate.migrations ?? [])])].slice(-256)}, candidate.kind);
}
