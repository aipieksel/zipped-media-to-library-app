import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { uniqueId } from './identity';
import {hasFavoriteFolder,normalizeFolderFavorites,removeArchiveFolderFavorites} from './folder-favorites';
import {configureDimensionPersistence,installImageDimensions} from './image-dimensions';
import {thumbnailEvictions,THUMBNAIL_MAX_FILE_BYTES} from './thumbnail-cache';
import { isSupportedImagePath } from './archive';
import { fetchCloudCatalogue, fetchCloudArchiveFiles, isCloudArchive, resolveFileBlob, installImageMetadata } from './cloud';
import type { ArchiveFile, ArchiveMeta, CloudCatalogue, GalleryThumbnail, HtmlPage, ImportBundle, ItemOrganization, LocalArchiveFile, Snapshot, WorkspaceFolder } from './types';

interface WorkspaceSchema extends DBSchema {
  archives: { key: string; value: ArchiveMeta; indexes: { byRoot: string } };
  pages: { key: string; value: HtmlPage; indexes: { byRoot: string; byArchive: string } };
  files: { key: string; value: LocalArchiveFile; indexes: { byArchive: string } };
  snapshots: { key: string; value: Snapshot };
  prefs: { key: string; value: { key: string; value: unknown } };
  folders: { key: string; value: WorkspaceFolder };
  organization: { key: string; value: ItemOrganization };
  galleryThumbnails: {key:string;value:GalleryThumbnail;indexes:{byPage:string}};
}

let connection: Promise<IDBPDatabase<WorkspaceSchema>> | undefined;

function database(): Promise<IDBPDatabase<WorkspaceSchema>> {
  if (!connection) {
    let migrationError: unknown;
    connection = openDB<WorkspaceSchema>('folio-workspace', 3, {
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
        if(oldVersion<3)db.createObjectStore('galleryThumbnails',{keyPath:'key'}).createIndex('byPage','pageId');
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
export async function listWorkspace(): Promise<{ archives: ArchiveMeta[]; pages: HtmlPage[]; snapshots: Snapshot[]; folders: WorkspaceFolder[]; organization: ItemOrganization[]; favoriteFolders: string[] }> {
  const db = await database();
  const tx = db.transaction(['archives', 'pages', 'snapshots', 'folders', 'organization', 'prefs'], 'readonly');
  const [archives, pages, snapshots, folders, organization, imageIndex, favoriteFolders, dimensions] = await Promise.all([
    tx.objectStore('archives').getAll(), tx.objectStore('pages').getAll(), tx.objectStore('snapshots').getAll(),
    tx.objectStore('folders').getAll(), tx.objectStore('organization').getAll(), tx.objectStore('prefs').get('cloudImages'), tx.objectStore('prefs').get('favoriteFolders'), tx.objectStore('prefs').get('imageDimensions'),
  ]);
  await tx.done;
  const cachedImages=imageIndex?.value as {generation?:string;images?:Record<string,import('./types').ImageRendition>}|undefined;
  installImageDimensions(dimensions?.value);
  if(cachedImages?.generation)installImageMetadata(cachedImages.images,cachedImages.generation);
  archives.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  folders.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return { archives, pages, snapshots, folders, organization, favoriteFolders:[...normalizeFolderFavorites(favoriteFolders?.value)] };
}

export async function getFile(id: string): Promise<LocalArchiveFile | undefined> {
  const db = await database();
  const local = await db.get('files', id);
  if (local) return local;
  const page = await db.get('pages', id);
  if (!page || !isCloudArchive(page.archiveId)) return undefined;
  const file = (await getArchiveFiles(page.archiveId)).get(page.path);
  if (!file) return undefined;
  return { id: file.id, archiveId: file.archiveId, path: file.path, mime: file.mime, blob: await resolveFileBlob(file) };
}

export async function getArchiveFiles(archiveId: string): Promise<Map<string, ArchiveFile>> {
  const db = await database();
  const archive = await db.get('archives', archiveId);
  if (archive?.cloud) return fetchCloudArchiveFiles(archiveId, archive.cloud.manifest);
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
  const tx = db.transaction(['archives', 'pages', 'files', 'snapshots', 'organization', 'prefs','galleryThumbnails'], 'readwrite');
  try {
    if (isCloudArchive(rootId)) {
      const previous = await tx.objectStore('prefs').get('hiddenCloudRoots');
      const hidden = Array.isArray(previous?.value) ? previous.value.filter((id): id is string => typeof id === 'string') : [];
      await tx.objectStore('prefs').put({ key: 'hiddenCloudRoots', value: [...new Set([...hidden, rootId])] });
    }
    const archives = await tx.objectStore('archives').index('byRoot').getAllKeys(rootId);
    const pages = await tx.objectStore('pages').index('byRoot').getAllKeys(rootId);
    const favoriteFolders = await tx.objectStore('prefs').get('favoriteFolders');
    await tx.objectStore('prefs').put({key:'favoriteFolders',value:removeArchiveFolderFavorites(favoriteFolders?.value,archives)});
    for (const archiveId of archives) {
      const keys = await tx.objectStore('files').index('byArchive').getAllKeys(archiveId);
      await Promise.all(keys.map(key => tx.objectStore('files').delete(key)));
      await tx.objectStore('archives').delete(archiveId);
    }
    const removedPages=new Set(pages);
    for(const entry of await tx.objectStore('galleryThumbnails').getAll())if(removedPages.has(entry.pageId))await tx.objectStore('galleryThumbnails').delete(entry.key);
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

/** Folder membership is inherited at display time; individual file stars remain independent. */
export async function setFolderFavorite(id: string, favorite: boolean): Promise<string[]> {
  if (typeof id !== 'string' || typeof favorite !== 'boolean') throw new Error('Invalid folder favorite.');
  const db = await database();
  const tx = db.transaction(['archives','pages','folders','organization','prefs'], 'readwrite');
  try {
    const [archives,pages,folders,organization,stored] = await Promise.all([
      tx.objectStore('archives').getAll(),tx.objectStore('pages').getAll(),tx.objectStore('folders').getAll(),
      tx.objectStore('organization').getAll(),tx.objectStore('prefs').get('favoriteFolders'),
    ]);
    const favorites=normalizeFolderFavorites(stored?.value);
    if ((favorite || !favorites.has(id)) && !hasFavoriteFolder(id,archives,pages,folders,new Map(organization.map(item=>[item.id,item])))) throw new Error('This folder is no longer in the workspace.');
    if (favorite) favorites.add(id); else favorites.delete(id);
    const result=[...favorites];
    await tx.objectStore('prefs').put({key:'favoriteFolders',value:result});
    await tx.done;
    return result;
  } catch(error) {
    try {tx.abort();} catch { /* Already completed or aborted. */ }
    await tx.done.catch(()=>undefined);
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


/** Pure selection keeps hidden roots out of repeat catalogue synchronizations. */
export function cloudMetadataForSync(catalogue: CloudCatalogue, hiddenRoots: readonly string[]) {
  const hidden = new Set(hiddenRoots);
  return {
    archives: catalogue.archives.filter(archive => !hidden.has(archive.rootId)).map(archive => ({
      ...archive, cloud: { manifest: catalogue.manifests[archive.id], generation: catalogue.generation },
    })),
    pages: catalogue.pages.filter(page => !hidden.has(page.rootId)),
  };
}

let cloudSync: Promise<CloudCatalogue> | undefined;

/** Only archive/page metadata is stored. Binary resources remain private on the Site. */
export async function syncCloudCollection(fetcher: typeof fetch = fetch): Promise<CloudCatalogue> {
  if (cloudSync) return cloudSync;
  cloudSync = (async () => {
    // Finish the network request and validation before opening the short write transaction.
    const catalogue = await fetchCloudCatalogue(fetcher);
    const db = await database();
    const tx = db.transaction(['archives', 'pages', 'prefs'], 'readwrite');
    try {
      const pref = await tx.objectStore('prefs').get('hiddenCloudRoots');
      const hidden = Array.isArray(pref?.value) ? pref.value.filter((id): id is string => typeof id === 'string') : [];
      const metadata = cloudMetadataForSync(catalogue, hidden);
      await Promise.all([
        ...metadata.archives.map(archive => tx.objectStore('archives').put(archive)),
        ...metadata.pages.map(page => tx.objectStore('pages').put(page)),
        tx.objectStore('prefs').put({ key: 'cloudGeneration', value: catalogue.generation }),
        tx.objectStore('prefs').put({ key: 'cloudImages', value: {generation:catalogue.generation,images:catalogue.images??{}} }),
        tx.done,
      ]);
      installImageMetadata(catalogue.images,catalogue.generation);
      return catalogue;
    } catch (error) {
      try { tx.abort(); } catch { /* Already completed or aborted. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  })();
  try { return await cloudSync; } finally { cloudSync = undefined; }
}


configureDimensionPersistence(value=>setPreference('imageDimensions',value));

/** Disposable cache failure must never prevent browsing or modify manual screenshots. */
export async function getGalleryThumbnail(key:string):Promise<GalleryThumbnail|undefined>{
  try{
    const db=await database();const tx=db.transaction('galleryThumbnails','readwrite');
    try{
      const record=await tx.store.get(key);
      if(record)await tx.store.put({...record,lastUsedAt:Date.now()});
      await tx.done;return record;
    }catch{try{tx.abort();}catch{/* Already aborted. */}await tx.done.catch(()=>undefined);return undefined;}
  }catch{return undefined;}
}

export async function putGalleryThumbnail(record:GalleryThumbnail):Promise<boolean>{
  if(!record||typeof record.key!=='string'||!record.key||record.key.length>16384||typeof record.pageId!=='string'||!(record.blob instanceof Blob)||record.blob.type!=='image/webp'||!record.blob.size||record.blob.size>THUMBNAIL_MAX_FILE_BYTES||!Number.isSafeInteger(record.width)||!Number.isSafeInteger(record.height)||record.width<1||record.height<1||record.width>360||record.height>360)return false;
  try{
    const db=await database();const tx=db.transaction(['pages','galleryThumbnails'],'readwrite');
    try{
    if(!await tx.objectStore('pages').getKey(record.pageId)){await tx.done;return false;}
    const store=tx.objectStore('galleryThumbnails');
    const now=Date.now();await store.put({...record,createdAt:now,lastUsedAt:now});
    const entries=await store.getAll();
    for(const key of thumbnailEvictions(entries.map(entry=>({key:entry.key,bytes:entry.blob.size,lastUsedAt:entry.lastUsedAt}))))await store.delete(key);
    await tx.done;return true;
    }catch{try{tx.abort();}catch{/* Already aborted. */}await tx.done.catch(()=>undefined);return false;}
  }catch{return false;}
}
