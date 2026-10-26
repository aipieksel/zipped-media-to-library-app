import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { parseArchive, normaliseArchivePath, importImages, isSupportedImagePath } from '../src/archive';
import { buildTree, getAncestorIds, getPageOrder } from '../src/tree';
import type { ImportBundle, TreeNode } from '../src/types';

async function zipOf(files: Record<string, string | Uint8Array>, compression: 'STORE' | 'DEFLATE' = 'DEFLATE'): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents, { createFolders: false });
  return zip.generateAsync({ type: 'arraybuffer', compression });
}

function flatten(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap(node => [node, ...flatten(node.children)]);
}

function centralOffset(bytes: ArrayBuffer): number {
  const view = new DataView(bytes);
  return view.getUint32(bytes.byteLength - 22 + 16, true);
}

test('recursive import keeps root HTML, ZIP hierarchy, index labels and every supporting resource', async () => {
  const inner = await zipOf({ 'site-a/index.html': '<h1>A</h1>', 'site-a/assets/theme.css': 'body{color:red}', 'site-a/readme.txt': 'notes', 'site-b/index.htm': '<h1>B</h1>' });
  const empty = await zipOf({ 'readme.md': 'No page here' });
  const outer = await zipOf({ 'index.html': '<h1>Root</h1>', 'about.html': '<h1>About</h1>', 'bundles/inner.zip': new Uint8Array(inner), 'bundles/empty.zip': new Uint8Array(empty), '__MACOSX/._index.html': 'metadata', '.DS_Store': 'metadata' });
  const bundle = await parseArchive(outer, 'Collection.zip');
  assert.equal(bundle.archives.length, 3);
  assert.equal(bundle.pages.length, 4);
  assert.equal(bundle.archives[0].pageCount, 4);
  assert.equal(bundle.files.length, 9);
  assert.ok(bundle.files.some(file => file.path.endsWith('theme.css')));
  assert.ok(!bundle.files.some(file => file.path.includes('__MACOSX') || file.path === '.DS_Store'));
  assert.ok(bundle.archives.every(archive => archive.rootId === bundle.archives[0].id));
  const innerMeta = bundle.archives.find(archive => archive.name === 'inner.zip')!;
  assert.equal(innerMeta.mountPath, 'bundles/inner.zip');
  assert.equal(innerMeta.parentId, bundle.archives[0].id);
  const tree = buildTree(bundle.archives, bundle.pages.filter(page => page.kind !== 'image'));
  const all = flatten(tree);
  assert.equal(tree[0].label, 'Collection.zip');
  assert.equal(tree[0].pageCount, 4);
  assert.equal(tree[0].children[0].label, 'Collection');
  assert.equal(tree[0].children[0].kind, 'page');
  assert.ok(all.some(node => node.label === 'site-a' && node.kind === 'page'));
  assert.ok(all.some(node => node.label === 'empty.zip' && node.kind === 'archive' && node.pageCount === 0));
  assert.ok(!all.some(node => /assets|theme\.css|readme/.test(node.label)));
  const nestedPage = bundle.pages.find(page => page.path === 'site-a/index.html')!;
  assert.deepEqual(getAncestorIds(tree, nestedPage.id), [bundle.archives[0].id, `${bundle.archives[0].id}::folder::bundles`, innerMeta.id]);
  assert.equal(new Set(getPageOrder(tree)).size, bundle.pages.length);
  assert.ok(bundle.pages.every(page => bundle.files.find(file => file.id === page.id)?.path === page.path));
});

test('index-first ordering retains multiple HTML files and only collapses the actual index folder', async () => {
  const input = await zipOf({ 'index.html': 'root', 'site/index.html': 'index', 'site/a10.html': '10', 'site/a2.html': '2', 'wrapper/leaf/index.html': 'leaf', 'assets/logo.svg': '<svg/>' });
  const bundle = await parseArchive(input, 'pages.zip');
  const tree = buildTree(bundle.archives, bundle.pages.filter(page => page.kind !== 'image'));
  const all = flatten(tree);
  const site = all.find(node => node.kind === 'folder' && node.label === 'site')!;
  assert.deepEqual(site.children.map(node => node.label), ['site', 'a2.html', 'a10.html']);
  const wrapper = all.find(node => node.label === 'wrapper')!;
  assert.equal(wrapper.kind, 'folder');
  assert.deepEqual(wrapper.children.map(node => [node.label, node.kind]), [['leaf', 'page']]);
  assert.deepEqual(getPageOrder(tree).map(id => bundle.pages.find(page => page.id === id)!.path), ['index.html', 'site/index.html', 'site/a2.html', 'site/a10.html', 'wrapper/leaf/index.html']);
});

test('same-named archives have disjoint stable IDs and retain UTF-8 paths and Blob content', async () => {
  const input = await zipOf({ 'café pages/über.html': 'Unicode works', 'café pages/a.js': 'console.log("ok")' });
  const [a, b] = await Promise.all([parseArchive(input, 'same.zip'), parseArchive(input, 'same.zip')]);
  assert.notEqual(a.archives[0].id, b.archives[0].id);
  assert.notEqual(a.pages[0].id, b.pages[0].id);
  assert.equal(a.pages[0].path, 'café pages/über.html');
  assert.equal(await a.files.find(file => file.path.endsWith('.html'))!.blob.text(), 'Unicode works');
  assert.equal(a.files.find(file => file.path.endsWith('.js'))!.mime, 'text/javascript');
});

test('empty and asset-only archives are explicit rather than inventing a page', async () => {
  const cases: Array<Record<string, string>> = [{}, { 'assets/style.css': 'body{}' }];
  for (const files of cases) {
    const bundle = await parseArchive(await zipOf(files), 'empty.zip');
    assert.equal(bundle.pages.length, 0);
    assert.equal(bundle.archives.length, 1);
    assert.match(bundle.archives[0].warnings.join(' '), /No HTML/);
    assert.deepEqual(getPageOrder(buildTree(bundle.archives, bundle.pages)), []);
  }
});

test('unsafe member names are rejected before ZIP library normalisation', async () => {
  const names = ['../outside.html', 'safe/../../outside.html', '/absolute.html', 'C:\\drive.html', 'C:relative.html', '\\server\\file.html', 'safe\0evil.html'];
  for (const path of names) {
    await assert.rejects(parseArchive(await zipOf({ [path]: '<h1>bad</h1>' }), 'unsafe.zip'), /traversal|Absolute|NUL/);
  }
  assert.equal(normaliseArchivePath('a\\b//./c.html'), 'a/b/c.html');
});

test('duplicate canonical paths are rejected instead of silently overwriting', async () => {
  await assert.rejects(parseArchive(await zipOf({ 'a/b.html': 'first', 'a\\b.html': 'second' }), 'duplicates.zip'), /Duplicate archive path/);
  await assert.rejects(parseArchive(await zipOf({ 'a/b.html': 'first', 'a/./b.html': 'second' }), 'duplicates.zip'), /Duplicate archive path/);
});

test('compressed, expanded, entry-count, entry-size and nesting limits fail atomically', async () => {
  const input = await zipOf({ 'index.html': 'x'.repeat(100), 'about.html': 'y'.repeat(100) });
  await assert.rejects(parseArchive(input, 'limit.zip', undefined, { maxCompressedBytes: 20 }), /compressed-size/);
  await assert.rejects(parseArchive(input, 'limit.zip', undefined, { maxExpandedBytes: 150 }), /expanded-size/);
  await assert.rejects(parseArchive(input, 'limit.zip', undefined, { maxEntryBytes: 50 }), /per-file/);
  await assert.rejects(parseArchive(input, 'limit.zip', undefined, { maxFiles: 1 }), /archive-entry/);
  const outer = await zipOf({ 'first.html': 'valid first page', 'inner.zip': new Uint8Array(input) });
  await assert.rejects(parseArchive(outer, 'limit.zip', undefined, { maxDepth: 0 }), /Nested ZIP depth/);
  await assert.rejects(parseArchive(outer, 'limit.zip', undefined, { maxFiles: 3 }), /archive-entry/);
});

test('truncated and malformed nested ZIPs reject the whole import', async () => {
  await assert.rejects(parseArchive(new ArrayBuffer(0), 'not-a-zip.zip'), /not a complete ZIP/);
  const valid = await zipOf({ 'index.html': 'Hello' });
  await assert.rejects(parseArchive(valid.slice(0, valid.byteLength - 5), 'truncated.zip'), /truncated|directory/);
  const nested = await zipOf({ 'index.html': 'valid', 'bad.zip': new Uint8Array([1, 2, 3, 4]) });
  await assert.rejects(parseArchive(nested, 'nested.zip'), /bad\.zip.*not a complete ZIP/);
});

test('actual inflation is checked against forged declared sizes, and corrupt contents fail CRC', async () => {
  const forged = await zipOf({ 'index.html': 'x'.repeat(60_000) });
  const forgedView = new DataView(forged);
  const central = centralOffset(forged);
  forgedView.setUint32(22, 1, true);
  forgedView.setUint32(central + 24, 1, true);
  await assert.rejects(parseArchive(forged, 'forged.zip'), /Inflation limit|declared-size|size mismatch/);

  const corrupt = await zipOf({ 'index.html': 'checksum test' }, 'STORE');
  const corruptView = new DataView(corrupt);
  const dataStart = 30 + corruptView.getUint16(26, true) + corruptView.getUint16(28, true);
  corruptView.setUint8(dataStart, corruptView.getUint8(dataStart) ^ 0xff);
  await assert.rejects(parseArchive(corrupt, 'corrupt.zip'), /checksum mismatch/);
});

test('encrypted and conflicting local-name headers are rejected', async () => {
  const encrypted = await zipOf({ 'index.html': 'one' });
  const encryptedView = new DataView(encrypted);
  encryptedView.setUint16(6, 1, true);
  encryptedView.setUint16(centralOffset(encrypted) + 8, 1, true);
  await assert.rejects(parseArchive(encrypted, 'encrypted.zip'), /Password-protected/);
  const mismatch = await zipOf({ 'index.html': 'one' });
  new DataView(mismatch).setUint8(30, 'x'.charCodeAt(0));
  await assert.rejects(parseArchive(mismatch, 'conflicting.zip'), /Conflicting filenames/);
});

const realFixture = new URL('../../fixtures/nested-real-library-fixture.zip', import.meta.url);
test('real Library wrapper reconciles 12 pages with its two unchanged source ZIPs', { skip: !existsSync(realFixture) }, async () => {
  const bytes = await readFile(realFixture);
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const bundle: ImportBundle = await parseArchive(input, 'nested-real-library-fixture.zip');
  assert.equal(bundle.archives.length, 3);
  const htmlPages = bundle.pages.filter(page => page.kind !== 'image');
  const images = bundle.pages.filter(page => page.kind === 'image');
  assert.equal(htmlPages.length, 12);
  assert.equal(images.length, 102);
  assert.equal(bundle.archives[0].imageCount, 102);
  assert.equal(bundle.files.filter(file => file.mime === 'text/html').length, 12);
  assert.ok(bundle.files.some(file => file.path.endsWith('css/patterns.css')));
  assert.ok(bundle.files.some(file => file.path.endsWith('dist/browser.js')));
  assert.ok(bundle.files.some(file => file.path.endsWith('assets/storage-vps-s-product.png')));
  const tree = buildTree(bundle.archives, htmlPages);
  assert.equal(tree[0].pageCount, 12);
  assert.equal(getPageOrder(tree).length, 12);
  assert.ok(flatten(tree).every(node => node.kind !== 'page' || Boolean(bundle.pages.find(page => page.id === node.pageId))));
});

test('nested image ZIPs expose only supported image metadata and keep all supporting bytes', async () => {
  const inner = await zipOf({ 'pictures/Hero.PNG': new Uint8Array([137, 80, 78, 71]), 'pictures/icon.svg': '<svg/>', 'pictures/raw.heic': 'unsupported bytes', 'pictures/styles.css': 'body{}' });
  const input = await zipOf({ 'index.html': '<img src="cover.jpg">', 'cover.jpg': new Uint8Array([255, 216, 255]), 'nested/images.zip': new Uint8Array(inner) });
  const bundle = await parseArchive(input, 'Mixed collection.zip');
  assert.equal(bundle.pages.filter(item => item.kind !== 'image').length, 1);
  assert.equal(bundle.pages.filter(item => item.kind === 'image').length, 3);
  assert.equal(bundle.archives[0].pageCount, 1);
  assert.equal(bundle.archives[0].imageCount, 3);
  assert.equal(bundle.archives[1].pageCount, 0);
  assert.equal(bundle.archives[1].imageCount, 2);
  assert.equal(bundle.archives[1].warnings.length, 0);
  assert.ok(bundle.files.some(file => file.path === 'pictures/raw.heic'));
  assert.ok(!bundle.pages.some(item => item.path.endsWith('.heic') || item.path.endsWith('.css')));
  assert.ok(bundle.pages.every(item => item.id === `${item.archiveId}/${item.path}` && bundle.files.some(file => file.id === item.id)));
  for (const suffix of ['png', 'JPG', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico']) assert.equal(isSupportedImagePath(`folder/image.${suffix}`), true);
  for (const suffix of ['html', 'svg.js', 'heic', 'tiff', 'pdf']) assert.equal(isSupportedImagePath(`image.${suffix}`), false);
});

test('direct image imports preserve original bytes and use one disjoint named archive', async () => {
  const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'Hero.PNG', { type: 'application/octet-stream' });
  const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg', { type: 'text/html' });
  const bundle = await importImages([png, svg], 'Artwork');
  const second = await importImages([png], 'Artwork');
  assert.equal(bundle.archives.length, 1);
  assert.equal(bundle.archives[0].name, 'Artwork');
  assert.equal(bundle.archives[0].imageCount, 2);
  assert.equal(bundle.archives[0].pageCount, 0);
  assert.equal(bundle.pages.length, 2);
  assert.ok(bundle.pages.every(item => item.kind === 'image' && !item.isIndex && item.rootId === bundle.archives[0].id));
  assert.equal(bundle.files[0].mime, 'image/png');
  assert.equal(bundle.files[1].blob.type, 'image/svg+xml');
  assert.deepEqual(await bundle.files[0].blob.arrayBuffer(), await png.arrayBuffer());
  assert.equal(await bundle.files[1].blob.text(), await svg.text());
  assert.notEqual(bundle.pages[0].id, second.pages[0].id);
});

test('invalid direct-image batches reject empty, unsupported, duplicate, unsafe and excessive files', async () => {
  const image = new File(['pixels'], 'image.png');
  await assert.rejects(importImages([]), /at least one/);
  await assert.rejects(importImages([new File([], 'empty.png')]), /empty/);
  await assert.rejects(importImages([new File(['a'], 'page.html', { type: 'image/png' })]), /Unsupported image/);
  await assert.rejects(importImages([image, image]), /Duplicate image/);
  await assert.rejects(importImages([new File(['a'], '../outside.png')]), /traversal/);
  await assert.rejects(importImages([image], 'Artwork', { maxEntryBytes: 2 }), /per-file/);
  await assert.rejects(importImages([image], 'Artwork', { maxExpandedBytes: 2 }), /total-size/);
  await assert.rejects(importImages([image, new File(['x'], 'other.png')], 'Artwork', { maxFiles: 1 }), /file limit/);
});
