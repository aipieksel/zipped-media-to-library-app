import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateIconName, emptyIconSnapshot, isCurrentIconClaim, normalizeIconPreferences, prepareIconImport, projectIconCollection, UNCATEGORIZED_ICON_FOLDER_ID} from '../src/icon-collection';
import type {IconClaim, IconCollectionSnapshot, IconFolder, IconRecord} from '../src/icon-types';
import {filterTree, getAncestorIds, getPageOrder} from '../src/tree';
import {projectTree} from '../src/order';

const source = (name = 'icon.png', size = 4) => new File([new Uint8Array(size)], name, {type: 'image/png', lastModified: 10});
const folder = (id: string, name: string, parentId: string | null = null, favorite = false): IconFolder => ({id, name, parentId, favorite, createdAt: 100});
const item = (id: string, folderId: string, name = `${id}.png`, favorite = false): IconRecord => ({id, folderId, name, sourceName: name, sourcePath: name, filename: name.replace(/\.png$/, '.svg'), size: 4, lastModified: 10, createdAt: 100, updatedAt: 100, mode: 'pixels', revision: 1, status: 'queued', message: 'Queued', favorite});
const snapshot = (): IconCollectionSnapshot => ({
  ...emptyIconSnapshot(),
  folders: [folder(UNCATEGORIZED_ICON_FOLDER_ID, 'Uncategorized'), folder('root', 'Set'), folder('nested', 'Arrows', 'root'), folder('empty', 'Empty', 'root')],
  items: [item('loose', UNCATEGORIZED_ICON_FOLDER_ID), item('up', 'nested'), item('down', 'nested'), item('other', 'root')],
});

test('icon sibling names preserve extensions and safely resolve case, Unicode, suffix and file/folder collisions', () => {
  const used = new Set(['ICON.png', 'icon (2).png', 'Cafe\u0301', 'Folder']);
  assert.equal(allocateIconName('icon.png', used, true), 'icon (3).png');
  assert.equal(allocateIconName('Café', used), 'Café (2)');
  assert.equal(allocateIconName('folder', used), 'folder (2)');
  assert.equal(allocateIconName('NUL.png', used, true), '_NUL.png');
  assert.equal(allocateIconName('../bad:name?.png ', used, true), '.._bad_name_.png');
  assert.equal(allocateIconName('..', used), 'Folder (3)');
  assert.equal(new Set([...used].map(name => name.normalize('NFC').toLowerCase())).size, used.size);
});

test('import admission bounds each intake without imposing a lifetime collection cap', () => {
  const files = Array.from({length: 105}, (_, index) => ({file: source(`${index}.png`), relativePath: `${index}.png`}));
  const first = prepareIconImport({files, directories: []});
  const second = prepareIconImport({files, directories: []});
  assert.equal(first.files.length, 100); assert.equal(first.skipped, 5);
  assert.equal(second.files.length, 100); assert.equal(second.skipped, 5);
  assert.equal(first.files[0].file, files[0].file);
  // A corrupt/empty PNG is retained for a useful durable conversion failure, not silently discarded.
  assert.equal(prepareIconImport({files: [{file: source('empty.png', 0), relativePath: 'empty.png'}], directories: []}).files.length, 1);
});

test('non-PNGs are reported and per-file byte limits are enforced before persistence', () => {
  const nonPng = new File(['text'], 'readme.txt', {type: 'text/plain'});
  const oversized = source('huge.png');
  Object.defineProperty(oversized, 'size', {value: 20 * 1024 * 1024 + 1});
  const prepared = prepareIconImport({files: [nonPng, oversized, source()].map(file => ({file, relativePath: file.name})), directories: []});
  assert.equal(prepared.files.length, 1); assert.equal(prepared.files[0].file.name, 'icon.png');
  assert.equal(prepared.skipped, 2); assert.equal(prepared.notices.length, 2);
  assert.match(prepared.notices.join('\n'), /Only PNG/); assert.match(prepared.notices.join('\n'), /20 MiB/);
});

test('source-byte admission is cumulative per import and a skipped item does not consume its budget', () => {
  const files = Array.from({length: 6}, (_, index) => {const file = source(`${index}.png`); Object.defineProperty(file, 'size', {value: 20 * 1024 * 1024}); return {file, relativePath: file.name};});
  const result = prepareIconImport({files, directories: []});
  assert.equal(result.files.length, 5); assert.equal(result.skipped, 1);
  assert.match(result.notices[0], /100 MiB/);
});

test('import rejects conflicting roots, rootless hierarchy and unsafe paths rather than overwriting data', () => {
  assert.throws(() => prepareIconImport({directories: [{rootKey: 'same', relativePath: 'One'}, {rootKey: 'same', relativePath: 'Two'}], files: []}), /conflicting root/);
  assert.throws(() => prepareIconImport({directories: [], files: [{file: source(), relativePath: 'set/icon.png'}]}), /root identity/);
  assert.throws(() => prepareIconImport({directories: [], files: [{file: source(), relativePath: '../icon.png'}]}), /cannot contain/);
  assert.throws(() => prepareIconImport({directories: [{rootKey: 'r', relativePath: 'set'}], files: [{file: source(), relativePath: 'icon.png', rootKey: 'r'}]}), /conflicting root|retain its root/);
  assert.throws(() => prepareIconImport({directories: Array.from({length: 5001}, (_, index) => ({rootKey: String(index), relativePath: String(index)})), files: []}), /discovered entries/);
});

test('claim authorization rejects expired, cancelled, removed, retried and foreign-owner results', () => {
  const claim: IconClaim = {id: 'a', revision: 2, owner: 'tab-a', token: 'claim-1', expiresAt: 200};
  const record: IconRecord = {...item('a', 'root'), revision: 2, status: 'processing', claim: {owner: claim.owner, token: claim.token, expiresAt: claim.expiresAt}};
  assert.equal(isCurrentIconClaim(record, claim, 100), true);
  assert.equal(isCurrentIconClaim(record, claim, 200), false);
  assert.equal(isCurrentIconClaim(undefined, claim, 100), false);
  assert.equal(isCurrentIconClaim({...record, status: 'cancelled'}, claim, 100), false);
  assert.equal(isCurrentIconClaim({...record, revision: 3}, claim, 100), false);
  assert.equal(isCurrentIconClaim({...record, claim: {...record.claim!, token: 'replacement'}}, claim, 100), false);
  assert.equal(isCurrentIconClaim({...record, claim: {...record.claim!, owner: 'tab-b'}}, claim, 100), false);
  // The current persisted expiry wins over the original claim object's stale expiry after heartbeat.
  assert.equal(isCurrentIconClaim({...record, claim: {...record.claim!, expiresAt: 300}}, claim, 250), true);
});

test('icon projection preserves actual nested folders and empty Uncategorized while sharing existing navigation helpers', () => {
  const state = snapshot(); const before = JSON.stringify(state);
  const projected = projectIconCollection(state);
  assert.equal(projected.tree[0].id, UNCATEGORIZED_ICON_FOLDER_ID);
  assert.deepEqual(getAncestorIds(projected.tree, 'up'), ['root', 'nested']);
  assert.equal(projected.tree.find(node => node.id === 'root')?.pageCount, 3);
  assert.equal(projected.tree.find(node => node.id === 'root')?.children.find(node => node.id === 'empty')?.pageCount, 0);
  assert.equal(projected.pages.find(page => page.id === 'up')?.path, 'Set/Arrows/up.png');
  assert.equal(projected.folders.find(entry => entry.id === 'nested')?.name, 'Set / Arrows');
  const pageMap = new Map(projected.pages.map(page => [page.id, page]));
  assert.deepEqual(new Set(getPageOrder(filterTree(projected.tree, 'Arrows', pageMap))), new Set(['up', 'down']));
  const sorted = projectTree(projected.tree, pageMap, {group: 'all', sort: 'name-asc'});
  assert.deepEqual(getPageOrder(sorted), ['down', 'loose', 'other', 'up']);
  assert.equal(JSON.stringify(state), before);
});

test('folder favorites include live descendant membership without mutating individual stars', () => {
  const state = snapshot();
  state.folders.find(folder => folder.id === 'root')!.favorite = true;
  state.items.find(item => item.id === 'loose')!.favorite = true;
  const first = projectIconCollection(state, true);
  assert.deepEqual(new Set(getPageOrder(first.tree)), new Set(['up', 'down', 'other', 'loose']));
  assert.equal(first.organization.get('up')?.favorite, false);
  state.items.find(item => item.id === 'down')!.folderId = UNCATEGORIZED_ICON_FOLDER_ID;
  assert.deepEqual(new Set(getPageOrder(projectIconCollection(state, true).tree)), new Set(['up', 'other', 'loose']));
  state.folders.find(folder => folder.id === 'root')!.favorite = false;
  state.folders.find(folder => folder.id === 'empty')!.favorite = true;
  const empty = projectIconCollection(state, true);
  assert.equal(empty.tree.find(node => node.id === 'root')?.children.find(node => node.id === 'empty')?.pageCount, 0);
  assert.deepEqual(getPageOrder(empty.tree), ['loose']);
});

test('empty folders survive projection and normalized preferences preserve explicit native zoom and mode', () => {
  const state = snapshot(); state.items = [];
  const projected = projectIconCollection(state);
  assert.equal(projected.tree.length, 2); assert.equal(projected.pages.length, 0);
  assert.equal(projected.tree.find(node => node.id === 'root')?.children.length, 2);
  const prefs = normalizeIconPreferences({defaultMode: 'embedded', zoom: '4', background: 'dark', selectedId: 'up', expanded: ['root', 'root', 'nested'], order: {sort: 'newest', group: 'month'}});
  assert.equal(prefs.defaultMode, 'embedded'); assert.equal(prefs.zoom, '4'); assert.equal(prefs.background, 'dark');
  assert.deepEqual(prefs.expanded, ['root', 'nested']); assert.equal(prefs.order.group, 'month');
  assert.equal(normalizeIconPreferences().zoom, '1');
  assert.equal(normalizeIconPreferences({zoom: 'invalid' as '1'}).zoom, '1');
});
