import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganizedTree, filterTree, getAncestorIds, getPageOrder } from '../src/tree';
import type { ArchiveMeta, HtmlPage, ItemOrganization, TreeNode, WorkspaceFolder } from '../src/types';

const pages = new Map<string, HtmlPage>([
  ['root-page', { id: 'root-page', archiveId: 'outer', rootId: 'outer', path: 'index.html', label: 'Collection', isIndex: true, size: 1 }],
  ['nested-page', { id: 'nested-page', archiveId: 'inner', rootId: 'outer', path: 'index.html', label: 'Preview', isIndex: true, size: 1 }],
  ['detail-page', { id: 'detail-page', archiveId: 'inner', rootId: 'outer', path: 'detail/feature.html', label: 'feature.html', isIndex: false, size: 1 }],
  ['other-page', { id: 'other-page', archiveId: 'other', rootId: 'other', path: 'index.html', label: 'Other', isIndex: true, size: 1 }],
]);
const leaf = (id: string): TreeNode => {
  const page = pages.get(id)!;
  return { id, pageId: id, archiveId: page.archiveId, label: page.label, kind: 'page', children: [], pageCount: 1 };
};
const tree: TreeNode[] = [
  { id: 'outer', archiveId: 'outer', label: 'Collection of banners.zip', kind: 'archive', pageCount: 3, children: [
    leaf('root-page'),
    { id: 'folder', archiveId: 'outer', label: 'Campaign exports', kind: 'folder', pageCount: 2, children: [
      { id: 'inner', archiveId: 'inner', label: 'Preview.zip', kind: 'archive', pageCount: 2, children: [leaf('nested-page'), leaf('detail-page')] },
    ] },
  ] },
  { id: 'other', archiveId: 'other', label: 'Unrelated.zip', kind: 'archive', pageCount: 1, children: [leaf('other-page')] },
];

test('searching an outer ZIP includes pages inside nested ZIPs in the shared navigation order', () => {
  assert.deepEqual(getPageOrder(filterTree(tree, '  COLLECTION OF BANNERS  ', pages)), ['root-page', 'nested-page', 'detail-page']);
});

test('searching a folder includes its nested ZIP descendants and excludes unrelated siblings', () => {
  const result = filterTree(tree, 'campaign', pages);
  assert.deepEqual(getPageOrder(result), ['nested-page', 'detail-page']);
  assert.equal(result[0].pageCount, 2);
});

test('path search retains ancestors and canonical IDs without mutating the original tree', () => {
  const result = filterTree(tree, 'detail/feature', pages);
  assert.deepEqual(getPageOrder(result), ['detail-page']);
  assert.equal(result[0].id, 'outer');
  assert.equal(result[0].children[0].id, 'folder');
  assert.equal(result[0].pageCount, 1);
  assert.deepEqual(getPageOrder(tree), ['root-page', 'nested-page', 'detail-page', 'other-page']);
  assert.equal(tree[0].pageCount, 3);
});

test('blank search preserves the tree and no matching page produces an empty projection', () => {
  assert.equal(filterTree(tree, '  ', pages), tree);
  assert.deepEqual(filterTree(tree, 'missing campaign xyz', pages), []);
});

const archives: ArchiveMeta[] = [
  { id: 'outer', rootId: 'outer', parentId: null, mountPath: '', name: 'Collection of banners.zip', createdAt: 1, fileCount: 3, pageCount: 3, imageCount: 2, byteSize: 3, warnings: [] },
  { id: 'inner', rootId: 'outer', parentId: 'outer', mountPath: 'Campaign exports/Preview.zip', name: 'Preview.zip', createdAt: 1, fileCount: 3, pageCount: 2, imageCount: 1, byteSize: 3, warnings: [] },
  { id: 'other', rootId: 'other', parentId: null, mountPath: '', name: 'Unrelated.zip', createdAt: 2, fileCount: 1, pageCount: 1, byteSize: 1, warnings: [] },
];
const images: HtmlPage[] = [
  { id: 'outer/assets/hero.png', archiveId: 'outer', rootId: 'outer', path: 'assets/hero.png', label: 'hero.png', isIndex: false, size: 2, kind: 'image' },
  { id: 'inner/icon.svg', archiveId: 'inner', rootId: 'outer', path: 'icon.svg', label: 'icon.svg', isIndex: false, size: 1, kind: 'image' },
];
const items = [...pages.values(), ...images];
const folders: WorkspaceFolder[] = [{ id: 'favorites-folder', name: 'Selected designs', createdAt: 1 }, { id: 'empty-folder', name: 'Later', createdAt: 2 }];
const organization = new Map<string, ItemOrganization>([
  ['nested-page', { id: 'nested-page', favorite: true, folderId: 'favorites-folder' }],
  ['outer/assets/hero.png', { id: 'outer/assets/hero.png', favorite: true, folderId: 'favorites-folder' }],
  ['other-page', { id: 'other-page', favorite: true, folderId: null }],
]);

test('organized kind tabs separate legacy HTML from images and retain empty user folders', () => {
  const html = buildOrganizedTree(archives, items, folders, organization, 'html');
  const image = buildOrganizedTree(archives, items, folders, organization, 'image');
  assert.deepEqual(new Set(getPageOrder(html)), new Set(['root-page', 'nested-page', 'detail-page', 'other-page']));
  assert.deepEqual(new Set(getPageOrder(image)), new Set(images.map(item => item.id)));
  assert.equal(html.find(node => node.id === 'empty-folder')?.pageCount, 0);
  assert.equal(image.find(node => node.id === 'empty-folder')?.kind, 'collection');
  assert.ok(!image.some(node => node.id === 'other'), 'HTML-only imports do not leave empty roots in Images');
});

test('moving an item changes only its tree membership and preserves source identity and resource paths', () => {
  const before = JSON.stringify({ archives, items });
  const organized = buildOrganizedTree(archives, items, folders, organization, 'html');
  assert.equal(getPageOrder(organized).filter(id => id === 'nested-page').length, 1);
  assert.deepEqual(getAncestorIds(organized, 'nested-page'), ['favorites-folder']);
  assert.ok(getAncestorIds(organized, 'detail-page').includes('inner'));
  const moved = organized[0].children.find(node => node.pageId === 'nested-page')!;
  assert.equal(moved.archiveId, 'inner');
  assert.equal(pages.get(moved.pageId!)?.path, 'index.html');
  assert.equal(JSON.stringify({ archives, items }), before);
});

test('favorites and search use the same organized projection for navigation and galleries', () => {
  const favoriteHtml = buildOrganizedTree(archives, items, folders, organization, 'html', true);
  assert.deepEqual(getPageOrder(favoriteHtml), ['nested-page', 'other-page']);
  const favoriteImage = buildOrganizedTree(archives, items, folders, organization, 'image', true);
  assert.deepEqual(getPageOrder(favoriteImage), ['outer/assets/hero.png']);
  const itemMap = new Map(items.map(item => [item.id, item]));
  assert.deepEqual(getPageOrder(filterTree(favoriteHtml, 'Selected designs', itemMap)), ['nested-page']);
  assert.deepEqual(getPageOrder(filterTree(favoriteImage, 'Selected designs', itemMap)), ['outer/assets/hero.png']);
});

test('returning a moved item to its archive restores the original hierarchy without duplicating IDs', () => {
  const returned = new Map(organization);
  returned.set('nested-page', { id: 'nested-page', favorite: true, folderId: null });
  const result = buildOrganizedTree(archives, items, folders, returned, 'html');
  assert.deepEqual(getAncestorIds(result, 'nested-page'), ['outer', 'outer::folder::Campaign exports', 'inner']);
  assert.equal(new Set(getPageOrder(result)).size, pages.size);
  assert.equal(result[0].pageCount, 0);
});
