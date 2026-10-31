const HASH = /^[a-f0-9]{64}$/;
const ID = /^cloud-[a-z0-9-]{1,100}$/;
export const MAX_OBJECT_BYTES = 16 * 1024 * 1024;
const ROOT_KEY = 'folio/collection.json';
const objectKey = hash => `folio/objects/${hash}`;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const validDate = value => integer(value) && value > 0 && Number.isFinite(new Date(value).getTime());
const dimension = value => Number.isSafeInteger(value) && value > 0 && value <= 65536;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const safePath = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\u0000-\u001f\u007f\\]/.test(value) && !value.startsWith('/') && !/^[A-Za-z]:/.test(value) && !value.split('/').some(part => !part || part === '..' || part === '.');
const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
const catalogueCache = new WeakMap();
const manifestCache = new WeakMap();
export async function sha256(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join(''); }

async function readJson(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  if (object.size > MAX_OBJECT_BYTES) fail('Collection metadata exceeds its limit.', 503);
  return JSON.parse(await object.text());
}

async function activeCatalogue(bucket) {
  const cached = catalogueCache.get(bucket);
  if (cached && cached.expires > Date.now()) return cached.pending;
  const entry = { expires: Infinity, pending: null };
  entry.pending = readJson(bucket, ROOT_KEY).then(index => {
    entry.expires = Date.now() + 5000;
    return index;
  }).catch(error => { catalogueCache.delete(bucket); throw error; });
  catalogueCache.set(bucket, entry);
  return entry.pending;
}

async function archiveManifest(bucket, hash) {
  let cache = manifestCache.get(bucket);
  if (!cache) { cache = new Map(); manifestCache.set(bucket, cache); }
  if (cache.has(hash)) return cache.get(hash);
  const pending = readJson(bucket, objectKey(hash)).catch(error => { cache.delete(hash); throw error; });
  cache.set(hash, pending);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return pending;
}

/** Check the closed graph, not just a caller's claimed object inventory. */
export async function validateCatalogue(index, bucket) {
  if (!index || index.schema !== 1 || !HASH.test(index.generation) || !Array.isArray(index.archives) || !Array.isArray(index.pages) || !record(index.manifests) || !record(index.objects) || !Array.isArray(index.packages)) fail('Invalid collection catalogue.');
  if (!index.archives.length || index.archives.length > 10000 || index.pages.length > 100000 || index.packages.length > 1000) fail('Collection record limit exceeded.');
  const entries = Object.entries(index.objects);
  if (!entries.length || entries.length > 4096) fail('Collection object limit exceeded.');
  for (const [hash, size] of entries) if (!HASH.test(hash) || !integer(size) || size < 1 || size > MAX_OBJECT_BYTES) fail('Invalid object hash or size.');
  const archives = new Map();
  for (const archive of index.archives) {
    if (!ID.test(archive.id) || archives.has(archive.id) || typeof archive.name !== 'string' || typeof archive.mountPath !== 'string' || !integer(archive.createdAt) || !integer(archive.fileCount) || !integer(archive.pageCount) || !integer(archive.byteSize) || !Array.isArray(archive.warnings) || !archive.warnings.every(warning => typeof warning === 'string')) fail('Invalid or duplicate archive.');
    if (archive.modifiedAt !== undefined && !validDate(archive.modifiedAt)) fail('Invalid archive modified date.');
    archives.set(archive.id, archive);
  }
  for (const archive of archives.values()) {
    if (!archives.has(archive.rootId)) fail('Missing archive root.');
    const root = archives.get(archive.rootId);
    if (root.parentId !== null || root.rootId !== root.id) fail('Invalid archive root.');
    const visited = new Set([archive.id]);
    let current = archive;
    while (current.parentId !== null) {
      if (visited.size > 12 || visited.has(current.parentId)) fail('Cyclic or excessively nested archive.');
      current = archives.get(current.parentId);
      if (!current || current.rootId !== archive.rootId) fail('Invalid archive parent.');
      visited.add(current.id);
    }
  }
  if (Object.keys(index.manifests).length !== archives.size) fail('Archive manifests are incomplete.');
  const used = new Set();
  const owners = new Map();
  for (const archive of archives.values()) {
    const hash = index.manifests[archive.id];
    if (!HASH.test(hash) || !Object.hasOwn(index.objects, hash)) fail('Missing archive manifest reference.');
    used.add(hash);
    if (!owners.has(hash)) owners.set(hash, new Set());
    owners.get(hash).add(archive.id);
  }
  // Validate one group at a time. Do not retain every manifest or its slices in this isolate.
  const files = new Map();
  let resources = 0;
  for (const [hash, required] of owners) {
    const group = await readJson(bucket, objectKey(hash));
    if (!group || group.schema !== 1 || !record(group.archives) || Object.keys(group.archives).length > 10000) fail('Archive manifest is unavailable.');
    for (const archiveId of required) if (!Object.hasOwn(group.archives, archiveId)) fail('Archive is absent from its referenced manifest.');
    for (const [archiveId, manifest] of Object.entries(group.archives)) {
      if (!archives.has(archiveId) || index.manifests[archiveId] !== hash || manifest.archiveId !== archiveId || !Array.isArray(manifest.files)) fail('Unlisted archive manifest.');
      for (const file of manifest.files) {
        if (++resources > 200000 || !safePath(file.path) || file.archiveId !== archiveId || file.id !== `${archiveId}/${file.path}` || files.has(file.id)) fail('Invalid resource identity or path.');
        if (!HASH.test(file.sha256) || !integer(file.size) || file.size > 128 * 1024 * 1024 || typeof file.mime !== 'string' || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(file.mime) || !Array.isArray(file.slices) || file.slices.length > 16) fail('Invalid resource descriptor.');
        let bytes = 0;
        for (const slice of file.slices) {
          if (!HASH.test(slice.hash) || !Object.hasOwn(index.objects, slice.hash) || !integer(slice.offset) || !integer(slice.length) || slice.length < 1 || !Number.isSafeInteger(slice.offset + slice.length) || slice.offset + slice.length > index.objects[slice.hash]) fail('Invalid or unavailable resource slice.');
          used.add(slice.hash); bytes += slice.length;
        }
        if (bytes !== file.size) fail('Resource slice sizes do not match.');
        files.set(file.id, { archiveId, path:file.path, mime:file.mime, size:file.size, sha256:file.sha256 });
      }
    }
  }
  // Display variants extend the same closed, immutable object graph as originals.
  const imageAssets = index.imageAssets === undefined ? {} : index.imageAssets;
  if (!record(imageAssets) || Object.keys(imageAssets).length > 200000 || (index.images !== undefined && !record(index.images)) || (index.images && Object.keys(index.images).length > 100000)) fail('Invalid image metadata inventory.');
  const referencedAssets = new Set();
  for (const [hash, image] of Object.entries(index.images ?? {})) {
    if (!HASH.test(hash) || !record(image) || !record(image.original)) fail('Invalid original image reference.');
    const original = image.original;
    const file = files.get(`${original.archiveId}/${original.path}`);
    if (!file || file.sha256 !== hash || !file.mime.startsWith('image/') || original.archiveId !== file.archiveId || original.path !== file.path || original.mime !== file.mime || original.size !== file.size) fail('Original image reference does not match its resource.');
    for (const key of ['width', 'height']) if (image[key] !== undefined && !dimension(image[key])) fail('Invalid image dimensions.');
    if (image.animated !== undefined && typeof image.animated !== 'boolean') fail('Invalid animated image metadata.');
    if (image.placeholder !== undefined && (typeof image.placeholder !== 'string' || image.placeholder.length > 1024 || !/^data:image\/webp;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.placeholder) || image.placeholder === 'data:image/webp;base64,')) fail('Invalid image placeholder.');
    for (const kind of ['thumbnail', 'preview']) {
      const variant = image[kind], bytes = image[kind + 'Bytes'];
      if (variant === undefined) { if (bytes !== undefined) fail('Image variant byte size has no reference.'); continue; }
      if (!HASH.test(variant) || !Object.hasOwn(imageAssets, variant) || !integer(bytes) || bytes < 1 || bytes > MAX_IMAGE_BYTES || imageAssets[variant]?.size !== bytes) fail('Invalid image variant reference or byte size.');
      referencedAssets.add(variant);
    }
  }
  for (const [hash, asset] of Object.entries(imageAssets)) {
    if (!referencedAssets.has(hash) || !record(asset) || asset.sha256 !== hash || !HASH.test(hash) || asset.mime !== 'image/webp' || !integer(asset.size) || asset.size < 1 || asset.size > MAX_IMAGE_BYTES || !Array.isArray(asset.slices) || !asset.slices.length || asset.slices.length > 16) fail('Invalid or unreferenced image asset.');
    let bytes = 0;
    for (const slice of asset.slices) {
      if (!record(slice) || !HASH.test(slice.hash) || !Object.hasOwn(index.objects, slice.hash) || !integer(slice.offset) || !integer(slice.length) || slice.length < 1 || !Number.isSafeInteger(slice.offset + slice.length) || slice.offset + slice.length > index.objects[slice.hash]) fail('Invalid image asset slice.');
      used.add(slice.hash); bytes += slice.length;
    }
    if (bytes !== asset.size) fail('Image asset slice sizes do not match.');
  }
  const pages = new Set();
  for (const page of index.pages) {
    const archive = archives.get(page.archiveId), file = files.get(page.id);
    if (!file || !archive || pages.has(page.id) || page.rootId !== archive.rootId || page.path !== file.path || page.size !== file.size || typeof page.label !== 'string' || typeof page.isIndex !== 'boolean' || !['html', 'image'].includes(page.kind ?? 'html')) fail('Invalid page/resource linkage.');
    if (page.modifiedAt !== undefined && !validDate(page.modifiedAt)) fail('Invalid page modified date.');
    if (page.mime !== undefined && (page.mime !== file.mime || ((page.kind ?? 'html') === 'image' ? !file.mime.startsWith('image/') : !['text/html', 'application/xhtml+xml'].includes(file.mime)))) fail('Invalid page MIME linkage.');
    for (const key of ['createdAt','addedAt']) if (page[key] !== undefined && !validDate(page[key])) fail('Invalid page source date.');
    if (page.dateSource !== undefined && !['file', 'library', 'imported'].includes(page.dateSource)) fail('Invalid page date source.');
    if ((page.kind ?? 'html') === 'image' && (index.images !== undefined || page.imageHash !== undefined) && (page.imageHash !== file.sha256 || !record(index.images) || !Object.hasOwn(index.images, page.imageHash) || (page.mime !== undefined && page.mime !== file.mime))) fail('Invalid page image hash linkage.');
    if ((page.kind ?? 'html') !== 'image' && page.imageHash !== undefined) fail('Invalid page image hash linkage.');
    pages.add(page.id);
  }
  if (used.size !== entries.length || [...used].some(hash => !Object.hasOwn(index.objects, hash))) fail('Collection object inventory is not closed.');
  // Bounded parallel HEAD checks. Every immutable object was hash-verified on upload.
  for (let at = 0; at < entries.length; at += 12) await Promise.all(entries.slice(at, at + 12).map(async ([hash, size]) => {
    const object = await bucket.head(objectKey(hash));
    if (!object || object.size !== size || object.customMetadata?.sha256 !== hash) fail('Collection has missing or unverified objects.');
  }));
  const html = index.pages.filter(page => (page.kind ?? 'html') === 'html').length;
  if (index.stats?.imageVariants !== undefined && index.stats.imageVariants !== Object.keys(imageAssets).length) fail('Image variant totals do not reconcile.');
  if (index.stats?.displayImageBytes !== undefined && index.stats.displayImageBytes !== Object.values(imageAssets).reduce((sum, asset) => sum + asset.size, 0)) fail('Image byte totals do not reconcile.');
  if (!index.stats || index.stats.packages !== index.packages.length || index.stats.html !== html || index.stats.images !== index.pages.length - html || index.stats.resources !== resources) fail('Collection totals do not reconcile.');
  return { resources, html, images: index.pages.length - html };
}

async function boundedBody(request) {
  const raw = request.headers.get('content-length');
  const length = Number(raw);
  if (!raw || !integer(length)) fail('Content-Length is required.', 411);
  if (length > MAX_OBJECT_BYTES) fail('Upload exceeds the 16 MiB object limit.', 413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== length) fail('Upload length does not match.');
  return bytes;
}

async function resourceResponse(request, bucket, index, url) {
  const archiveId = url.searchParams.get('archive'), path = url.searchParams.get('path');
  if (!ID.test(archiveId ?? '') || !safePath(path)) fail('Invalid resource reference.');
  const manifestHash = index.manifests[archiveId];
  if (!manifestHash) fail('Archive not found.', 404);
  const group = await archiveManifest(bucket, manifestHash);
  const file = group?.archives?.[archiveId]?.files?.find(item => item.path === path);
  if (!file) fail('Resource not found.', 404);
  const filename = path.split('/').at(-1).replace(/[\x00-\x1f\x7f"\\]/g, '_');
  const responseHeaders = { ...headers, 'content-type': file.mime, 'content-length': String(file.size), 'x-content-sha256': file.sha256, 'content-security-policy': "sandbox; default-src 'none'", 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` };
  if (url.searchParams.get('v') === file.sha256 && file.mime.startsWith('image/')) {
    responseHeaders['cache-control'] = 'private, no-store';
    responseHeaders.etag = `"${file.sha256}"`;
  }
  return streamResource(request, bucket, file, responseHeaders);
}

function notModified(request, etag) {
  return !!etag && (request.headers.get('if-none-match') ?? '').split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag);
}

async function imageResponse(request, bucket, index, url) {
  const hash = url.searchParams.get('hash');
  if (!HASH.test(hash ?? '')) fail('Invalid image asset reference.');
  const asset = Object.hasOwn(index.imageAssets ?? {}, hash) ? index.imageAssets[hash] : undefined;
  if (!asset) fail('Image preview not found.', 404);
  if (asset.sha256 !== hash || asset.mime !== 'image/webp' || !integer(asset.size) || asset.size < 1 || asset.size > MAX_IMAGE_BYTES) fail('Image preview is unavailable.', 503);
  const responseHeaders = { ...headers, 'cache-control': 'private, no-store', 'content-type': 'image/webp', 'content-length': String(asset.size), 'x-content-sha256': hash, etag: `"${hash}"`, 'content-security-policy': "sandbox; default-src 'none'", 'content-disposition': `inline; filename="${hash}.webp"` };
  return streamResource(request, bucket, asset, responseHeaders);
}

function streamResource(request, bucket, file, responseHeaders) {
  if (notModified(request, responseHeaders.etag)) {
    const cachedHeaders = { ...responseHeaders }; delete cachedHeaders['content-length'];
    return new Response(null, { status: 304, headers: cachedHeaders });
  }
  if (request.method === 'HEAD') return new Response(null, { headers: responseHeaders });
  let at = 0, reader;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          if (!reader) {
            if (at === file.slices.length) { controller.close(); return; }
            const slice = file.slices[at++];
            const object = await bucket.get(objectKey(slice.hash), { range: { offset: slice.offset, length: slice.length } });
            if (!object) throw new Error('Collection resource is unavailable.');
            reader = object.body.getReader();
          }
          const chunk = await reader.read();
          if (chunk.done) { reader.releaseLock(); reader = undefined; continue; }
          controller.enqueue(chunk.value); return;
        }
      } catch (error) { controller.error(error); }
    },
    async cancel(reason) { if (reader) await reader.cancel(reason); },
  });
  return new Response(stream, { headers: responseHeaders });
}

/** Sites dispatch enforces this project's existing owner-private custom policy. */
export async function handleCollection(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/collection')) return null;
  try {
    const bucket = env.BUCKET;
    if (!bucket) return json({ error: 'The private collection is not configured.' }, 503);
    if (url.pathname.startsWith('/api/collection/admin/')) {
      const token = request.headers.get('x-folio-ingest-token');
      if (!env.FOLIO_INGEST_TOKEN || token !== env.FOLIO_INGEST_TOKEN) return json({ error: 'Not authorized.' }, 403);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Cross-origin writes are not allowed.' }, 403);
      const match = url.pathname.match(/^\/api\/collection\/admin\/object\/([a-f0-9]{64})$/);
      if (match && request.method === 'HEAD') {
        const object = await bucket.head(objectKey(match[1]));
        return new Response(null, { status: object ? 200 : 404, headers: { ...headers, ...(object ? { 'content-length': String(object.size), 'x-content-sha256': object.customMetadata?.sha256 ?? '' } : {}) } });
      }
      if (match && request.method === 'PUT') {
        const bytes = await boundedBody(request), hash = await sha256(bytes);
        if (hash !== match[1]) fail('Object checksum mismatch.');
        const existing = await bucket.head(objectKey(hash));
        if (existing && (existing.size !== bytes.byteLength || existing.customMetadata?.sha256 !== hash)) fail('Conflicting stored object.', 409);
        if (!existing) await bucket.put(objectKey(hash), bytes, { customMetadata: { sha256: hash } });
        return json({ hash, size: bytes.byteLength, stored: true, reused: !!existing });
      }
      if (url.pathname === '/api/collection/admin/commit' && request.method === 'PUT') {
        const bytes = await boundedBody(request), index = JSON.parse(new TextDecoder().decode(bytes));
        // Release disposable metadata before validating a complete new generation.
        // The active R2 root remains untouched; concurrent reads still resolve that root.
        catalogueCache.delete(bucket);
        manifestCache.delete(bucket);
        await validateCatalogue(index, bucket);
        // One R2 PUT selects the complete generation; failure never clears the prior index.
        await bucket.put(ROOT_KEY, bytes, { httpMetadata: { contentType: 'application/json' } });
        catalogueCache.delete(bucket);
        return json({ generation: index.generation, stats: index.stats, published: true });
      }
      return json({ error: 'Unsupported collection administration route.' }, 405);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    const index = await activeCatalogue(bucket);
    if (!index) return json({ schema: 1, generation: '0'.repeat(64), archives: [], pages: [], manifests: {}, stats: { packages: 0, html: 0, images: 0 } });
    if (url.pathname === '/api/collection' || url.pathname === '/api/collection/') {
      const { objects, imageAssets, ...publicIndex } = index;
      return json(publicIndex);
    }
    if (url.pathname === '/api/collection/archive') {
      const id = url.searchParams.get('id');
      if (!ID.test(id ?? '') || !index.manifests[id]) return json({ error: 'Archive not found.' }, 404);
      const group = await archiveManifest(bucket, index.manifests[id]);
      return group?.archives?.[id] ? json(group.archives[id]) : json({ error: 'Archive manifest unavailable.' }, 503);
    }
    if (url.pathname === '/api/collection/image') return await imageResponse(request, bucket, index, url);
    if (url.pathname === '/api/collection/file') return await resourceResponse(request, bucket, index, url);
    return json({ error: 'Not found.' }, 404);
  } catch (error) { return json({ error: error.status ? error.message : 'Collection request could not be completed.' }, error.status ?? 500); }
}
