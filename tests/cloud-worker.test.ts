import test from 'node:test';
import assert from 'node:assert/strict';
// Worker is runtime-native ESM; these tests exercise the real handler with an in-memory R2 contract.
// @ts-ignore
import { handleCollection, validateCatalogue, sha256, MAX_OBJECT_BYTES } from '../worker/cloud.mjs';

class Bucket {
  values = new Map<string, { bytes: Uint8Array; customMetadata?: any }>();
  async put(key: string, input: ArrayBuffer | Uint8Array | string, options: any = {}) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
    this.values.set(key, { bytes, customMetadata: options.customMetadata });
  }
  async head(key: string) { const value = this.values.get(key); return value ? { size: value.bytes.length, customMetadata: value.customMetadata } : null; }
  async get(key: string, options: any = {}) {
    const value = this.values.get(key); if (!value) return null;
    const bytes = options.range ? value.bytes.slice(options.range.offset, options.range.offset + options.range.length) : value.bytes;
    return { size: value.bytes.length, customMetadata: value.customMetadata, text: async () => new TextDecoder().decode(bytes), body: new Response(bytes).body! };
  }
}
const TOKEN = 'test-ingest-secret';
function request(path: string, method = 'GET', body?: string | Uint8Array, token: string | null = TOKEN, extra: Record<string, string> = {}) {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return new Request('https://folio.test' + path, { method, headers: { ...(token ? { 'x-folio-ingest-token': token } : {}), ...(bytes ? { 'content-length': String(bytes.length) } : {}), ...extra }, body: bytes });
}
async function fixture() {
  const bucket = new Bucket();
  const one = new TextEncoder().encode('prefix-<h1>hello</h1>'), two = new TextEncoder().encode('-tail');
  const h1 = await sha256(one), h2 = await sha256(two);
  await bucket.put('folio/objects/' + h1, one, { customMetadata: { sha256: h1 } });
  await bucket.put('folio/objects/' + h2, two, { customMetadata: { sha256: h2 } });
  const content = new TextEncoder().encode('<h1>hello</h1>-tail');
  const file = { id: 'cloud-fixture/index.html', archiveId: 'cloud-fixture', path: 'index.html', mime: 'text/html', size: content.length, sha256: await sha256(content), slices: [{ hash: h1, offset: 7, length: one.length - 7 }, { hash: h2, offset: 0, length: two.length }] };
  const group = { schema: 1, archives: { 'cloud-fixture': { archiveId: 'cloud-fixture', files: [file] } } };
  const data = JSON.stringify(group), manifestHash = await sha256(new TextEncoder().encode(data));
  await bucket.put('folio/objects/' + manifestHash, data, { customMetadata: { sha256: manifestHash } });
  const index = { schema: 1, generation: 'a'.repeat(64), archives: [{ id: 'cloud-fixture', rootId: 'cloud-fixture', parentId: null, name: 'Fixture', mountPath: '', createdAt: 1, fileCount: 1, pageCount: 1, byteSize: content.length, warnings: [] }], pages: [{ id: file.id, archiveId: file.archiveId, rootId: 'cloud-fixture', path: file.path, size: file.size, kind: 'html', label: 'Fixture', isIndex: true }], manifests: { 'cloud-fixture': manifestHash }, objects: { [h1]: one.length, [h2]: two.length, [manifestHash]: new TextEncoder().encode(data).length }, packages: [{ filename: 'fixture.zip' }], stats: { packages: 1, html: 1, images: 0, resources: 1 } };
  return { bucket, index, file, group, content, env: { BUCKET: bucket, FOLIO_INGEST_TOKEN: TOKEN }, h1, h2 };
}

test('cloud uploads require ingest authorization and reject cross-origin mutation', async () => {
  const { env } = await fixture();
  for (const token of [null, 'incorrect']) assert.equal((await handleCollection(request('/api/collection/admin/commit', 'PUT', '{}', token), env)).status, 403);
  assert.equal((await handleCollection(request('/api/collection/admin/commit', 'PUT', '{}', TOKEN, { origin: 'https://evil.test' }), env)).status, 403);
});

test('immutable cloud upload verifies checksum, permits service caller without visitor identity, and is idempotent', async () => {
  const { env } = await fixture(); const bytes = new TextEncoder().encode('exact payload'), hash = await sha256(bytes), route = '/api/collection/admin/object/' + hash;
  assert.equal((await handleCollection(request(route, 'PUT', bytes), env)).status, 200);
  const again = await handleCollection(request(route, 'PUT', bytes), env); assert.equal((await again.json()).reused, true);
  assert.equal((await handleCollection(request('/api/collection/admin/object/' + 'b'.repeat(64), 'PUT', bytes), env)).status, 400);
  assert.equal((await handleCollection(request(route, 'PUT', bytes, TOKEN, { 'content-length': String(MAX_OBJECT_BYTES + 1) }), env)).status, 413);
});

test('catalogue commit rejects missing slices without replacing a prior generation', async () => {
  const { env, bucket, index, h1 } = await fixture();
  await bucket.put('folio/collection.json', JSON.stringify({ generation: 'prior' }));
  bucket.values.delete('folio/objects/' + h1);
  const response = await handleCollection(request('/api/collection/admin/commit', 'PUT', JSON.stringify(index)), env);
  assert.equal(response.status, 400); assert.equal(JSON.parse(await (await bucket.get('folio/collection.json'))!.text()).generation, 'prior');
});

test('cloud streaming reconstructs nonzero offsets and multi-slice files byte for byte', async () => {
  const { env, bucket, index, content } = await fixture();
  const commit = await handleCollection(request('/api/collection/admin/commit', 'PUT', JSON.stringify(index)), env); assert.equal(commit.status, 200, await commit.text());
  const response = await handleCollection(request('/api/collection/file?archive=cloud-fixture&path=index.html'), env);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), content);
  assert.match(response.headers.get('content-security-policy')!, /sandbox/); assert.match(response.headers.get('content-disposition')!, /attachment/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('access-control-allow-origin'), null);
  const catalogue = await handleCollection(request('/api/collection'), env); const value = await catalogue.json(); assert.equal(value.objects, undefined); assert.equal(value.stats.html, 1);
  assert.ok(bucket.values.has('folio/collection.json'));
});

test('catalogue validation rejects fractional, negative, overflow, and wrong-sum slice offsets', async () => {
  for (const offset of [-1, 0.5, Number.MAX_SAFE_INTEGER]) {
    const { bucket, index, group } = await fixture(); group.archives['cloud-fixture'].files[0].slices[0].offset = offset;
    const original = index.manifests['cloud-fixture']; await bucket.put('folio/objects/' + original, JSON.stringify(group));
    await assert.rejects(validateCatalogue(index, bucket), /slice/);
  }
});

test('catalogue validation rejects forged references, unsafe resource paths, and invalid linkage', async () => {
  for (const mode of ['reference', 'path', 'linkage']) {
    const { bucket, index, group } = await fixture();
    if (mode === 'reference') group.archives['cloud-fixture'].files[0].slices[0].hash = 'f'.repeat(64);
    if (mode === 'path') group.archives['cloud-fixture'].files[0].path = '../private.html';
    if (mode === 'linkage') index.pages[0].size++;
    await bucket.put('folio/objects/' + index.manifests['cloud-fixture'], JSON.stringify(group));
    await assert.rejects(validateCatalogue(index, bucket), /slice|path|linkage/);
  }
});

test('resource endpoint rejects traversal and unknown files rather than exposing object keys', async () => {
  const { env, bucket, index } = await fixture(); await bucket.put('folio/collection.json', JSON.stringify(index));
  assert.equal((await handleCollection(request('/api/collection/file?archive=cloud-fixture&path=../private'), env)).status, 400);
  assert.equal((await handleCollection(request('/api/collection/file?archive=cloud-fixture&path=missing.html'), env)).status, 404);
  assert.equal((await handleCollection(request('/api/collection/admin/object/' + 'a'.repeat(64), 'DELETE'), env)).status, 405);
});

test('catalogue rejects missing owning manifests and metadata incompatible with the frontend', async () => {
  const { bucket, index, group } = await fixture();
  group.archives = {} as typeof group.archives;
  await bucket.put('folio/objects/' + index.manifests['cloud-fixture'], JSON.stringify(group));
  index.pages = [];
  await assert.rejects(validateCatalogue(index, bucket), /absent from its referenced manifest/);
  const second = await fixture();
  (second.index.archives[0] as any).warnings = null;
  await assert.rejects(validateCatalogue(second.index, second.bucket), /archive/);
  const third = await fixture();
  (third.index.pages[0] as any).label = undefined;
  await assert.rejects(validateCatalogue(third.index, third.bucket), /linkage/);
});

test('concurrent resource requests share bounded metadata and committing invalidates the catalogue cache', async () => {
  const { env, bucket, index } = await fixture();
  await bucket.put('folio/collection.json', JSON.stringify(index));
  let catalogueReads = 0;
  const original = bucket.get.bind(bucket);
  bucket.get = async (key, options = {}) => { if (key === 'folio/collection.json') catalogueReads++; return original(key, options); };
  await Promise.all(Array.from({ length: 24 }, async () => {
    const response = await handleCollection(request('/api/collection/file?archive=cloud-fixture&path=index.html'), env);
    assert.equal(response.status, 200); await response.arrayBuffer();
  }));
  assert.equal(catalogueReads, 1);
  index.generation = 'b'.repeat(64);
  assert.equal((await handleCollection(request('/api/collection/admin/commit', 'PUT', JSON.stringify(index)), env)).status, 200);
  const current = await handleCollection(request('/api/collection'), env);
  assert.equal((await current.json()).generation, index.generation);
  assert.equal(catalogueReads, 2);
});

async function imageFixture() {
  const base = await fixture();
  const {bucket,group} = base;
  const index:any = base.index;
  const file = group.archives['cloud-fixture'].files[0];
  file.mime = 'image/png'; file.path = 'hero.png'; file.id = `${file.archiveId}/${file.path}`;
  const oldManifest = index.manifests[file.archiveId];
  const manifestBytes = new TextEncoder().encode(JSON.stringify(group)), manifestHash = await sha256(manifestBytes);
  delete index.objects[oldManifest];
  index.manifests[file.archiveId] = manifestHash;index.objects[manifestHash] = manifestBytes.length;
  await bucket.put(`folio/objects/${manifestHash}`,manifestBytes,{customMetadata:{sha256:manifestHash}});
  index.pages[0] = {...index.pages[0],id:file.id,path:file.path,kind:'image',isIndex:false,imageHash:file.sha256,mime:file.mime};
  index.stats.html = 0; index.stats.images = 1;
  const payload = new Uint8Array(Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64'));
  const middle = Math.floor(payload.length/2), one = new Uint8Array(5+middle), two = new Uint8Array(3+payload.length-middle);
  one.set([1,2,3,4,5]);one.set(payload.slice(0,middle),5);two.set([6,7,8]);two.set(payload.slice(middle),3);
  const h1 = await sha256(one), h2 = await sha256(two), hash = await sha256(payload);
  for(const [objectHash,bytes] of [[h1,one],[h2,two]] as const){index.objects[objectHash]=bytes.length;await bucket.put(`folio/objects/${objectHash}`,bytes,{customMetadata:{sha256:objectHash}});}
  index.imageAssets = {[hash]:{sha256:hash,size:payload.length,mime:'image/webp',slices:[{hash:h1,offset:5,length:middle},{hash:h2,offset:3,length:payload.length-middle}]}};
  index.images = {[file.sha256]:{original:{archiveId:file.archiveId,path:file.path,mime:file.mime,size:file.size},width:32,height:16,placeholder:`data:image/webp;base64,${Buffer.from(payload).toString('base64')}`,thumbnail:hash,thumbnailBytes:payload.length,preview:hash,previewBytes:payload.length}};
  index.stats.imageVariants=1;index.stats.displayImageBytes=payload.length;
  return {...base,index,file,payload,hash,asset:index.imageAssets[hash],image:index.images[file.sha256]};
}

test('rendition graph commits with deduplicated variants and streams exact private WebP slices',async()=>{
  const {env,index,payload,hash}=await imageFixture();
  const committed=await handleCollection(request('/api/collection/admin/commit','PUT',JSON.stringify(index)),env);
  assert.equal(committed.status,200,await committed.text());
  const response=await handleCollection(request(`/api/collection/image?hash=${hash}`),env);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),payload);
  assert.equal(response.headers.get('content-type'),'image/webp');
  assert.equal(response.headers.get('cache-control'),'private, max-age=31536000, immutable');
  assert.equal(response.headers.get('etag'),`"${hash}"`);
  assert.equal(response.headers.get('x-content-sha256'),hash);
  assert.equal(response.headers.get('content-length'),String(payload.length));
  assert.match(response.headers.get('content-disposition')!,/^inline;/);
  assert.match(response.headers.get('content-security-policy')!,/sandbox/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  const value=await(await handleCollection(request('/api/collection'),env)).json();
  assert.equal(value.objects,undefined);assert.equal(value.imageAssets,undefined);
  assert.equal(value.images[index.pages[0].imageHash].preview,hash);
});

test('rendition HEAD and conditional GET expose validators without fetching payload bytes',async()=>{
  const {env,bucket,index,hash,payload}=await imageFixture();await bucket.put('folio/collection.json',JSON.stringify(index));
  const reads:string[]=[];const get=bucket.get.bind(bucket);bucket.get=async(key,options={})=>{reads.push(key);return get(key,options);};
  const head=await handleCollection(request(`/api/collection/image?hash=${hash}`,'HEAD'),env);
  assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(payload.length));assert.equal(await head.text(),'');
  for(const etag of [`"${hash}"`,`W/"${hash}"`,`"other", "${hash}"`,'*']){
    const response=await handleCollection(request(`/api/collection/image?hash=${hash}`,'GET',undefined,TOKEN,{'if-none-match':etag}),env);
    assert.equal(response.status,304);assert.equal(response.headers.get('etag'),`"${hash}"`);assert.equal(await response.text(),'');
  }
  assert.deepEqual(reads,['folio/collection.json']);
});

test('image route denies bad hashes, unknown hashes and direct packed-object access',async()=>{
  const {env,bucket,index}=await imageFixture();await bucket.put('folio/collection.json',JSON.stringify(index));
  assert.equal((await handleCollection(request('/api/collection/image?hash=../private'),env)).status,400);
  assert.equal((await handleCollection(request('/api/collection/image?hash='+'f'.repeat(64)),env)).status,404);
  assert.equal((await handleCollection(request('/api/collection/image?hash='+Object.keys(index.objects)[0]),env)).status,404);
});

test('original image cache is immutable only with its exact SHA version; attachments remain protected',async()=>{
  const {env,bucket,index,file,content}=await imageFixture();await bucket.put('folio/collection.json',JSON.stringify(index));
  const path=`/api/collection/file?archive=${file.archiveId}&path=${file.path}`;
  for(const suffix of ['', '&v='+'f'.repeat(64)]){
    const response=await handleCollection(request(path+suffix),env);
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('etag'),null);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),content);
  }
  const response=await handleCollection(request(`${path}&v=${file.sha256}`),env);
  assert.equal(response.headers.get('cache-control'),'private, max-age=31536000, immutable');
  assert.equal(response.headers.get('etag'),`"${file.sha256}"`);assert.match(response.headers.get('content-disposition')!,/^attachment;/);
  assert.match(response.headers.get('content-security-policy')!,/sandbox/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  await response.arrayBuffer();
  const cached=await handleCollection(request(`${path}&v=${file.sha256}`,'GET',undefined,TOKEN,{'if-none-match':`"${file.sha256}"`}),env);
  assert.equal(cached.status,304);
  const html=await fixture();await html.bucket.put('folio/collection.json',JSON.stringify(html.index));
  const htmlResponse=await handleCollection(request(`/api/collection/file?archive=${html.file.archiveId}&path=${html.file.path}&v=${html.file.sha256}`),html.env);
  assert.equal(htmlResponse.headers.get('cache-control'),'private, no-store');assert.equal(htmlResponse.headers.get('etag'),null);await htmlResponse.arrayBuffer();
});

test('rendition validation rejects forged canonical source, original SHA and page image linkage',async()=>{
  for(const mode of ['archive','path','mime','size','original-sha','page-sha','page-mime','html-sha']){
    const {bucket,index,image}=await imageFixture();
    if(mode==='archive')image.original.archiveId='cloud-unknown';
    if(mode==='path')image.original.path='../hero.png';
    if(mode==='mime')image.original.mime='image/svg+xml';
    if(mode==='size')image.original.size++;
    if(mode==='original-sha'){index.images['f'.repeat(64)]=image;delete index.images[index.pages[0].imageHash];}
    if(mode==='page-sha')index.pages[0].imageHash='f'.repeat(64);
    if(mode==='page-mime')index.pages[0].mime='image/jpeg';
    if(mode==='html-sha')index.pages[0].kind='html';
    await assert.rejects(validateCatalogue(index,bucket),/image.*reference|image.*resource|image hash linkage|page MIME linkage/i,mode);
  }
});

test('rendition validation bounds dimensions, placeholders and optional animation metadata',async()=>{
  for(const [key,value]of [['width',0],['height',65537],['width',1.5],['animated','true'],['placeholder','data:image/png;base64,AAAA'],['placeholder','data:image/webp;base64,'+'A'.repeat(1024)],['placeholder','data:image/webp;base64,'],['placeholder','data:image/webp;base64,AAA!']] as const){
    const {bucket,index,image}=await imageFixture();image[key]=value;
    await assert.rejects(validateCatalogue(index,bucket),/image (dimensions|placeholder)|animated/,`${key}:${String(value).slice(0,40)}`);
  }
});

test('rendition closed graph rejects missing, unreferenced, oversized and wrong-MIME assets',async()=>{
  for(const mode of ['missing','unreferenced','mime','too-big','zero','wrong-sha','variant-size','orphan-size','slice-missing','slice-overflow','slice-fraction','slice-empty','slice-sum','unlisted-object','null-assets','array-assets','null-images']){
    const {bucket,index,image,asset,hash}=await imageFixture();
    if(mode==='missing')delete index.imageAssets[hash];
    if(mode==='unreferenced'){delete image.thumbnail;delete image.thumbnailBytes;delete image.preview;delete image.previewBytes;}
    if(mode==='mime')asset.mime='text/html';
    if(mode==='too-big'){asset.size=4*1024*1024+1;image.thumbnailBytes=asset.size;image.previewBytes=asset.size;}
    if(mode==='zero'){asset.size=0;image.thumbnailBytes=0;image.previewBytes=0;}
    if(mode==='wrong-sha')asset.sha256='f'.repeat(64);
    if(mode==='variant-size')image.previewBytes++;
    if(mode==='orphan-size')delete image.thumbnail;
    if(mode==='slice-missing')asset.slices[0].hash='f'.repeat(64);
    if(mode==='slice-overflow')asset.slices[0].offset=Number.MAX_SAFE_INTEGER;
    if(mode==='slice-fraction')asset.slices[0].length=0.5;
    if(mode==='slice-empty')asset.slices=[];
    if(mode==='null-assets')index.imageAssets=null;
    if(mode==='array-assets')index.imageAssets=[];
    if(mode==='null-images')index.images=null;
    if(mode==='slice-sum')asset.slices[0].length--;
    if(mode==='unlisted-object')index.objects['f'.repeat(64)]=10;
    await assert.rejects(validateCatalogue(index,bucket),/image (variant|asset|metadata inventory)|unreferenced image|inventory is not closed/i,mode);
  }
});

test('rendition missing verified objects never replaces a prior catalogue',async()=>{
  const {env,bucket,index,asset}=await imageFixture();
  await bucket.put('folio/collection.json',JSON.stringify({generation:'prior'}));
  bucket.values.delete(`folio/objects/${asset.slices[0].hash}`);
  const response=await handleCollection(request('/api/collection/admin/commit','PUT',JSON.stringify(index)),env);
  assert.equal(response.status,400);
  assert.equal(JSON.parse(await(await bucket.get('folio/collection.json'))!.text()).generation,'prior');
});


test('optional source dates reject fractional, zero, negative, unsafe values and unknown provenance',async()=>{
  for(const invalid of [0,-1,1.5,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'2026-10-01'])for(const target of ['archive','page']){
    const {bucket,index}=await fixture();
    (target==='archive'?index.archives[0]:index.pages[0] as any).modifiedAt=invalid;
    await assert.rejects(validateCatalogue(index,bucket),/modified date/,`${target}:${invalid}`);
  }
  const {bucket,index}=await fixture();(index.pages[0] as any).dateSource='guessed';
  await assert.rejects(validateCatalogue(index,bucket),/date source/);
  for(const source of ['file','library','imported']){(index.pages[0] as any).dateSource=source;(index.pages[0] as any).modifiedAt=Date.UTC(2026,9,1);assert.equal((await validateCatalogue(index,bucket)).html,1);}
});


test('optional page MIME must match its actual resource and its HTML/image kind',async()=>{
  for(const mime of ['image/png','application/javascript','application/xhtml+xml']){
    const {bucket,index}=await fixture();(index.pages[0] as any).mime=mime;
    await assert.rejects(validateCatalogue(index,bucket),/MIME linkage/);
  }
  const {bucket,index}=await fixture();(index.pages[0] as any).mime='text/html';assert.equal((await validateCatalogue(index,bucket)).html,1);
});

test('source creation and added metadata use the same finite-date contract as the frontend',async()=>{
  for(const key of ['createdAt','addedAt']){
    for(const invalid of [0,-1,0.5,Number.MAX_SAFE_INTEGER,'2026-10-27']){
      const{bucket,index}=await fixture();(index.pages[0]as any)[key]=invalid;await assert.rejects(validateCatalogue(index,bucket),/source date/);
    }
    const{bucket,index}=await fixture();(index.pages[0]as any)[key]=Date.UTC(2026,9,27);assert.equal((await validateCatalogue(index,bucket)).html,1);
  }
});
