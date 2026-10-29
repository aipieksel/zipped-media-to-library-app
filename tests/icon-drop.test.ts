import test from 'node:test';
import assert from 'node:assert/strict';
import {captureIconDrop, iconEntriesFromFiles, IconDropLimitError, normalizeIconPath, readIconDrop} from '../src/icon-drop';
import type {IconDropEntry} from '../src/icon-drop';
import {prepareIconImport} from '../src/icon-collection';

const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, {type: /\.png$/i.test(name) ? 'image/png' : 'text/plain'});
const fileEntry = (name: string, value = file(name)): IconDropEntry => ({name, isFile: true, isDirectory: false, file(success) {queueMicrotask(() => success(value));}});
function directory(name: string, batches: IconDropEntry[][]): IconDropEntry & {reads: number} {
  const entry = {name, isFile: false, isDirectory: true, reads: 0, createReader() {
    let cursor = 0;
    return {readEntries(success: (values: IconDropEntry[]) => void) {entry.reads++; queueMicrotask(() => success(batches[cursor++] ?? []));}};
  }};
  return entry;
}

test('relative icon paths preserve literal Unicode identity and normalize separators while rejecting unsafe paths', () => {
  assert.equal(normalizeIconPath('Set\\Cafe\u0301\\icon.png'), 'Set/Cafe\u0301/icon.png');
  assert.equal(normalizeIconPath('Set/%2e%2e/%2F.png'), 'Set/%2e%2e/%2F.png');
  for (const path of ['', '/root.png', 'C:\\root.png', '../x.png', 'a/../x.png', 'a/./x.png', 'a//x.png', 'a\0.png']) assert.throws(() => normalizeIconPath(path));
  assert.throws(() => normalizeIconPath(Array(33).fill('folder').join('/')), IconDropLimitError);
});

test('canonically equivalent Unicode sibling folders retain distinct source identities before safe display allocation', async () => {
  const composed = directory('Café', [[fileEntry('same.png')]]);
  const decomposed = directory('Cafe\u0301', [[fileEntry('same.png')]]);
  const root = directory('Pack', [[composed, decomposed]]);
  const batch = prepareIconImport(await readIconDrop({entries: [{entry: root, rootKey: 'root'}], files: [], notices: []}));
  assert.deepEqual(batch.directories.map(entry => entry.relativePath), ['Pack', 'Pack/Café', 'Pack/Cafe\u0301']);
  assert.equal(new Set(batch.files.map(entry => entry.relativePath)).size, 2);
  assert.equal(new Set(batch.files.map(entry => entry.relativePath.normalize('NFC'))).size, 1);
  assert.equal(batch.files[0].rootKey, batch.files[1].rootKey);
});

test('drop captures live entry handles synchronously and never rereads protected DataTransfer during traversal', async () => {
  let available = true;
  let reads = 0;
  const entry = directory('Pack', [[fileEntry('one.png')]]);
  const item = {kind: 'file', webkitGetAsEntry() {assert.equal(available, true); reads++; return entry;}, getAsFile() {throw new Error('Entry path should be used.');}};
  const captured = captureIconDrop({items: [item], files: []} as unknown as DataTransfer);
  available = false;
  const result = await readIconDrop(captured);
  assert.equal(reads, 1); assert.equal(result.files[0].relativePath, 'Pack/one.png');
  assert.equal(result.files[0].rootKey, captured.entries[0].rootKey);
});

test('directory traversal drains more than one batch and retains nested and empty directories', async () => {
  const empty = directory('Empty', [[]]);
  const nested = directory('Nested', [[fileEntry('inside.png')], []]);
  const root = directory('Pack', [[fileEntry('first.png')], [nested, empty], [fileEntry('last.png')], []]);
  const result = await readIconDrop({entries: [{entry: root, rootKey: 'root'}], files: [], notices: []});
  assert.equal(root.reads, 4); assert.equal(nested.reads, 2); assert.equal(empty.reads, 1);
  assert.deepEqual(result.files.map(entry => entry.relativePath), ['Pack/first.png', 'Pack/Nested/inside.png', 'Pack/last.png']);
  assert.deepEqual(result.directories.map(entry => entry.relativePath), ['Pack', 'Pack/Nested', 'Pack/Empty']);
});

test('duplicate dropped root names keep independent identities and loose files have no directory root', async () => {
  const result = await readIconDrop({entries: [{entry: directory('Pack', [[fileEntry('same.png')]]), rootKey: 'one'}, {entry: directory('Pack', [[fileEntry('same.png')]]), rootKey: 'two'}, {entry: fileEntry('loose.png'), rootKey: 'three'}], files: [], notices: []});
  assert.deepEqual(result.files.map(entry => entry.rootKey), ['one', 'two', undefined]);
  assert.equal(result.files[0].relativePath, result.files[1].relativePath);
  assert.equal(prepareIconImport(result).files.length, 3);
});

test('webkitRelativePath picker inputs preserve folders and disclose the empty-directory limitation', () => {
  const values = [file('a.png'), file('b.png'), file('loose.png')];
  Object.defineProperty(values[0], 'webkitRelativePath', {value: 'Pack/Sub/a.png'});
  Object.defineProperty(values[1], 'webkitRelativePath', {value: 'Pack/b.png'});
  const result = iconEntriesFromFiles(values);
  assert.deepEqual(result.files.map(entry => entry.relativePath), ['Pack/Sub/a.png', 'Pack/b.png', 'loose.png']);
  assert.deepEqual(result.directories.map(entry => entry.relativePath), ['Pack', 'Pack/Sub']);
  assert.match(result.notices!.join(' '), /empty folders/);
  assert.equal(result.files[0].rootKey, result.files[1].rootKey);
  assert.equal(result.files[2].rootKey, undefined);
});

test('unreadable members are reported without losing readable siblings', async () => {
  const failed: IconDropEntry = {name: 'denied.png', isFile: true, isDirectory: false, file(_success, failure) {failure!(new DOMException('Access denied', 'NotReadableError'));}};
  const root = directory('Pack', [[failed, fileEntry('okay.png')]]);
  const result = await readIconDrop({entries: [{entry: root, rootKey: 'one'}], files: [], notices: []});
  assert.equal(result.files.length, 1); assert.equal(result.files[0].file.name, 'okay.png');
  assert.equal(result.skipped, 1); assert.match(result.notices!.join(' '), /Access denied/);
});

test('the discovered-entry budget counts non-PNG files instead of traversing an unbounded directory', async () => {
  const root = directory('Huge', [Array.from({length: 5000}, (_, index) => fileEntry(`${index}.txt`))]);
  await assert.rejects(readIconDrop({entries: [{entry: root, rootKey: 'root'}], files: [], notices: []}), /including folders and non-PNG/);
});

test('aborting a pending directory read terminates traversal and repeated entry cycles cannot recurse indefinitely', async () => {
  const controller = new AbortController();
  const waiting: IconDropEntry = {name: 'Waiting', isFile: false, isDirectory: true, createReader: () => ({readEntries() {controller.abort();}})};
  await assert.rejects(readIconDrop({entries: [{entry: waiting, rootKey: 'root'}], files: [], notices: []}, controller.signal), {name: 'AbortError'});
  const loop = directory('Loop', []);
  loop.createReader = () => {let called = false; return {readEntries(success) {success(called ? [] : (called = true, [loop]));}};};
  const result = await readIconDrop({entries: [{entry: loop, rootKey: 'loop'}], files: [], notices: []});
  assert.equal(result.directories.length, 1); assert.equal(result.skipped, 1); assert.match(result.notices!.join(' '), /repeated directory/);
});
