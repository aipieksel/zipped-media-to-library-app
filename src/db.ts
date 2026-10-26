import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { uniqueId } from './identity';
import { isSupportedImagePath } from './archive';
import type { ArchiveFile, ArchiveMeta, HtmlPage, ImportBundle, ItemOrganization, Snapshot, WorkspaceFolder } from './types';

interface WorkspaceSchema extends DBSchema {
  archives: { key: string; value: ArchiveMeta; indexes: { byRoot: string } };
  pages: { key: string; value: HtmlPage; indexes: { byRoot: string; byArchive: string } };
  files: { key: string; value: ArchiveFile; indexes: { byArchive: string } };
  snapshots: { key: string; value: Snapshot };
  prefs: { key: string; value: { key: string; value: unknown } };
  folders: { key: string; value: WorkspaceFolder };
  organization: { key: string; value: ItemOrganization };
}

let connection: Promise<IDBPDatabase<WorkspaceSchema>> | undefined;

function database(): Promise<IDBPDatabase<WorkspaceSchema>> {
  if (!connection) {
    let migrationError: unknown;
    connection = openDB<WorkspaceSchema>('folio-workspace', 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion === 0) {
          db.createObjectStore('archives', { keyPath: 'id' }).createIndex('byRoot', 'rootId');
          const pages = db.createObjectStore('pages', { keyPath: 'id' });
          pages.createIndex('byRoot', 'rootId');
          pages.createIndex('byArchive', 'archiveId');
          db.createObjectStore('files', { keyPath: 'id' }).createIndex('byArchive', 'archiveId');
          db.createObjectStore('snapshots', { keyPath: 'pageId' });
          db.createObjectStore('prefs', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('folders', { keyPath: 'id' });
          db.createObjectStore('organization', { keyPath: 'id' });
          if (oldVersion > 0) {
            // Reuse canonical IDs and Blob handles. Do not decode, copy, or rewrite resource bytes.
            const backfillImages = async () => {
              const archiveStore = transaction.objectStore('archives');
              const archives = new Map((await archiveStore.getAll()).map(archive => [archive.id, { ...archive, imageCount: 0 }]));
              const itemStore = transaction.objectStore('pages');
              for (let cursor = await transaction.objectStore('files').openCursor(); cursor; cursor = await cursor.continue()) {
                const file = cursor.value;
                if (!isSupportedImagePath(file.path)) continue;
                const archive = archives.get(file.archiveId);
                if (!archive) throw new Error(`Cannot index image from missing archive: ${file.path}`);
                if (!await itemStore.getKey(file.id)) {
                  await itemStore.add({
                    id: file.id, archiveId: file.archiveId, rootId: archive.rootId, path: file.path,
                    label: file.path.split('/').at(-1)!, isIndex: false, size: file.blob.size, kind: 'image',
                  });
                }
                const visited = new Set<string>();
                let ancestor: typeof archive | undefined = archive;
                while (ancestor) {
                  if (visited.has(ancestor.id)) throw new Error('Cannot index images in a cyclic archive hierarchy.');
                  visited.add(ancestor.id);
                  ancestor.imageCount++;
                  ancestor = ancestor.parentId ? archives.get(ancestor.parentId) : undefined;
                }
              }
              for (const archive of archives.values()) await archiveStore.put(archive);
            };
            void backfillImages().catch(error => {
              migrationError = error;
              try { transaction.abort(); } catch { /* Already aborted by IndexedDB. */ }
            });
          }
        }
      },
      blocking() {
        const current = connection;
        connection = undefined;
        void current?.then(db => db.close());
      },
      terminated() { connection = undefined; },
    }).catch(error => {
      connection = undefined;
      throw migrationError ?? error;
    });
  }
  return connection;
}

function assertImport(bundle: ImportBundle): void {
  const archives = new Map(bundle.archives.map(archive => [archive.id, archive]));
  const files = new Map(bundle.files.map(file => [file.id, file]));
  if (!archives.size || archives.size !== bundle.archives.length || files.size !== bundle.files.length || new Set(bundle.pages.map(page => page.id)).size !== bundle.pages.length) {
    throw new Error('Import contains missing or duplicate identifiers.');
  }
  for (const archive of bundle.archives) {
    const root = archives.get(archive.rootId);
    if (!root || root.parentId !== null || root.rootId !== root.id) throw new Error('Import has an invalid root archive.');
    if (archive.parentId && archives.get(archive.parentId)?.rootId !== archive.rootId) throw new Error('Import has an invalid archive parent.');
  }
  for (const file of bundle.files) {
    if (!archives.has(file.archiveId) || file.id !== `${file.archiveId}/${file.path}` || !(file.blob instanceof Blob)) throw new Error('Import has an invalid file reference.');
  }
  for (const page of bundle.pages) {
    const file = files.get(page.id);
    const archive = archives.get(page.archiveId);
    if (!file || !archive || file.archiveId !== page.archiveId || file.path !== page.path || archive.rootId !== page.rootId) throw new Error('Import has an invalid workspace item reference.');
    if (page.kind !== undefined && page.kind !== 'html' && page.kind !== 'image') throw new Error('Import has an unsupported item type.');
    if (page.kind === 'image' && !isSupportedImagePath(file.path)) throw new Error('Import has an unsupported image reference.');
  }
}

/** One transaction: no successful-looking partial import after quota or write failure. */
export async function saveImport(bundle: ImportBundle): Promise<void> {
  assertImport(bundle);
  const db = await database();
  const tx = db.transaction(['archives', 'pages', 'files'], 'readwrite');
  try {
    await Promise.all([
      ...bundle.archives.map(archive => tx.objectStore('archives').add(archive)),
      ...bundle.pages.map(page => tx.objectStore('pages').add(page)),
      ...bundle.files.map(file => tx.objectStore('files').add(file)),
      tx.done,
    ]);
  } catch (error) {
    try { tx.abort(); } catch { /* The database already aborted the transaction. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

/** Metadata and saved screenshots only; archive resource bytes stay out of startup reads. */
export async function listWorkspace(): Promise<{ archives: ArchiveMeta[]; pages: HtmlPage[]; snapshots: Snapshot[]; folders: WorkspaceFolder[]; organization: ItemOrganization[] }> {
  const db = await database();
  const tx = db.transaction(['archives', 'pages', 'snapshots', 'folders', 'organization'], 'readonly');
  const [archives, pages, snapshots, folders, organization] = await Promise.all([
    tx.objectStore('archives').getAll(), tx.objectStore('pages').getAll(), tx.objectStore('snapshots').getAll(),
    tx.objectStore('folders').getAll(), tx.objectStore('organization').getAll(),
  ]);
  await tx.done;
  archives.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  folders.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return { archives, pages, snapshots, folders, organization };
}

export async function getFile(id: string): Promise<ArchiveFile | undefined> {
  return (await database()).get('files', id);
}

export async function getArchiveFiles(archiveId: string): Promise<Map<string, ArchiveFile>> {
  const db = await database();
  const files = await db.getAllFromIndex('files', 'byArchive', archiveId);
  return new Map(files.map(file => [file.path, file]));
}

export async function putSnapshot(snapshot: Snapshot): Promise<void> {
  if (!(snapshot.blob instanceof Blob) || !snapshot.blob.size || !Number.isFinite(snapshot.width) || !Number.isFinite(snapshot.height) || snapshot.width <= 0 || snapshot.height <= 0) {
    throw new Error('The snapshot is empty or has invalid dimensions.');
  }
  const db = await database();
  const tx = db.transaction(['pages', 'snapshots'], 'readwrite');
  try {
    const page = await tx.objectStore('pages').get(snapshot.pageId);
    if (!page) throw new Error('This page was removed before its snapshot was saved.');
    if (page.kind === 'image') throw new Error('Image files do not need HTML screenshots.');
    await tx.objectStore('snapshots').put(snapshot);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already complete or aborted. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

/** Delete a single import and its descendants, preserving every other workspace root. */
export async function deleteRoot(rootId: string): Promise<void> {
  const db = await database();
  const tx = db.transaction(['archives', 'pages', 'files', 'snapshots', 'organization'], 'readwrite');
  try {
    const archives = await tx.objectStore('archives').index('byRoot').getAllKeys(rootId);
    const pages = await tx.objectStore('pages').index('byRoot').getAllKeys(rootId);
    for (const archiveId of archives) {
      const keys = await tx.objectStore('files').index('byArchive').getAllKeys(archiveId);
      await Promise.all(keys.map(key => tx.objectStore('files').delete(key)));
      await tx.objectStore('archives').delete(archiveId);
    }
    await Promise.all(pages.flatMap(pageId => [tx.objectStore('pages').delete(pageId), tx.objectStore('snapshots').delete(pageId), tx.objectStore('organization').delete(pageId)]));
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already complete or aborted. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

/** Folder assignment is organization metadata; original archive paths never move. */
export async function createFolder(name: string): Promise<WorkspaceFolder> {
  const trimmed = name.trim().normalize('NFC');
  if (!trimmed) throw new Error('Enter a folder name.');
  if (trimmed.length > 80) throw new Error('Use a folder name of 80 characters or fewer.');
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('Folder names cannot contain control characters.');
  const db = await database();
  const tx = db.transaction('folders', 'readwrite');
  try {
    const existing = await tx.store.getAll();
    if (existing.some(folder => folder.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) throw new Error('A folder with that name already exists.');
    const folder: WorkspaceFolder = { id: uniqueId(), name: trimmed, createdAt: Date.now() };
    await tx.store.add(folder);
    await tx.done;
    return folder;
  } catch (error) {
    try { tx.abort(); } catch { /* Already complete or aborted. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function setItemFavorite(id: string, favorite: boolean): Promise<ItemOrganization> {
  if (typeof favorite !== 'boolean') throw new Error('Invalid favorite state.');
  const db = await database();
  const tx = db.transaction(['pages', 'organization'], 'readwrite');
  try {
    if (!await tx.objectStore('pages').getKey(id)) throw new Error('This item is no longer in the workspace.');
    const current = await tx.objectStore('organization').get(id);
    const next: ItemOrganization = { id, favorite, folderId: current?.folderId ?? null };
    await tx.objectStore('organization').put(next);
    await tx.done;
    return next;
  } catch (error) {
    try { tx.abort(); } catch { /* Already complete or aborted. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function moveItemsToFolder(ids: string[], folderId: string | null): Promise<ItemOrganization[]> {
  const db = await database();
  const tx = db.transaction(['pages', 'folders', 'organization'], 'readwrite');
  try {
    if (folderId !== null && !await tx.objectStore('folders').getKey(folderId)) throw new Error('Choose an existing folder.');
    const result: ItemOrganization[] = [];
    for (const id of new Set(ids)) {
      if (!await tx.objectStore('pages').getKey(id)) throw new Error('An item was removed before it could be moved.');
      const current = await tx.objectStore('organization').get(id);
      const next: ItemOrganization = { id, favorite: current?.favorite ?? false, folderId };
      await tx.objectStore('organization').put(next);
      result.push(next);
    }
    await tx.done;
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* Already complete or aborted. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function getPreference<T>(key: string): Promise<T | undefined> {
  return (await (await database()).get('prefs', key))?.value as T | undefined;
}

export async function setPreference(key: string, value: unknown): Promise<void> {
  await (await database()).put('prefs', { key, value });
}
