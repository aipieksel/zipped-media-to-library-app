import type { ArchiveFile, ArchiveMeta, CloudCatalogue, CloudFileDescriptor, HtmlPage, ImageRendition, RemoteArchiveFile } from './types';

const HASH = /^[a-f0-9]{64}$/;
const MAX_METADATA_BYTES = 24 * 1024 * 1024;
const MAX_RESOURCE_BYTES = 128 * 1024 * 1024;
const manifestCache = new Map<string, Promise<Map<string, ArchiveFile>>>();
const pendingResources = new Map<string, Promise<Blob>>();

export function isCloudArchive(id: string): boolean { return id.startsWith('cloud-'); }

export function validCloudPath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && path.length <= 4096 &&
    !/[\u0000-\u001f\u007f\\]/.test(path) && !path.startsWith('/') &&
    !/^[A-Za-z]:/.test(path) && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function cloudError(response: Response): Error {
  return new Error(response.status === 401 || response.status === 403
    ? 'Sign in to this private workspace to load the saved collection.'
    : `The saved collection could not be loaded (HTTP ${response.status}). Try again.`);
}

async function readJson(path: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(path, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw cloudError(response);
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('The saved collection returned a sign-in page instead of files. Sign in and try again.');
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_METADATA_BYTES) throw new Error('The collection metadata is too large.');
  if (!response.body) throw new Error('The collection metadata is empty.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let received = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      received += value.byteLength;
      if (received > MAX_METADATA_BYTES) { await reader.cancel(); throw new Error('The collection metadata is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  const body = new TextDecoder().decode(joined);
  try { return JSON.parse(body); } catch { throw new Error('The saved collection metadata is invalid.'); }
}

function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** Validate metadata before it is allowed to add any IndexedDB records. */
export function validateCloudCatalogue(value: unknown): CloudCatalogue {
  if (!object(value) || value.schema !== 1 || typeof value.generation !== 'string' ||
      !Array.isArray(value.archives) || !Array.isArray(value.pages) || !object(value.manifests) ||
      value.archives.length > 20000 || value.pages.length > 100000) throw new Error('The saved collection catalogue is invalid.');
  const archives = value.archives as ArchiveMeta[];
  const pages = value.pages as HtmlPage[];
  const ids = new Set<string>();
  const archiveMap = new Map<string, ArchiveMeta>();
  for (const archive of archives) {
    if (!object(archive) || typeof archive.id !== 'string' || !isCloudArchive(archive.id) || ids.has(archive.id) ||
        typeof archive.rootId !== 'string' || typeof archive.name !== 'string' ||
        !(archive.parentId === null || typeof archive.parentId === 'string') ||
        typeof archive.mountPath !== 'string' || !integer(archive.createdAt) || !integer(archive.fileCount) ||
        !integer(archive.pageCount) || !integer(archive.byteSize) || !Array.isArray(archive.warnings) ||
        !archive.warnings.every(warning => typeof warning === 'string') ||
        typeof value.manifests[archive.id] !== 'string' || !HASH.test(value.manifests[archive.id] as string)) {
      throw new Error('The saved collection contains an invalid archive.');
    }
    ids.add(archive.id); archiveMap.set(archive.id, archive);
  }
  for (const archive of archives) {
    const root = archiveMap.get(archive.rootId);
    if (!root || root.parentId !== null || root.id !== root.rootId ||
        (archive.parentId && archiveMap.get(archive.parentId)?.rootId !== archive.rootId)) throw new Error('The saved collection hierarchy is invalid.');
    const seen = new Set<string>(); let current: ArchiveMeta | undefined = archive;
    while (current) {
      if (seen.has(current.id)) throw new Error('The saved collection contains a cyclic hierarchy.');
      seen.add(current.id); current = current.parentId ? archiveMap.get(current.parentId) : undefined;
    }
  }
  const pageIds = new Set<string>();
  for (const page of pages) {
    const archive = archiveMap.get(page.archiveId);
    if (!object(page) || !archive || page.rootId !== archive.rootId || !validCloudPath(page.path) ||
        page.id !== `${page.archiveId}/${page.path}` || pageIds.has(page.id) ||
        typeof page.label !== 'string' || typeof page.isIndex !== 'boolean' || !integer(page.size) ||
        (page.kind !== undefined && page.kind !== 'html' && page.kind !== 'image')) throw new Error('The saved collection contains an invalid file.');
    if(page.modifiedAt!==undefined&&(!integer(page.modifiedAt)||page.modifiedAt<1||!Number.isFinite(new Date(page.modifiedAt).getTime())))throw new Error('Invalid saved file date.');
    for(const key of ['createdAt','addedAt'] as const)if(page[key]!==undefined&&(!integer(page[key])||page[key]!<1||!Number.isFinite(new Date(page[key]!).getTime())))throw new Error('Invalid saved file date.');
    if(page.dateSource!==undefined&&!['file','library','imported'].includes(page.dateSource))throw new Error('Invalid saved file date source.');
    if(page.imageHash!==undefined&&((page.kind??'html')!=='image'||typeof page.imageHash!=='string'||!HASH.test(page.imageHash)))throw new Error('Invalid saved image hash.');
    if(page.mime!==undefined&&(typeof page.mime!=='string'||!((page.kind??'html')==='image'?/^image\/[A-Za-z0-9.+-]+$/.test(page.mime):/^(text\/html|application\/xhtml\+xml)$/.test(page.mime))))throw new Error('Invalid saved file MIME type.');
    pageIds.add(page.id);
  }
  if(value.images!==undefined){
    if(!object(value.images)||Object.keys(value.images).length>100000)throw new Error('The image preview metadata is invalid.');
    for(const[hash,candidate]of Object.entries(value.images)){
      if(!HASH.test(hash)||!object(candidate)||!object(candidate.original))throw new Error('The image preview metadata is invalid.');
      const original=candidate.original;
      if(typeof original.archiveId!=='string'||!isCloudArchive(original.archiveId)||!validCloudPath(original.path)||
          typeof original.mime!=='string'||!original.mime.startsWith('image/')||!integer(original.size)||original.size>MAX_RESOURCE_BYTES)throw new Error('Invalid original image reference.');
      for(const variant of ['thumbnail','preview'])if(candidate[variant]!==undefined&&(typeof candidate[variant]!=='string'||!HASH.test(candidate[variant] as string)))throw new Error('Invalid image preview hash.');
      for(const dimension of ['width','height'])if(candidate[dimension]!==undefined&&(!integer(candidate[dimension])||candidate[dimension]===0))throw new Error('Invalid image dimensions.');
      if(candidate.placeholder!==undefined&&(typeof candidate.placeholder!=='string'||candidate.placeholder.length>1024||!/^data:image\/webp;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(candidate.placeholder)||candidate.placeholder==='data:image/webp;base64,'))throw new Error('Invalid image placeholder.');
    }
  }
  return value as unknown as CloudCatalogue;
}

export async function fetchCloudCatalogue(fetcher: typeof fetch = fetch): Promise<CloudCatalogue> {
  return validateCloudCatalogue(await readJson('/api/collection', fetcher));
}

/** The archive manifest is metadata only: no image/script/font bytes are downloaded here. */
export async function fetchCloudArchiveFiles(archiveId: string, manifestHash: string, fetcher: typeof fetch = fetch): Promise<Map<string, ArchiveFile>> {
  if (!isCloudArchive(archiveId) || !HASH.test(manifestHash)) throw new Error('Invalid saved archive reference.');
  const cacheKey = `${archiveId}:${manifestHash}`;
  const existing = manifestCache.get(cacheKey); if (existing) return existing;
  const pending = (async () => {
    const value = await readJson(`/api/collection/archive?id=${encodeURIComponent(archiveId)}`, fetcher);
    if (!object(value) || value.archiveId !== archiveId || !Array.isArray(value.files) || value.files.length > 20000) throw new Error('Invalid saved archive metadata.');
    const files = new Map<string, ArchiveFile>();
    for (const candidate of value.files) {
      const file = candidate as CloudFileDescriptor;
      if (!object(file) || file.archiveId !== archiveId || !validCloudPath(file.path) ||
          file.id !== `${archiveId}/${file.path}` || !integer(file.size) || file.size > MAX_RESOURCE_BYTES ||
          typeof file.sha256 !== 'string' || !HASH.test(file.sha256) || typeof file.mime !== 'string' ||
          files.has(file.path)) throw new Error('Invalid saved resource reference.');
      const remote: RemoteArchiveFile = { id: file.id, archiveId, path: file.path, mime: file.mime,
        remote: { archiveId, path: file.path, size: file.size, sha256: file.sha256 } };
      files.set(file.path, remote);
    }
    return files;
  })();
  manifestCache.set(cacheKey, pending);
  // Retain at most eight metadata maps. Resource bytes are never retained in this cache.
  if (manifestCache.size > 8) manifestCache.delete(manifestCache.keys().next().value!);
  try { return await pending; } catch (error) { manifestCache.delete(cacheKey); throw error; }
}

/** Fetch only the requested file. Concurrent consumers share an in-flight request, not a permanent Blob cache. */
export async function resolveFileBlob(file: ArchiveFile, fetcher: typeof fetch = fetch): Promise<Blob> {
  if (file.blob instanceof Blob) return file.blob;
  const remote = file.remote;
  if (!remote || !validCloudPath(remote.path) || !isCloudArchive(remote.archiveId) || !HASH.test(remote.sha256) ||
      !integer(remote.size) || remote.size > MAX_RESOURCE_BYTES) throw new Error('Invalid saved file reference.');
  const key = `${remote.archiveId}/${remote.path}:${remote.sha256}`;
  const existing = pendingResources.get(key); if (existing) return existing;
  const pending = (async () => {
      const response = await fetcher(`/api/collection/file?archive=${encodeURIComponent(remote.archiveId)}&path=${encodeURIComponent(remote.path)}`,
        { credentials: 'same-origin' });
      if (!response.ok) throw cloudError(response);
      const declared = response.headers.get('content-length');
      if (declared !== null && Number(declared) !== remote.size) throw new Error('The saved file size does not match its catalogue.');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== remote.size) throw new Error('The saved file download is incomplete. Try again.');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== remote.sha256) throw new Error('The saved file failed its integrity check. Try again.');
      return new Blob([buffer], { type: file.mime });
  })();
  pendingResources.set(key, pending);
  try { return await pending; } finally { pendingResources.delete(key); }
}


let imageMetadata:Readonly<Record<string,ImageRendition>>={};
let imageGeneration='';
const metadataListeners=new Set<()=>void>();

/** Metadata arrives from the persisted catalogue before first workspace paint and updates subscribed viewers. */
export function installImageMetadata(images:Record<string,ImageRendition>|undefined,generation:string):void{
  if(imageGeneration===generation)return;
  imageMetadata=images??{};imageGeneration=generation;
  for(const listener of metadataListeners)listener();
}
export function getImageMetadata(hash:string|undefined):ImageRendition|undefined{return hash?imageMetadata[hash]:undefined;}
export function subscribeImageMetadata(listener:()=>void):()=>void{metadataListeners.add(listener);return()=>{metadataListeners.delete(listener);};}
export function imageMetadataVersion():string{return imageGeneration;}
