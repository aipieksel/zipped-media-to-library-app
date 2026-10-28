import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArchive } from '../src/archive';

const [inputPath, output] = process.argv.slice(2);
if (!inputPath || !output) throw new Error('Pass verified collection-input.json and an output directory.');
const input = JSON.parse(await readFile(inputPath, 'utf8'));
if (input.errors.length || input.count !== 157) throw new Error('Source reconciliation is incomplete.');
await mkdir(path.join(output, 'objects'), { recursive: true });
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const SHARD_SIZE = 16 * 1024 * 1024;
type Slice = { shard: number; offset: number; length: number };
type Descriptor = { id: string; archiveId: string; path: string; mime: string; size: number; sha256: string; slices: Slice[] };
const objects: Record<string, number> = {};
const shardHashes: string[] = [];
const resourcePool = new Map<string, { size: number; slices: Slice[] }>();
const groups: { archives: Record<string, { archiveId: string; files: Descriptor[] }> }[] = [];
const archives: any[] = [], pages: any[] = [], packages: any[] = [];
const categories = new Map<string, any>();
let parts: Buffer[] = [], shardBytes = 0, resourceBytes = 0;
async function saveObject(bytes: Buffer) {
  const hash = digest(bytes);
  if (!objects[hash]) { await writeFile(path.join(output, 'objects', hash), bytes); objects[hash] = bytes.length; }
  return hash;
}
async function flush() {
  if (!shardBytes) return;
  const hash = await saveObject(Buffer.concat(parts, shardBytes));
  shardHashes.push(hash); parts = []; shardBytes = 0;
}
async function pack(bytes: Buffer): Promise<Slice[]> {
  const slices: Slice[] = [];
  for (let at = 0; at < bytes.length;) {
    const count = Math.min(SHARD_SIZE - shardBytes, bytes.length - at);
    slices.push({ shard: shardHashes.length, offset: shardBytes, length: count });
    // Copy this span; do not retain the backing buffer of a large source file.
    parts.push(Buffer.from(bytes.subarray(at, at + count)));
    shardBytes += count; at += count;
    if (shardBytes === SHARD_SIZE) await flush();
  }
  return slices;
}

for (const entry of input.packages) {
  const bytes = await readFile(entry.source_path);
  if (bytes.length !== Number(entry.compressed_bytes) || digest(bytes) !== entry.sha256) throw new Error(`Source changed: ${entry.filename}`);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const bundle = await parseArchive(buffer, entry.filename);
  const html = bundle.pages.filter(item => item.kind !== 'image').length;
  const images = bundle.pages.length - html;
  if (html !== Number(entry.expected_html) || images !== Number(entry.expected_images)) throw new Error(`Parser totals changed: ${entry.filename}: ${html}/${images}`);
  let category = categories.get(entry.category);
  if (!category) {
    const id = `cloud-category-${entry.category.slice(0, 2)}`;
    category = { id, rootId: id, parentId: null, mountPath: '', name: entry.category, createdAt: Date.UTC(2026, 9, 26) + categories.size, fileCount: 0, pageCount: 0, imageCount: 0, byteSize: 0, warnings: [] };
    categories.set(entry.category, category); archives.push(category);
  }
  const ids = new Map(bundle.archives.map((archive, at) => [archive.id, `cloud-${entry.sha256.slice(0, 20)}-${entry.order}-${at}`]));
  const group: typeof groups[number] = { archives: {} };
  for (const archive of bundle.archives) {
    const id = ids.get(archive.id)!;
    archives.push({ ...archive, id, rootId: category.id, parentId: archive.parentId ? ids.get(archive.parentId)! : category.id, createdAt: Date.UTC(2026, 9, 26) + Number(entry.order) * 1000 });
    group.archives[id] = { archiveId: id, files: [] };
  }
  const root = bundle.archives.find(archive => archive.parentId === null)!;
  category.fileCount += root.fileCount; category.pageCount += root.pageCount; category.imageCount += root.imageCount ?? 0; category.byteSize += root.byteSize;
  for (const item of bundle.pages) {
    const archiveId = ids.get(item.archiveId)!;
    pages.push({ ...item, id: `${archiveId}/${item.path}`, archiveId, rootId: category.id });
  }
  for (const file of bundle.files) {
    const content = Buffer.from(await file.blob.arrayBuffer());
    const sha256 = digest(content);
    let pooled = resourcePool.get(sha256);
    if (!pooled) { pooled = { size: content.length, slices: await pack(content) }; resourcePool.set(sha256, pooled); resourceBytes += content.length; }
    if (pooled.size !== content.length) throw new Error('Content hash collision.');
    const archiveId = ids.get(file.archiveId)!;
    group.archives[archiveId].files.push({ id: `${archiveId}/${file.path}`, archiveId, path: file.path, mime: file.mime, size: content.length, sha256, slices: pooled.slices });
  }
  groups.push(group);
  packages.push({ order: Number(entry.order), category: entry.category, kind: entry.kind, filename: entry.filename, sha256: entry.sha256, compressedBytes: bytes.length, html, images });
  console.log(`Prepared ${packages.length}/157 · ${entry.filename} · ${html} HTML, ${images} images`);
  (globalThis as any).gc?.();
}
await flush();
const manifests: Record<string, string> = {};
let resources = 0;
for (const group of groups) {
  const finalGroup: any = { schema: 1, archives: {} };
  for (const [id, manifest] of Object.entries(group.archives)) {
    const files = manifest.files.map(file => ({ ...file, slices: file.slices.map(slice => ({ hash: shardHashes[slice.shard], offset: slice.offset, length: slice.length })) }));
    for (const file of files) if (file.slices.reduce((sum, slice) => sum + slice.length, 0) !== file.size) throw new Error('Resource packing lost bytes.');
    resources += files.length;
    finalGroup.archives[id] = { archiveId: id, files };
  }
  const hash = await saveObject(Buffer.from(JSON.stringify(finalGroup)));
  for (const id of Object.keys(finalGroup.archives)) manifests[id] = hash;
}
for (const category of categories.values()) {
  const hash = await saveObject(Buffer.from(JSON.stringify({ schema: 1, archives: { [category.id]: { archiveId: category.id, files: [] } } })));
  manifests[category.id] = hash;
}
const stats = { packages: packages.length, html: pages.filter(page => page.kind !== 'image').length, images: pages.filter(page => page.kind === 'image').length, resources, uniqueResources: resourcePool.size, uniqueResourceBytes: resourceBytes, shards: shardHashes.length, archiveBytes: input.compressedBytes };
const generation = digest(JSON.stringify({ packages, manifests, stats }));
const index = { schema: 1, generation, createdAt: Date.now(), title: 'Virtarix Banner Collection', archives, pages, manifests, objects, packages, stats };
await writeFile(path.join(output, 'catalogue.json'), JSON.stringify(index));
await writeFile(path.join(output, 'preparation-report.json'), JSON.stringify({ generation, stats, objects: Object.keys(objects).length, maximumObjectBytes: Math.max(...Object.values(objects)), sourceErrors: input.errors }, null, 2));
console.log(JSON.stringify({ generation, stats, objects: Object.keys(objects).length, output }));
