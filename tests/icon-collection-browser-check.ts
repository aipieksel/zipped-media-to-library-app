/// <reference types="vite/client" />

/**
 * Independent development-only checks for the durable local icon collection.
 * Loaded only by ignored .qa pages, never by the production entry graph.
 * The parent controls the browser and the actual App iframe interactions.
 */
import JSZip from 'jszip';
import { createCurveReferenceFixture, createPngFixtures } from './png-fixture-generator';
import type { PngFixture } from './png-fixture-generator';
import { openIconCollection, projectIconCollection, ICON_DB_NAME } from '../src/icon-collection';
import { filterTree, getPageOrder } from '../src/tree';
import type { IconCollectionSnapshot, IconImportBatch, IconRecord } from '../src/icon-types';
import { convertPng } from '../src/png-svg-browser';
import type { PngSvgResult } from '../src/png-svg-browser';
import { uniqueId } from '../src/identity';

if (!import.meta.env.DEV) throw new Error('Icon collection checks are available only in the development server.');

interface CheckResult {
  name: string;
  status: 'pass' | 'fail';
  durationMs: number;
  details: unknown;
}

interface BrowserReport {
  scope: string;
  startedAt: string;
  completedAt?: string;
  browser: string;
  devicePixelRatio: number;
  passed: number;
  failed: number;
  checks: CheckResult[];
}

interface QaEntry {
  name: string;
  fullPath: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
  createReader?: () => { readEntries: (success: (entries: QaEntry[]) => void) => void };
}

const fixtures = createPngFixtures();
const root = document.querySelector<HTMLElement>('#qa-root');
if (!root) throw new Error('The generated QA page is missing its root element.');
root.innerHTML = `
  <h1>Folio · durable icon collection development checks</h1>
  <p>Real browser IndexedDB transactions and the actual local application, using only procedural fixtures.
  Storage assertions use uniquely named QA databases and never clear the app's collection.
  Interactive checks append synthetic inputs on this dedicated development origin.</p>
  <nav aria-label="Development checks">
    <a href="/.qa/icon-collection-check.html">Storage and lease checks</a>
    <a href="/.qa/icon-library-check.html">Actual app import and reload</a>
    <a href="/.qa/png-svg-check.html">Native SVG fidelity checks</a>
  </nav>
  <div id="check-content"></div>`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pngFile(fixture: PngFixture, name = `qa-${fixture.name}`): File {
  return new File([fixture.bytes], name, { type: 'image/png', lastModified: 1_700_000_000_000 });
}

function explain(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function waitUntil<T>(read: () => T | undefined | null | false, message: string, timeoutMs = 15_000): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const value = read();
    if (value !== undefined && value !== null && value !== false) return value;
    await new Promise<void>(resolve => window.setTimeout(resolve, 50));
  }
  throw new Error(message);
}

function directoryEntry(name: string, children: QaEntry[], parent = '', observe?: (value: unknown) => void): QaEntry {
  const fullPath = `${parent}/${name}`;
  return {
    name, fullPath, isFile: false, isDirectory: true,
    createReader: () => {
      let offset = 0;
      return {
        readEntries: success => {
          // Multiple batches deliberately exercise the required drain loop.
          const entries = children.slice(offset, offset + 2);
          offset += entries.length;
          observe?.({ directory: fullPath, batchSize: entries.length, exhausted: entries.length === 0 });
          window.setTimeout(() => success(entries), 0);
        },
      };
    },
  };
}

function fileEntry(file: File, parent = ''): QaEntry {
  return {
    name: file.name, fullPath: `${parent}/${file.name}`, isFile: true, isDirectory: false,
    file: success => window.setTimeout(() => success(file), 0),
  };
}

function nestedEntries(observe?: (value: unknown) => void): QaEntry[] {
  const opaque = fixtures.find(fixture => fixture.category === 'opaque')!;
  const antialiased = fixtures.find(fixture => fixture.category === 'antialiased')!;
  const multicolor = fixtures.find(fixture => fixture.category === 'multicolor')!;
  return [directoryEntry('QA Icons', [
    fileEntry(pngFile(opaque, 'mark.png'), '/QA Icons'),
    directoryEntry('Nested', [
      fileEntry(pngFile(multicolor, 'mark.png'), '/QA Icons/Nested'),
      directoryEntry('Deeper', [fileEntry(pngFile(antialiased, 'curved.png'), '/QA Icons/Nested/Deeper')], '/QA Icons/Nested', observe),
    ], '/QA Icons', observe),
    directoryEntry('Empty', [], '/QA Icons', observe),
    fileEntry(new File(['Procedural QA non-PNG.'], 'readme.txt', { type: 'text/plain' }), '/QA Icons'),
  ], '', observe)];
}

interface AbortReceipt {
  database: string;
  store: string;
  method: 'add' | 'put';
  id: string | null;
  status: string | null;
  transactionMode: IDBTransactionMode;
  requestWasQueued: boolean;
}

type IndexedDbRealm = Pick<typeof globalThis, 'IDBObjectStore'>;

/** Abort a real native transaction; never replace the storage API with a fake. */
function armTransactionAbort(
  realm: IndexedDbRealm,
  database: string,
  method: 'add' | 'put',
  matches: (value: unknown) => boolean,
  onAbort?: (receipt: AbortReceipt) => void,
): { restore: () => void; receipts: AbortReceipt[] } {
  const prototype = realm.IDBObjectStore.prototype;
  const original = prototype[method];
  const receipts: AbortReceipt[] = [];
  const restore = () => {
    if (prototype[method] === replacement) prototype[method] = original;
  };
  function replacement(this: IDBObjectStore, value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey> {
    const request = key === undefined ? original.call(this, value) : original.call(this, value, key);
    if (this.transaction.db.name === database && this.name === 'icons' && matches(value)) {
      const row = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
      const receipt: AbortReceipt = {
        database, store: this.name, method,
        id: typeof row.id === 'string' ? row.id : null,
        status: typeof row.status === 'string' ? row.status : null,
        transactionMode: this.transaction.mode,
        requestWasQueued: request.readyState === 'pending',
      };
      restore();
      receipts.push(receipt);
      this.transaction.abort();
      onAbort?.(receipt);
    }
    return request;
  }
  prototype[method] = replacement;
  return { restore, receipts };
}

interface RawDatabaseSnapshot {
  keys: Record<string, IDBValidKey[]>;
  records: Record<string, unknown[]>;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

async function readRawDatabase(name: string): Promise<RawDatabaseSnapshot> {
  const request = indexedDB.open(name);
  request.onupgradeneeded = () => request.transaction?.abort();
  const database = await requestValue(request);
  try {
    const names = Array.from(database.objectStoreNames);
    const transaction = database.transaction(names, 'readonly');
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new DOMException('Read transaction aborted.', 'AbortError'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Read transaction failed.'));
    });
    const entries = await Promise.all(names.map(async store => {
      const objectStore = transaction.objectStore(store);
      const [keys, records] = await Promise.all([requestValue(objectStore.getAllKeys()), requestValue(objectStore.getAll())]);
      return { store, keys, records };
    }));
    await completed;
    return {
      keys: Object.fromEntries(entries.map(entry => [entry.store, entry.keys])),
      records: Object.fromEntries(entries.map(entry => [entry.store, entry.records])),
    };
  } finally { database.close(); }
}

async function rejects(operation: () => Promise<unknown>, message: string): Promise<string> {
  try { await operation(); } catch (error) { return explain(error); }
  throw new Error(message);
}

async function equalBlob(blob: Blob | undefined | null, expected: Blob | Uint8Array, message: string): Promise<void> {
  assert(blob instanceof Blob, `${message}: no Blob was returned.`);
  const actualBytes = new Uint8Array(await blob.arrayBuffer());
  const expectedBytes = expected instanceof Blob ? new Uint8Array(await expected.arrayBuffer()) : expected;
  assert(actualBytes.length === expectedBytes.length && actualBytes.every((byte, index) => byte === expectedBytes[index]), message);
}

function noBlobs(value: unknown): boolean {
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return false;
  if (Array.isArray(value)) return value.every(noBlobs);
  return typeof value !== 'object' || value === null || Object.values(value).every(noBlobs);
}

function newTransfer(entries: QaEntry[], files: File[], realm: Window & typeof globalThis): {transfer: DataTransfer; entryPlaceholders: Map<string, QaEntry>} {
  const localFile = (file: File) => new realm.File([file], file.name, { type: file.type, lastModified: file.lastModified });
  const localEntry = (entry: QaEntry): QaEntry => ({
    name: entry.name, fullPath: entry.fullPath, isFile: entry.isFile, isDirectory: entry.isDirectory,
    ...(entry.file ? { file: (success: (file: File) => void, failure?: (error: DOMException) => void) =>
      entry.file!(file => success(localFile(file)), failure) } : {}),
    ...(entry.createReader ? { createReader: () => {
      const reader = entry.createReader!();
      return { readEntries: (success: (entries: QaEntry[]) => void) => reader.readEntries(children => success(children.map(localEntry))) };
    } } : {}),
  });
  // Files must belong to the actual app's realm: native OS drops would pass its
  // instanceof Blob validation, while parent-window File objects would not.
  const transfer = new realm.DataTransfer();
  const entryPlaceholders = new Map<string, QaEntry>();
  for (const file of files) transfer.items.add(localFile(file));
  for (const sourceEntry of entries) {
    const entry = localEntry(sourceEntry);
    const placeholder = `__folio_qa_entry_${uniqueId()}__`;
    const item = transfer.items.add(new realm.File([], placeholder, { type: 'application/x-folio-qa-entry' }));
    assert(item, 'This browser could not create a synthetic drop item.');
    entryPlaceholders.set(placeholder, entry);
  }
  return {transfer, entryPlaceholders};
}

function activeTab(document: Document): string | null {
  return document.querySelector('.workspace-navigation [role="tab"][aria-selected="true"]')?.textContent?.trim().replace(/\s*\d+$/, '').trim() ?? null;
}

function focusDescription(document: Document): unknown {
  const element = document.activeElement as HTMLElement | null;
  if (!element) return null;
  return {
    tag: element.tagName.toLowerCase(), id: element.id || null, role: element.getAttribute('role'),
    ariaLabel: element.getAttribute('aria-label'), text: element.textContent?.trim().slice(0, 160) ?? '',
    tabIndex: element.tabIndex, disabled: element.hasAttribute('disabled'), connected: element.isConnected,
    visible: element.getClientRects().length > 0, pageId: element.getAttribute('data-page-id'), treeNode: element.getAttribute('data-tree-node'),
    documentHasFocus: document.hasFocus(),
  };
}

async function readLibraryItem(name: string): Promise<unknown | undefined> {
  const request = indexedDB.open('folio-workspace');
  request.onupgradeneeded = () => request.transaction?.abort();
  const database = await requestValue(request);
  try {
    // Metadata only; never hydrate unrelated Library resource Blobs for this check.
    const rows = await requestValue(database.transaction('pages', 'readonly').objectStore('pages').getAll());
    return rows.find((row: {path?: string}) => row.path === name);
  } finally { database.close(); }
}

async function waitForLibraryItem(name: string): Promise<unknown> {
  const deadline = performance.now() + 15_000;
  while (performance.now() < deadline) {
    const item = await readLibraryItem(name);
    if (item) return item;
    await new Promise<void>(resolve => window.setTimeout(resolve, 50));
  }
  throw new Error(`The Library did not save procedural input ${name}.`);
}

/** A bounded, read-only-in-content native transaction delays the real Library writer. */
async function holdLibraryImport(): Promise<{release: () => void; completed: Promise<void>; isHolding: () => boolean}> {
  const request = indexedDB.open('folio-workspace');
  request.onupgradeneeded = () => request.transaction?.abort();
  const database = await requestValue(request);
  const transaction = database.transaction(['archives', 'pages', 'files'], 'readwrite');
  let holding = true;
  let firstRead = true;
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const release = () => { holding = false; window.clearTimeout(timer); };
  const timer = window.setTimeout(release, 4_000);
  const completed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => { release(); database.close(); resolve(); };
    transaction.onabort = () => { release(); database.close(); const error = transaction.error ?? new DOMException('The QA delay transaction was aborted.', 'AbortError'); rejectReady(error); reject(error); };
    transaction.onerror = () => { /* The transaction's abort event owns failure cleanup. */ };
  });
  void completed.catch(() => undefined);
  const keepAlive = () => {
    const read = transaction.objectStore('archives').get('__folio_qa_read_only_keepalive__');
    read.onsuccess = () => {
      if (firstRead) { firstRead = false; resolveReady(); }
      // Queue another native read while this transaction is active. No data is written.
      if (holding) keepAlive();
    };
    read.onerror = () => rejectReady(read.error ?? new Error('The QA delay read failed.'));
  };
  keepAlive();
  try { await ready; } catch (error) { release(); throw error; }
  return {release, completed, isHolding: () => holding};
}

function setupInteractive(content: HTMLElement): void {
  content.innerHTML = `
    <h2>Actual application journey</h2>
    <p class="boundary">This iframe runs the real app. Directory drops use synthetic browser entry objects;
    they exercise the app's drop handling and drained reader batches, not an operating-system drag gesture.
    Reloading affects only this development iframe. These controls do not delete any app database.</p>
    <div class="controls">
      <button id="show-icons">Show Icons</button>
      <button id="show-html">Show HTML</button>
      <button id="show-images">Show Images</button>
      <label>Drop target <select id="drop-target"><option value="canvas">Canvas</option><option value="sidebar">Sidebar</option></select></label>
      <button id="drop-loose">Drop loose PNGs</button>
      <button id="drop-duplicates">Drop duplicate filenames</button>
      <button id="drop-folder">Drop nested + empty folders</button>
      <button id="drop-folder-again">Drop duplicate directory roots</button>
      <button id="drop-uncategorized">Drop folder named Uncategorized</button>
      <button id="drop-invalid">Drop invalid PNG</button>
      <button id="drop-pending">Drop cancellation batch</button>
      <button id="drop-silhouette">Drop 96px analytic silhouette</button>
    </div>
    <div class="controls">
      <button id="drop-library">Drop opaque PNG in current Library tab</button>
      <button id="drop-library-html">Drop HTML ZIP in Images tab</button>
      <button id="delayed-library">Delay Library import, then click Icons</button>
      <button id="observe-download">Arm next app SVG/ZIP download observation</button>
    </div>
    <div class="controls">
      <button id="reload-app">Reload app iframe</button>
      <button id="mobile-width">390px viewport</button>
      <button id="desktop-width">1360px viewport</button>
      <button id="observe-app">Observe app and saved metadata</button>
      <button id="abort-source">Arm next source transaction abort</button>
      <button id="abort-result">Arm next result transaction abort</button>
      <button id="download-observations" disabled>Download observations JSON</button>
    </div>
    <p id="ui-status" class="status" role="status">Opening the development app…</p>
    <div class="frame-wrap"><iframe id="app-frame" title="Real Folio application on the development origin" src="/" width="1360" height="844"></iframe></div>
    <h2>Observed evidence</h2><pre id="observations">No observations recorded.</pre>`;
  const frame = content.querySelector<HTMLIFrameElement>('#app-frame')!;
  const status = content.querySelector<HTMLElement>('#ui-status')!;
  const report = content.querySelector<HTMLElement>('#observations')!;
  const download = content.querySelector<HTMLButtonElement>('#download-observations')!;
  const observations: unknown[] = [];
  let busy = false;
  let restoreAbort: (() => void) | undefined;
  let restoreDownload: (() => void) | undefined;
  let releaseLibraryDelay: (() => void) | undefined;
  let librarySequence = 0;

  const observe = (value: unknown) => {
    observations.push({ observedAt: new Date().toISOString(), value });
    report.textContent = JSON.stringify({ browser: navigator.userAgent, scope: 'development iframe with procedural inputs', observations }, null, 2);
    download.disabled = false;
  };
  const appDocument = () => waitUntil(() => {
    const document = frame.contentDocument;
    return document?.querySelector('.folio-app') ? document : undefined;
  }, 'The real app did not become ready in the iframe.');
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    try { await operation(); } catch (error) {
      status.textContent = explain(error);
      observe({ error: status.textContent });
    } finally { busy = false; }
  };
  const showIcons = async () => {
    const document = await appDocument();
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-navigation button,button[aria-label="Icons"]')).find(element =>
      /^Icons(?:\s*\d+)?$/.test(element.textContent?.trim() ?? '') || element.getAttribute('aria-label') === 'Icons');
    assert(button, 'The app does not expose the new Icons navigation button yet.');
    button.click();
    await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    await waitUntil(() => {
      const input = document.querySelector<HTMLButtonElement>('button[aria-label="Import files"]');
      return input && !input.disabled;
    }, 'The Icons collection did not finish opening before import.');
    return document;
  };
  const dispatchDrop = (document: Document, files: File[], entries: QaEntry[] = []) => {
    const area = content.querySelector<HTMLSelectElement>('#drop-target')!.value;
    const target = document.querySelector<HTMLElement>(area === 'sidebar' ? '.sidebar' : '.main-workspace');
    assert(target, `The app's ${area} drop surface is missing.`);
    const realm = frame.contentWindow as Window & typeof globalThis;
    const {transfer, entryPlaceholders} = newTransfer(entries, files, realm);
    const prototype = realm.DataTransferItem.prototype;
    const originalDescriptor = Object.getOwnPropertyDescriptor(prototype, 'webkitGetAsEntry');
    const originalGetter = prototype.webkitGetAsEntry;
    const called = new Set<string>();
    const receipts: {name: string; isDirectory: boolean; getterCalledByApp: true}[] = [];
    function bridgedEntry(this: DataTransferItem) {
      const file = this.getAsFile();
      const entry = file && file.size === 0 && file.type === 'application/x-folio-qa-entry' ? entryPlaceholders.get(file.name) : undefined;
      if (entry && file) {
        called.add(file.name);
        receipts.push({name: entry.name, isDirectory: entry.isDirectory, getterCalledByApp: true});
        return entry;
      }
      return typeof originalGetter === 'function' ? originalGetter.call(this) : null;
    }
    // Native DataTransfer can return a fresh wrapper on each items access. Scope
    // the bridge to unique zero-byte placeholders in this iframe's native realm.
    // The app captures entry objects synchronously; traversal continues normally
    // after this prototype is restored immediately following the three events.
    if (entryPlaceholders.size) Object.defineProperty(prototype, 'webkitGetAsEntry', {
      configurable: originalDescriptor?.configurable ?? true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: originalDescriptor && 'writable' in originalDescriptor ? originalDescriptor.writable : true,
      value: bridgedEntry,
    });
    try {
      for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new realm.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    } finally {
      if (entryPlaceholders.size) {
        if (originalDescriptor) Object.defineProperty(prototype, 'webkitGetAsEntry', originalDescriptor);
        else Reflect.deleteProperty(prototype, 'webkitGetAsEntry');
        observe({action: 'synthetic directory-entry bridge receipt', target: area, expectedRoots: entryPlaceholders.size, capturedRoots: called.size, getterCalls: receipts, prototypeRestored: prototype.webkitGetAsEntry === originalGetter, boundary: 'Procedural entry bridge for synthetic DOM drops only; this is not an operating-system drag gesture.'});
      }
    }
    assert(called.size === entryPlaceholders.size, `The real app did not capture every synthetic directory entry (${called.size}/${entryPlaceholders.size}); folder behavior has not been exercised.`);
    return area;
  };
  const drop = async (files: File[], entries: QaEntry[] = []) => {
    const document = await showIcons();
    const area = dispatchDrop(document, files, entries);
    status.textContent = `Dropped ${files.length} loose files and ${entries.length} synthetic directory entries into the real ${area}. The app owns persistence and conversion.`;
    observe({ action: 'procedural drop', target: area, looseFiles: files.map(file => ({ name: file.name, bytes: file.size })),
      roots: entries.map(entry => entry.name), boundary: 'synthetic DOM drop event, not an OS drag gesture' });
  };

  const showLibraryTab = async (label: 'HTML' | 'Images') => {
    const document = await appDocument();
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-navigation [role="tab"]')).find(element => element.textContent?.trim().replace(/\s*\d+$/, '').trim() === label);
    assert(button, `The real ${label} tab is unavailable.`);
    button.click();
    await waitUntil(() => activeTab(document) === label, `The real ${label} tab did not become active.`);
    status.textContent = `${label} selected using the real application navigation.`;
  };

  const libraryDrop = async (delayed: boolean) => {
    const document = await appDocument();
    const beforeTab = activeTab(document);
    assert(beforeTab === 'HTML' || beforeTab === 'Images', 'Select HTML or Images first. This Library control does not switch tabs before dropping.');
    await waitUntil(() => { const input = document.querySelector<HTMLButtonElement>('button[aria-label="Import files"]'); return input && !input.disabled; }, 'The Library is not ready for another import.');
    const filename = `qa-library-opaque-${Date.now()}-${++librarySequence}.png`;
    const input = pngFile(fixtures.find(fixture => fixture.category === 'opaque')!, filename);
    let delay: Awaited<ReturnType<typeof holdLibraryImport>> | undefined;
    let selectedIconAtSwitch: string | null = null;
    try {
      if (delayed) { delay = await holdLibraryImport(); releaseLibraryDelay = delay.release; }
      const area = dispatchDrop(document, [input]);
      if (delay) {
        await waitUntil(() => document.querySelector<HTMLButtonElement>('button[aria-label="Import files"]')?.disabled, 'The real Library import did not start while its write was delayed.', 2_000);
        assert(delay.isHolding(), 'The bounded Library write delay expired before navigation; no race result can be claimed.');
        await showIcons();
        assert(delay.isHolding(), 'The Library writer was released before Icons became active.');
        selectedIconAtSwitch = document.querySelector('[role="treeitem"][aria-selected="true"]')?.getAttribute('data-page-id') ?? null;
        observe({action: 'Library writer delayed with a real native transaction', filename, beforeTab, activeTabBeforeRelease: activeTab(document), selectedIconAtSwitch, writesPerformedByDelay: 0, maximumDelayMs: 4_000});
        delay.release(); await delay.completed; releaseLibraryDelay = undefined;
      }
      const saved = await waitForLibraryItem(filename);
      await new Promise<void>(resolve => window.setTimeout(resolve, 100));
      const afterTab = activeTab(document);
      const hash = frame.contentWindow!.location.hash;
      const selectedAfter = document.querySelector('[role="treeitem"][aria-selected="true"]')?.getAttribute('data-page-id') ?? null;
      if (delayed) {
        assert(afterTab === 'Icons' && hash === '#icons', `A completed Library import stole navigation: ${afterTab}, ${hash}.`);
        assert(selectedAfter === selectedIconAtSwitch, 'A completed Library import changed the selected icon.');
        assert(document.querySelector('[aria-label="Icon conversion canvas"]'), 'Icons navigation and canvas disagree after Library completion.');
      } else {
        assert(afterTab === 'Images' && hash === '#images', `The imported image selection and top navigation disagree: ${afterTab}, ${hash}.`);
        assert(document.querySelector('.current-file strong')?.textContent === filename, 'The imported Library image was not selected.');
      }
      observe({action: delayed ? 'Library import completion preserves later Icons navigation' : 'Library opaque PNG import keeps navigation coherent', status: 'pass', filename, target: area, beforeTab, afterTab, hash, savedItem: saved, selectedAfter, selectedIconAtSwitch, activeElement: focusDescription(document), boundary: 'Real app drop and IDB save; delayed case holds a bounded native transaction without modifying stored data.'});
      status.textContent = delayed ? 'Library import saved successfully without stealing the later Icons selection.' : 'Opaque PNG saved in the Library; Images navigation, URL and selected file agree.';
    } finally { delay?.release(); releaseLibraryDelay = undefined; }
  };

  const libraryHtmlDrop = async () => {
    const document = await appDocument();
    const beforeTab = activeTab(document);
    assert(beforeTab === 'Images', 'Select Images first. This control does not switch tabs before dropping.');
    await waitUntil(() => { const input = document.querySelector<HTMLButtonElement>('button[aria-label="Import files"]'); return input && !input.disabled; }, 'The Library is not ready for another import.');
    const stem = `qa-library-html-${Date.now()}-${++librarySequence}`;
    const pageName = `${stem}.html`;
    const archiveName = `${stem}.zip`;
    const assetPath = 'assets/qa-navigation.css';
    const zip = new JSZip();
    zip.file(pageName, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Procedural Library navigation check</title><link rel="stylesheet" href="${assetPath}"></head><body><main><h1>Images to HTML navigation check</h1><p>This page and its stylesheet were generated by the development harness.</p></main></body></html>`);
    zip.file(assetPath, 'body{margin:0;padding:32px;font-family:system-ui,sans-serif;background:#f6f8f2;color:#243527}main{max-width:640px}');
    const input = new File([await zip.generateAsync({type: 'arraybuffer', compression: 'DEFLATE'})], archiveName, {type: 'application/zip', lastModified: 1_700_000_000_000});
    assert(activeTab(document) === 'Images', 'Navigation changed before the procedural ZIP was ready; the Images-to-HTML journey was not exercised.');
    const area = dispatchDrop(document, [input]);
    const saved = await waitForLibraryItem(pageName) as {id?: string; path?: string; kind?: string; label?: string};
    assert(typeof saved.id === 'string' && saved.path === pageName && saved.kind === 'html', 'The real Library did not persist the procedural HTML page with its expected identity and kind.');
    await waitUntil(() => { const button = document.querySelector<HTMLButtonElement>('button[aria-label="Import files"]'); return button && !button.disabled; }, 'The HTML ZIP import did not finish.');
    await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    const afterTab = activeTab(document);
    const hash = frame.contentWindow!.location.hash;
    const selectedAfter = document.querySelector('[role="treeitem"][aria-selected="true"]')?.getAttribute('data-page-id') ?? null;
    const selectedLabel = document.querySelector('.current-file strong')?.textContent ?? null;
    assert(afterTab === 'HTML' && hash === '#html', `The imported HTML selection and top navigation disagree: ${afterTab}, ${hash}.`);
    assert(selectedAfter === saved.id && selectedLabel === pageName, 'The imported HTML page is not the selected file in both the shared tree and canvas toolbar.');
    assert(!document.querySelector('[aria-label="Icon conversion canvas"]'), 'HTML navigation still exposes the Icons canvas.');
    observe({action: 'Library Images-to-HTML ZIP import keeps navigation coherent', status: 'pass', target: area, archiveName, archiveBytes: input.size, pageName, assetPath, beforeTab, afterTab, hash, selectedAfter, selectedLabel, savedItem: saved, activeElement: focusDescription(document), boundary: 'Procedural HTML and stylesheet ZIP delivered through a synthetic DOM drop; the real app owns archive extraction, persistence and the Images-to-HTML transition.'});
    status.textContent = 'HTML ZIP saved in the Library; HTML navigation, URL, shared tree and selected file agree.';
  };

  content.querySelector('#show-icons')!.addEventListener('click', () => void run(async () => { await showIcons(); status.textContent = 'Icons selected in the real application.'; }));
  content.querySelector('#show-html')!.addEventListener('click', () => void run(() => showLibraryTab('HTML')));
  content.querySelector('#show-images')!.addEventListener('click', () => void run(() => showLibraryTab('Images')));
  content.querySelector('#drop-library')!.addEventListener('click', () => void run(() => libraryDrop(false)));
  content.querySelector('#drop-library-html')!.addEventListener('click', () => void run(libraryHtmlDrop));
  content.querySelector('#delayed-library')!.addEventListener('click', () => void run(() => libraryDrop(true)));
  content.querySelector('#drop-loose')!.addEventListener('click', () => void run(() => drop(fixtures.map(fixture => pngFile(fixture)))));
  content.querySelector('#drop-duplicates')!.addEventListener('click', () => void run(() => drop(
    ['qa-icon.png', 'QA-ICON.PNG', 'qa-icon (2).png'].map(name => pngFile(fixtures[0], name)),
  )));
  const directoryObservation = (value: unknown) => observe({ action: 'synthetic directory readEntries', value });
  content.querySelector('#drop-folder')!.addEventListener('click', () => void run(() => drop([], nestedEntries(directoryObservation))));
  content.querySelector('#drop-folder-again')!.addEventListener('click', () => void run(() => drop([], [
    ...nestedEntries(directoryObservation), ...nestedEntries(directoryObservation),
  ])));
  content.querySelector('#drop-uncategorized')!.addEventListener('click', () => void run(() => drop([], [
    directoryEntry('Uncategorized', [fileEntry(pngFile(fixtures[0], 'inside.png'), '/Uncategorized')], '', directoryObservation),
  ])));
  content.querySelector('#drop-invalid')!.addEventListener('click', () => void run(() => drop([
    new File(['Procedural invalid PNG bytes.'], 'qa-invalid.png', { type: 'image/png' }),
  ])));
  content.querySelector('#drop-pending')!.addEventListener('click', () => void run(() => drop(
    Array.from({ length: 24 }, (_, index) => pngFile(fixtures.find(fixture => fixture.category === 'alpha-sweep')!, `qa-cancel-${index + 1}.png`)),
  )));
  content.querySelector('#drop-silhouette')!.addEventListener('click', () => void run(async () => {
    const fixture = createCurveReferenceFixture();
    await drop([new File([fixture.bytes], `qa-${fixture.name}`, {type: 'image/png', lastModified: 1_700_000_000_000})]);
    observe({action: 'analytic silhouette fixture', dimensions: [fixture.width, fixture.height], referenceScale: fixture.referenceScale, features: ['curved outer contour', 'curved transparent hole', 'small island', 'thin stroke'], boundary: 'The real app owns conversion. Select Smooth curves in its toolbar; this button does not choose a mode or assert visual quality.'});
  }));
  const setWidth = (width: number) => {
    frame.style.width = `${width}px`;
    frame.width = String(width);
    status.textContent = `App iframe viewport set to ${width} × 844 CSS pixels.`;
    observe({ action: 'viewport', width, height: 844 });
  };
  content.querySelector('#mobile-width')!.addEventListener('click', () => setWidth(390));
  content.querySelector('#desktop-width')!.addEventListener('click', () => setWidth(1360));
  content.querySelector('#reload-app')!.addEventListener('click', () => void run(async () => {
    restoreAbort?.();
    restoreDownload?.();
    releaseLibraryDelay?.();
    const before = frame.contentDocument;
    frame.contentWindow!.location.reload();
    await waitUntil(() => frame.contentDocument !== before && frame.contentDocument?.querySelector('.folio-app') ? frame.contentDocument : undefined,
      'The app iframe did not reload.');
    await showIcons();
    status.textContent = 'The real app iframe reloaded. Its Icons collection is reopened from local browser storage.';
    observe({ action: 'iframe reload', oldDocumentReplaced: frame.contentDocument !== before });
  }));
  download.addEventListener('click', () => downloadJson({ browser: navigator.userAgent, observations }, 'folio-icon-library-ui-observations.json'));

  // This harness observes the real app and aborts native transactions without
  // adding a testing hook to the production implementation.
  wireInteractiveStorage({ content, frame, status, observe, run, appDocument,
    replaceAbortRestore: restore => { restoreAbort?.(); restoreAbort = restore; } });
  wireInteractiveDownloads({content, frame, status, observe, run, appDocument,
    replaceRestore: restore => {restoreDownload?.(); restoreDownload = restore;}});
  window.addEventListener('pagehide', () => {restoreAbort?.(); restoreDownload?.(); releaseLibraryDelay?.();}, { once: true });
  void appDocument().then(() => { status.textContent = 'The real app is ready. Select Icons or drop procedural inputs.'; })
    .catch(error => { status.textContent = explain(error); });
}

interface InteractiveStorageControls {
  content: HTMLElement;
  frame: HTMLIFrameElement;
  status: HTMLElement;
  observe: (value: unknown) => void;
  run: (operation: () => Promise<void>) => Promise<void>;
  appDocument: () => Promise<Document>;
  replaceAbortRestore: (restore: () => void) => void;
}

function wireInteractiveStorage(controls: InteractiveStorageControls): void {
  const { content, frame, status, observe, run, appDocument, replaceAbortRestore } = controls;
  content.querySelector('#observe-app')!.addEventListener('click', () => void run(async () => {
    const document = await appDocument();
    const saved = await readRawDatabase(ICON_DB_NAME);
    const records = saved.records.icons ?? [];
    const outputs = saved.records.outputs ?? [];
    const sources = saved.records.sources ?? [];
    // Only metadata and Blob lengths are recorded. Procedural PNG/SVG bytes do
    // not appear in the page's downloadable evidence JSON.
    const blobSummary = (row: unknown) => {
      const value = row as { id?: string; revision?: number; blob?: Blob };
      return { id: value.id, revision: value.revision, bytes: value.blob?.size, type: value.blob?.type };
    };
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const canvas = document.querySelector<HTMLElement>('.main-workspace');
    observe({
      action: 'read-only actual-app observation',
      database: ICON_DB_NAME,
      saved: { icons: records, folders: saved.records.folders ?? [], preferences: saved.records.prefs ?? [],
        sources: sources.map(blobSummary), outputs: outputs.map(blobSummary) },
      app: { viewport: { width: frame.contentWindow?.innerWidth, height: frame.contentWindow?.innerHeight },
        sidebarCount: document.querySelectorAll('.sidebar').length,
        activeNavigation: Array.from(document.querySelectorAll('button[aria-pressed="true"],button[aria-current],button[role="tab"][aria-selected="true"]'))
          .map(button => ({ label: button.textContent?.trim(), ariaPressed: button.getAttribute('aria-pressed'), ariaCurrent: button.getAttribute('aria-current'), ariaSelected: button.getAttribute('aria-selected') })),
        alerts: Array.from(document.querySelectorAll('[role="alert"]')).map(element => element.textContent?.trim()),
        statuses: Array.from(document.querySelectorAll('[role="status"]')).map(element => element.textContent?.trim()),
        activeElement: focusDescription(document),
        iframeFocusedInParent: window.document.activeElement === frame,
        sidebar: sidebar ? { width: sidebar.clientWidth, scrollWidth: sidebar.scrollWidth } : null,
        canvas: canvas ? { width: canvas.clientWidth, scrollWidth: canvas.scrollWidth } : null },
      boundary: 'Observed saved metadata and DOM state. Visual, keyboard and OS download judgments require the actual browser journey.',
    });
    status.textContent = `Observed ${records.length} saved icon records, ${sources.length} source Blobs and ${outputs.length} output Blobs without changing the collection.`;
  }));

  const arm = async (phase: 'source' | 'result') => {
    await appDocument();
    const realm = frame.contentWindow as (Window & typeof globalThis) | null;
    assert(realm?.IDBObjectStore, 'The iframe does not expose its native IndexedDB realm.');
    replaceAbortRestore(() => undefined);
    // Restrict the override to this dedicated development iframe and one
    // matching native write. The containing page and QA databases are separate.
    let timer = 0;
    const injection = armTransactionAbort(realm, ICON_DB_NAME, phase === 'source' ? 'add' : 'put', value => {
      const row = value as { status?: string } | null;
      return phase === 'source' || row?.status === 'ready';
    }, receipt => {
      window.clearTimeout(timer);
      status.textContent = `Aborted the actual ${phase} transaction after its native metadata request was queued. Observe the app's error state and saved records.`;
      observe({ action: 'native actual-app transaction abort', phase, receipt });
    });
    const restore = () => { window.clearTimeout(timer); injection.restore(); };
    replaceAbortRestore(restore);
    timer = window.setTimeout(() => {
      restore();
      if (!injection.receipts.length) {
        status.textContent = `The ${phase} abort expired after 60 seconds without matching a write.`;
        observe({ action: 'transaction abort expired', phase });
      }
    }, 60_000);
    status.textContent = `Armed one real ${phase} transaction abort for the next 60 seconds. ${phase === 'source' ? 'Import a procedural input.' : 'Import a procedural input or retry an existing item.'}`;
    observe({ action: 'armed native transaction abort', phase, database: ICON_DB_NAME, expiresAfterMs: 60_000 });
  };
  content.querySelector('#abort-source')!.addEventListener('click', () => void run(() => arm('source')));
  content.querySelector('#abort-result')!.addEventListener('click', () => void run(() => arm('result')));
}

interface InteractiveDownloadControls extends Omit<InteractiveStorageControls, 'replaceAbortRestore'> {
  replaceRestore: (restore: () => void) => void;
}

/** Observe one real app download without suppressing its normal anchor click. */
function wireInteractiveDownloads(controls: InteractiveDownloadControls): void {
  const {content, frame, status, observe, run, appDocument, replaceRestore} = controls;
  const maximumBytes = 128 * 1024 * 1024;
  content.querySelector('#observe-download')!.addEventListener('click', () => void run(async () => {
    replaceRestore(() => undefined);
    const document = await appDocument();
    assert(activeTab(document) === 'Icons', 'Open Icons before observing an SVG or ZIP download.');
    const realm = frame.contentWindow as Window & typeof globalThis;
    assert(realm.location.origin === window.location.origin, 'Only the same-origin development app may be observed.');
    const query = document.querySelector<HTMLInputElement>('input[aria-label="Find a file"]')?.value ?? '';
    const favoritesOnly = document.querySelector('.favorites-filter')?.getAttribute('aria-pressed') === 'true';
    const store = await openIconCollection();
    const expected = new Map<string, {id: string; revision: number; blob: Blob}>();
    try {
      const saved = await store.snapshot();
      const projection = projectIconCollection(saved, favoritesOnly);
      const visible = new Set(getPageOrder(filterTree(projection.tree, query, new Map(projection.pages.map(page => [page.id, page])))));
      const ready = saved.items.filter(item => item.status === 'ready' && item.result && visible.has(item.id));
      assert(ready.length > 0, 'Convert at least one icon in the current view before arming this observer.');
      assert(ready.length <= 500, 'This bounded observer supports at most 500 ready icons. Filter the view before retrying.');
      assert(ready.reduce((sum, item) => sum + item.result!.outputBytes, 0) <= maximumBytes, 'The current view exceeds the 128 MiB download-observation budget. Filter it before retrying.');
      let total = 0;
      for (const item of ready) {
        const blob = await store.getOutput(item.id, item.revision);
        assert(blob, `${item.name} changed while the observer was being armed. Retry after conversion finishes.`);
        total += blob.size;
        assert(total <= maximumBytes, 'Saved outputs exceed the 128 MiB observation budget.');
        assert(!expected.has(item.filename), 'Two saved results have the same download filename.');
        expected.set(item.filename, {id: item.id, revision: item.revision, blob});
      }
    } finally {store.close();}
    const prototype = realm.HTMLAnchorElement.prototype;
    const originalClick = prototype.click;
    let timer = 0;
    let consumed = false;
    let originalClickInvoked = false;
    const sameOriginBlob = (url: string): boolean => {
      try {return url.startsWith('blob:') && new URL(url).origin === realm.location.origin && realm.location.origin === window.location.origin;} catch {return false;}
    };
    const restore = () => {
      if (prototype.click === observedClick) prototype.click = originalClick;
      window.clearTimeout(timer);
    };
    const inspect = async (url: string, filename: string) => {
      try {
        assert(sameOriginBlob(url), 'The observer can read only an app-created same-origin Blob URL.');
        const response = await fetch(url);
        assert(response.ok, `The app download Blob could not be read (${response.status}).`);
        const blob = await response.blob();
        assert(blob.size <= maximumBytes + 2 * 1024 * 1024, 'The app download exceeds the bounded payload budget.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (/\.zip$/i.test(filename)) {
          assert(filename === 'folio-icons.zip', `Unexpected icon ZIP filename: ${filename}.`);
          const zip = await JSZip.loadAsync(bytes);
          const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
          assert(names.length === expected.size, `Expected ${expected.size} ready SVG entries, received ${names.length}.`);
          const entries: {filename: string; bytes: number; id: string; revision: number}[] = [];
          for (const name of names) {
            const saved = expected.get(name);
            assert(saved, `Unexpected or unsafe ZIP member: ${name}.`);
            const actual = await zip.files[name].async('uint8array');
            await equalBlob(new Blob([actual]), saved.blob, `ZIP member ${name} differs from its exact saved SVG Blob.`);
            entries.push({filename: name, bytes: actual.byteLength, id: saved.id, revision: saved.revision});
          }
          observe({action: 'actual-app ZIP download payload', status: 'pass', filename, bytes: bytes.byteLength, entries, exactSavedOutputBytes: true, originalAnchorClickInvoked: originalClickInvoked, browserOrOsFileDelivery: 'not observed'});
        } else {
          const saved = expected.get(filename);
          assert(saved, `The SVG filename ${filename} is not allocated to a ready result in the current view.`);
          await equalBlob(new Blob([bytes]), saved.blob, 'The downloaded SVG differs from its exact saved output Blob.');
          observe({action: 'actual-app SVG download payload', status: 'pass', filename, bytes: bytes.byteLength, id: saved.id, revision: saved.revision, exactSavedOutputBytes: true, originalAnchorClickInvoked: originalClickInvoked, browserOrOsFileDelivery: 'not observed'});
        }
        status.textContent = `${filename}: actual download filename and bytes match the ready saved SVG output${/\.zip$/i.test(filename) ? 's' : ''}. Original anchor click preserved; OS delivery unobserved. Observer restored.`;
      } catch (error) {
        status.textContent = `Download observation failed: ${explain(error)}`;
        observe({action: 'actual-app download payload', status: 'fail', filename, error: explain(error), originalAnchorClickInvoked: originalClickInvoked, browserOrOsFileDelivery: 'not observed'});
      }
    };
    function observedClick(this: HTMLAnchorElement): void {
      const url = this.href;
      const filename = this.download;
      if (consumed || !sameOriginBlob(url) || !/\.(svg|zip)$/i.test(filename)) {originalClick.call(this); return;}
      consumed = true; restore();
      // Begin reading before the app's normal cleanup can revoke the Blob URL.
      void inspect(url, filename);
      originalClickInvoked = true;
      originalClick.call(this);
    }
    replaceRestore(restore);
    prototype.click = observedClick;
    timer = window.setTimeout(() => {
      restore();
      if (!consumed) {
        status.textContent = 'Download observation expired after 60 seconds. Original anchor behavior restored.';
        observe({action: 'download observer expired', expiresAfterMs: 60_000, originalBehaviorRestored: true});
      }
    }, 60_000);
    observe({action: 'download observer armed', readyResults: expected.size, query, favoritesOnly, maximumBytes, expiresAfterMs: 60_000, boundary: 'One same-origin app Blob download only; byte equality is checked against saved output Blobs, not OS delivery.'});
    status.textContent = `Armed for one SVG/ZIP download with ${expected.size} ready result${expected.size === 1 ? '' : 's'} in this view. Click the real app download control within 60 seconds; its original anchor click will run.`;
  }));
}

type CollectionStore = Awaited<ReturnType<typeof openIconCollection>>;
const QA_DATABASE_PREFIX = 'folio-icons-qa-';
let databaseSequence = 0;

interface QaDatabase {
  name: string;
  store: CollectionStore;
  open: () => Promise<CollectionStore>;
  close: (store: CollectionStore) => void;
}

async function deleteQaDatabase(name: string): Promise<void> {
  assert(name.startsWith(QA_DATABASE_PREFIX), 'Refusing to delete a database outside the isolated QA prefix.');
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    const timeout = window.setTimeout(() => reject(new Error(`QA database cleanup remained blocked: ${name}`)), 5_000);
    request.onsuccess = () => { window.clearTimeout(timeout); resolve(); };
    request.onerror = () => { window.clearTimeout(timeout); reject(request.error ?? new Error('QA database cleanup failed.')); };
  });
}

async function withQaDatabase<T>(label: string, operation: (database: QaDatabase) => Promise<T>): Promise<T> {
  const name = `${QA_DATABASE_PREFIX}${Date.now()}-${++databaseSequence}-${label}`;
  const connections = new Set<CollectionStore>();
  const open = async () => { const store = await openIconCollection(name); connections.add(store); return store; };
  const close = (store: CollectionStore) => { store.close(); connections.delete(store); };
  try {
    const store = await open();
    return await operation({ name, store, open, close });
  } finally {
    for (const store of connections) store.close();
    await deleteQaDatabase(name);
  }
}

function looseBatch(names = ['qa-mark.png']): IconImportBatch {
  return { files: names.map(name => ({ file: pngFile(fixtures[0], name), relativePath: name })), directories: [] };
}

function folderBatch(rootName: string, rootKey: string): IconImportBatch {
  return {
    files: [
      { file: pngFile(fixtures[0], 'mark.png'), relativePath: `${rootName}/mark.png`, rootKey },
      { file: pngFile(fixtures[1], 'mark.png'), relativePath: `${rootName}/Nested/mark.png`, rootKey },
    ],
    directories: [rootName, `${rootName}/Nested`, `${rootName}/Empty`].map(relativePath => ({ relativePath, rootKey })),
  };
}

function oneItem(snapshot: IconCollectionSnapshot, id?: string): IconRecord {
  const item = id ? snapshot.items.find(item => item.id === id) : snapshot.items[0];
  assert(item, 'Expected an icon record in the durable collection.');
  return item;
}

function unique(values: string[], message: string): void {
  assert(new Set(values.map(value => value.normalize('NFC').toLocaleLowerCase('en-US'))).size === values.length, message);
}

const converted = new Map<'pixels' | 'embedded', Promise<PngSvgResult>>();
function actualResult(mode: 'pixels' | 'embedded' = 'pixels'): Promise<PngSvgResult> {
  let result = converted.get(mode);
  if (!result) {
    result = convertPng(pngFile(fixtures[0]), { mode }).then(value => {
      assert(value.fidelity.status === 'verified' && value.fidelity.differingPixels === 0,
        `The procedural ${mode} fixture did not pass its actual native browser render check.`);
      return value;
    });
    converted.set(mode, result);
  }
  return result;
}

function resultMetadata(result: PngSvgResult): Omit<PngSvgResult, 'svg'> {
  const { svg: _svg, ...metadata } = result;
  return metadata;
}

async function importOne(store: CollectionStore, name = 'qa-mark.png'): Promise<IconRecord> {
  const report = await store.importEntries(looseBatch([name]), 'pixels');
  assert(report.added.length === 1, 'A valid procedural PNG was not imported exactly once.');
  return report.added[0];
}

type StorageCheck = { name: string; run: () => Promise<unknown> };

const storageChecks: StorageCheck[] = [
  {
    name: 'Uncategorized is durable; snapshots contain only metadata',
    run: () => withQaDatabase('empty', async ({ store, open, close }) => {
      const first = await store.snapshot();
      assert(first.items.length === 0, 'A new isolated database unexpectedly contains icons.');
      const uncategorized = first.folders.filter(folder => folder.name === 'Uncategorized' && folder.parentId === null);
      assert(uncategorized.length === 1, 'An empty collection must contain exactly one top-level Uncategorized folder.');
      assert(noBlobs(first), 'The collection snapshot eagerly exposes binary source or result data.');
      close(store);
      const reopened = await open();
      const second = await reopened.snapshot();
      assert(second.folders.filter(folder => folder.name === 'Uncategorized' && folder.parentId === null).length === 1,
        'Reopening duplicated the reserved folder.');
      assert(second.folders.some(folder => folder.id === uncategorized[0].id), 'The reserved folder ID changed after reopen.');
      return { reservedFolderId: uncategorized[0].id, empty: true, metadataOnly: true, reopened: true };
    }),
  },
  {
    name: 'Loose intake atomically persists exact source bytes and safe collision names',
    run: () => withQaDatabase('loose', async ({ name, store, open, close }) => {
      const names = ['mark.png', 'MARK.PNG', 'mark (2).png', 'mark.svg.png'];
      const report = await store.importEntries(looseBatch(names), 'pixels');
      assert(report.added.length === names.length, 'Loose duplicate-name inputs were silently lost.');
      const snapshot = await store.snapshot();
      const folder = snapshot.folders.find(folder => folder.name === 'Uncategorized' && folder.parentId === null)!;
      assert(snapshot.items.every(item => item.folderId === folder.id && item.status === 'queued'), 'Loose icons must be queued in the reserved folder.');
      unique(snapshot.items.map(item => item.name), 'Sibling display names collide ignoring case.');
      unique(snapshot.items.map(item => item.filename), 'SVG download names collide ignoring case.');
      assert(snapshot.items.every(item => item.filename.endsWith('.svg') && !/[\\/\u0000-\u001f]/.test(item.filename)),
        'A result filename is unsafe or does not have an SVG extension.');
      for (const item of snapshot.items) {
        await equalBlob(await store.getSource(item.id), fixtures[0].bytes, 'Persisted source bytes differ from the procedural input.');
        assert(!await store.getOutput(item.id), 'A queued import incorrectly has an output Blob.');
      }
      const raw = await readRawDatabase(name);
      assert(raw.records.icons.length === names.length && raw.records.sources.length === names.length && raw.records.outputs.length === 0,
        'The successful intake has inconsistent metadata/source/output row counts.');
      assert(noBlobs(snapshot), 'Source Blobs leaked into the live metadata snapshot.');
      close(store);
      const reopened = await open();
      assert(JSON.stringify((await reopened.snapshot()).items) === JSON.stringify(snapshot.items), 'Queued metadata changed after reopening.');
      return { sourceNames: snapshot.items.map(item => item.sourceName), names: snapshot.items.map(item => item.name),
        outputNames: snapshot.items.map(item => item.filename), exactSources: names.length, queuedAfterReopen: names.length };
    }),
  },
  {
    name: 'Nested/empty folders and duplicate roots preserve stable parent identity',
    run: () => withQaDatabase('folders', async ({ store, open, close }) => {
      const first = await store.importEntries(folderBatch('QA Icons', 'first-root'), 'pixels');
      const second = await store.importEntries(folderBatch('QA Icons', 'second-root'), 'pixels');
      const reservedCollision = await store.importEntries(folderBatch('Uncategorized', 'third-root'), 'pixels');
      assert(first.added.length === 2 && second.added.length === 2 && reservedCollision.added.length === 2, 'Directory imports lost PNGs.');
      const snapshot = await store.snapshot();
      const top = snapshot.folders.filter(folder => folder.parentId === null);
      assert(top.length === 4, 'Each dropped root needs its own top-level identity beside the reserved folder.');
      unique(top.map(folder => folder.name), 'Top-level root collisions were not safely resolved.');
      assert(top.filter(folder => folder.name === 'Uncategorized').length === 1, 'A dropped root replaced or duplicated reserved Uncategorized.');
      const empty = snapshot.folders.filter(folder => folder.name === 'Empty');
      assert(empty.length === 3 && new Set(empty.map(folder => folder.parentId)).size === 3, 'Empty folders or their separate parent identities were lost.');
      assert(snapshot.items.every(item => snapshot.folders.some(folder => folder.id === item.folderId)), 'An icon references a missing folder.');
      assert(snapshot.items.filter(item => item.sourcePath.includes('/Nested/')).length === 3, 'Nested source paths were not retained.');
      unique(snapshot.items.map(item => item.filename), 'Download names collide across separate directories.');
      close(store);
      const reopened = await open();
      const again = await reopened.snapshot();
      assert(JSON.stringify(again.folders) === JSON.stringify(snapshot.folders), 'Folder identity/hierarchy changed after reopen.');
      assert(JSON.stringify(again.items) === JSON.stringify(snapshot.items), 'Directory item metadata changed after reopen.');
      return { topFolders: top.map(folder => ({ id: folder.id, name: folder.name })), emptyFolders: empty.length,
        nestedSources: snapshot.items.filter(item => item.sourcePath.includes('/Nested/')).map(item => item.sourcePath), reopened: true };
    }),
  },
  {
    name: 'Invalid relative paths reject the whole intake without partial writes',
    run: () => withQaDatabase('invalid-path', async ({ name, store }) => {
      const before = await readRawDatabase(name);
      const rejected: string[] = [];
      for (const relativePath of ['../escape.png', '/absolute.png', 'C:\\absolute.png', 'root//empty.png', 'root/./dot.png']) {
        rejected.push(await rejects(() => store.importEntries({
          files: [...looseBatch(['valid.png']).files, { file: pngFile(fixtures[0], 'invalid.png'), relativePath }], directories: [],
        }, 'pixels'), `Unsafe path ${relativePath} was accepted.`));
        const after = await readRawDatabase(name);
        assert(JSON.stringify(after.records) === JSON.stringify(before.records), `Rejecting ${relativePath} left a partial import.`);
      }
      return { rejectedCases: rejected.length, errors: rejected, allStoresUnchanged: true };
    }),
  },
  {
    name: 'Shared sibling names, moves, favorites and workspace preferences persist',
    run: () => withQaDatabase('organization', async ({ store, open, close }) => {
      const reserved = (await store.snapshot()).folders.find(folder => folder.name === 'Uncategorized')!;
      const collidingFolder = await store.createFolder('mark.png', reserved.id);
      const item = await importOne(store, 'mark.png');
      assert(item.name.toLowerCase() !== collidingFolder.name.toLowerCase(), 'A file silently shadows a sibling folder with the same name.');
      const now = Date.now();
      const claim = await store.claimNext('qa-organization-owner', now, 60_000);
      assert(claim?.id === item.id, 'The organization fixture was not claimed.');
      const result = await actualResult();
      assert(await store.complete(claim, result, now + 1), 'The organization fixture result was not saved.');
      const destination = await store.createFolder('QA destination');
      await store.setFavorite(item.id, true);
      await store.setFolderFavorite(destination.id, true);
      const moved = await store.move(item.id, destination.id);
      const folderAfterMove = await store.createFolder(moved.name, destination.id);
      assert(folderAfterMove.name.toLowerCase() !== moved.name.toLowerCase(), 'A newly created folder shadows a sibling icon.');
      const preferences = await store.setPreferences({ selectedId: item.id, expanded: [reserved.id, destination.id],
        order: { sort: 'name-desc', group: 'folders' }, defaultMode: 'embedded', zoom: '4', background: 'dark' });
      close(store);
      const reopened = await open();
      const snapshot = await reopened.snapshot();
      const saved = oneItem(snapshot, item.id);
      assert(saved.folderId === destination.id && saved.favorite, 'Moving or starring an icon was not durable.');
      assert(saved.id === item.id && saved.sourcePath === item.sourcePath && saved.filename === item.filename && saved.revision === claim.revision,
        'A presentation move changed source identity, output filename or conversion revision.');
      assert(saved.status === 'ready' && JSON.stringify(saved.result) === JSON.stringify(resultMetadata(result)), 'Moving a ready icon changed its saved result.');
      assert(snapshot.folders.find(folder => folder.id === destination.id)?.favorite, 'The folder favorite did not survive reopen.');
      assert(JSON.stringify(snapshot.preferences) === JSON.stringify(preferences), 'Selection, expansion, order or canvas preferences changed on reopen.');
      await equalBlob(await reopened.getOutput(item.id), new TextEncoder().encode(result.svg), 'Moving an icon changed its saved SVG bytes.');
      return { originalSiblingName: collidingFolder.name, resolvedIconName: item.name, resolvedNewFolderName: folderAfterMove.name,
        stableIconId: item.id, preservedSourcePath: saved.sourcePath, preservedSvg: true, preferences: snapshot.preferences };
    }),
  },
  {
    name: 'Native source transaction abort leaves no partial folder, source or item rows',
    run: () => withQaDatabase('abort-source', async ({ name, store }) => {
      const before = await readRawDatabase(name);
      const injected = armTransactionAbort(globalThis, name, 'add', () => true);
      let rejection = '';
      try {
        rejection = await rejects(() => store.importEntries(folderBatch('Abort Root', 'abort-root'), 'pixels'), 'The aborted source transaction reported success.');
      } finally { injected.restore(); }
      assert(injected.receipts.length === 1 && injected.receipts[0].requestWasQueued, 'The test did not abort an actual queued native metadata write.');
      const after = await readRawDatabase(name);
      assert(JSON.stringify(after.keys) === JSON.stringify(before.keys), 'An aborted source transaction left partial record keys.');
      assert(JSON.stringify(after.records) === JSON.stringify(before.records), 'An aborted source transaction changed stored records.');
      assert((await store.snapshot()).items.length === 0, 'The aborted import exposed a queued or ready icon.');
      const recovery = await store.importEntries(folderBatch('Abort Root', 'recovery-root'), 'pixels');
      assert(recovery.added.length === 2, 'The collection did not recover after a source transaction abort.');
      return { receipt: injected.receipts[0], rejection, allStoresRolledBack: true, recoveryImported: recovery.added.length };
    }),
  },
  {
    name: 'Native output transaction abort cannot persist an output or ready state',
    run: () => withQaDatabase('abort-result', async ({ name, store }) => {
      const item = await importOne(store);
      const now = Date.now();
      const claim = await store.claimNext('qa-result-owner', now, 60_000);
      assert(claim?.id === item.id, 'The output abort fixture was not claimed.');
      const result = await actualResult();
      const before = await readRawDatabase(name);
      const injected = armTransactionAbort(globalThis, name, 'put', value => (value as IconRecord).status === 'ready');
      let rejection = '';
      try { rejection = await rejects(() => store.complete(claim, result, now + 1), 'An aborted output transaction reported success.'); }
      finally { injected.restore(); }
      assert(injected.receipts.length === 1 && injected.receipts[0].requestWasQueued, 'No real native ready-metadata write was aborted.');
      const after = await readRawDatabase(name);
      assert(JSON.stringify(after.keys) === JSON.stringify(before.keys), 'An output Blob survived the aborted ready transaction.');
      assert(JSON.stringify(after.records.icons) === JSON.stringify(before.records.icons), 'The aborted output transaction changed icon metadata.');
      const persisted = oneItem(await store.snapshot(), item.id);
      assert(persisted.status === 'processing' && !persisted.result, 'The aborted result is incorrectly advertised as ready or verified.');
      assert(!await store.getOutput(item.id), 'An aborted output is retrievable as a download.');
      await equalBlob(await store.getSource(item.id), fixtures[0].bytes, 'The source was damaged by the result abort.');
      assert(await store.complete(claim, result, now + 2), 'The prior processing state was not recoverable after abort.');
      assert(oneItem(await store.snapshot(), item.id).status === 'ready', 'A subsequent successful result did not become ready.');
      return { receipt: injected.receipts[0], rejection, noReadyStateAfterAbort: true, noOutputAfterAbort: true, sameClaimRecovery: true };
    }),
  },
  {
    name: 'Two owners cannot steal a live lease; expiry rejects every old-owner mutation',
    run: () => withQaDatabase('leases', async ({ store, open }) => {
      const item = await importOne(store);
      const second = await open();
      const now = Date.now();
      const attempts = await Promise.all([store.claimNext('qa-owner-a', now, 1_000), second.claimNext('qa-owner-b', now, 1_000)]);
      const winners = attempts.filter(Boolean);
      assert(winners.length === 1, 'Simultaneous independent owners both claimed one queued item.');
      const first = winners[0]!;
      const winner = first.owner === 'qa-owner-a' ? store : second;
      const other = first.owner === 'qa-owner-a' ? second : store;
      assert(first.id === item.id, 'The wrong item was claimed.');
      assert(!await other.claimNext('qa-owner-c', now + 500, 1_000), 'A live claim was stolen.');
      assert(await winner.heartbeat(first, now + 800, 2_000), 'A valid owner could not renew its lease.');
      const reopened = await open();
      assert(!await reopened.claimNext('qa-reopen-owner', now + 1_500, 1_000), 'Opening another connection reset a renewed live lease.');
      const replacement = await other.claimNext('qa-recovery-owner', now + 2_801, 2_000);
      assert(replacement?.id === item.id && replacement.token !== first.token, 'An expired claim was not recovered with a new token.');
      const result = await actualResult();
      assert(!await winner.heartbeat(first, now + 2_802, 1_000), 'The expired owner renewed a replaced claim.');
      assert(!await winner.complete(first, result, now + 2_802), 'The expired owner committed a stale result.');
      assert(!await winner.fail(first, 'stale owner failure', now + 2_802), 'The expired owner overwrote the replacement with failure.');
      assert(!await winner.release(first), 'The expired owner released a replacement owner claim.');
      assert(await other.complete(replacement, result, now + 2_803), 'The recovered owner could not commit its result.');
      assert(oneItem(await store.snapshot(), item.id).status === 'ready', 'The current owner result was not durably ready.');
      return { owners: attempts.map(claim => claim?.owner ?? null), firstToken: first.token, replacementToken: replacement.token,
        heartbeatExtendedExpiry: true, reopenedConnectionRespectedLease: true, oldHeartbeatRejected: true,
        oldCompletionRejected: true, oldFailureRejected: true, recoveredReady: true };
    }),
  },
  {
    name: 'Retry changes revision/mode and blocks late completion, heartbeat and failure',
    run: () => withQaDatabase('retry', async ({ store, open }) => {
      const item = await importOne(store);
      const second = await open();
      const now = Date.now();
      const old = await store.claimNext('qa-old-retry', now, 60_000);
      assert(old, 'The retry fixture was not claimed.');
      await second.retry(item.id, 'embedded');
      const retried = oneItem(await second.snapshot(), item.id);
      assert(retried.status === 'queued' && retried.revision > old.revision && retried.mode === 'embedded', 'Retry did not queue a new mode and revision.');
      const oldResult = await actualResult();
      assert(!await store.complete(old, oldResult, now + 1), 'A previous-revision result survived retry.');
      assert(!await store.heartbeat(old, now + 1, 1_000), 'A previous-revision heartbeat survived retry.');
      assert(!await store.fail(old, 'late retry error', now + 1), 'A previous-revision failure survived retry.');
      const current = await second.claimNext('qa-new-retry', now + 2, 60_000);
      assert(current?.id === item.id && current.revision === retried.revision, 'The retried revision could not be claimed.');
      const result = await actualResult('embedded');
      assert(await second.complete(current, result, now + 3), 'The new mode/revision did not complete.');
      assert(!await store.fail(old, 'late error after ready', now + 4), 'An obsolete failure replaced a new ready result.');
      const saved = oneItem(await store.snapshot(), item.id);
      assert(saved.status === 'ready' && saved.result?.mode === 'embedded', 'The durable result has the obsolete mode.');
      assert(!await store.getOutput(item.id, old.revision), 'An obsolete revision can read the current output Blob.');
      await equalBlob(await store.getOutput(item.id, current.revision), new TextEncoder().encode(result.svg), 'Saved current-revision SVG bytes differ.');
      await store.retry(item.id, 'pixels');
      const queuedAgain = oneItem(await store.snapshot(), item.id);
      assert(queuedAgain.status === 'queued' && queuedAgain.revision > current.revision && !queuedAgain.result,
        'Retry of a ready result did not remove its old ready metadata.');
      assert(!await store.getOutput(item.id), 'Retry exposes the old mode output while its replacement is pending.');
      return { oldRevision: old.revision, currentRevision: current.revision, currentMode: saved.mode,
        staleMutationsRejected: true, retryOfReadyRemovedOldOutput: true, nextQueuedRevision: queuedAgain.revision };
    }),
  },
  {
    name: 'Cancellation persists and invalidates an in-flight job across connections',
    run: () => withQaDatabase('cancel', async ({ store, open, close }) => {
      const item = await importOne(store);
      const second = await open();
      const now = Date.now();
      const claim = await store.claimNext('qa-cancel-worker', now, 60_000);
      assert(claim, 'The cancellation fixture was not claimed.');
      await second.cancel(item.id);
      assert(!await store.complete(claim, await actualResult(), now + 1), 'A cancelled job committed its late result.');
      assert(!await store.fail(claim, 'late cancelled error', now + 1), 'A cancelled job was overwritten by a late failure.');
      assert(!await store.heartbeat(claim, now + 1, 1_000), 'A cancelled job renewed its lease.');
      close(store); close(second);
      const reopened = await open();
      const cancelled = oneItem(await reopened.snapshot(), item.id);
      assert(cancelled.status === 'cancelled' && cancelled.revision > claim.revision && !cancelled.claim, 'Cancellation was not durably invalidated.');
      assert(!await reopened.claimNext('qa-after-cancel', now + 100_000, 1_000), 'A cancelled item restarted on reopen or lease expiry.');
      assert(!await reopened.getOutput(item.id), 'A cancelled job exposed an SVG output.');
      await equalBlob(await reopened.getSource(item.id), fixtures[0].bytes, 'Cancellation lost the source needed for explicit retry.');
      return { oldRevision: claim.revision, currentRevision: cancelled.revision, persistedStatus: cancelled.status, noAutomaticRestart: true };
    }),
  },
  {
    name: 'Stop-all cancels queued/processing revisions while preserving ready results',
    run: () => withQaDatabase('cancel-all', async ({ store, open }) => {
      const ready = await importOne(store, 'qa-keep-ready.png');
      const now = Date.now();
      const readyClaim = await store.claimNext('qa-ready-before-stop', now, 60_000);
      assert(readyClaim?.id === ready.id, 'The ready stop-all fixture was not claimed.');
      const result = await actualResult();
      assert(await store.complete(readyClaim, result, now + 1), 'The ready stop-all fixture did not complete.');
      const processing = await importOne(store, 'qa-stop-processing.png');
      const old = await store.claimNext('qa-processing-before-stop', now + 2, 60_000);
      assert(old?.id === processing.id, 'The processing stop-all fixture was not claimed.');
      const queued = await importOne(store, 'qa-stop-queued.png');
      const second = await open();
      await second.cancelAll();
      assert(!await store.complete(old, result, now + 3), 'A stopped batch accepted a late processing result.');
      const snapshot = await store.snapshot();
      assert(oneItem(snapshot, ready.id).status === 'ready', 'Stop-all discarded an already ready result.');
      assert(oneItem(snapshot, processing.id).status === 'cancelled' && oneItem(snapshot, queued.id).status === 'cancelled',
        'Stop-all left a queued or processing item eligible.');
      assert(!await second.claimNext('qa-after-stop-all', now + 100_000, 1_000), 'Stopped batch items restarted automatically.');
      await equalBlob(await second.getOutput(ready.id), new TextEncoder().encode(result.svg), 'Stop-all changed a prior ready SVG.');
      return { readyRetained: ready.id, cancelledIds: [processing.id, queued.id], staleCompletionRejected: true, noAutomaticRestart: true };
    }),
  },
  {
    name: 'Deletion prevents resurrection and removes source/output payloads',
    run: () => withQaDatabase('delete', async ({ name, store, open }) => {
      const item = await importOne(store);
      const second = await open();
      const now = Date.now();
      const claim = await store.claimNext('qa-deleted-worker', now, 60_000);
      assert(claim, 'The deletion fixture was not claimed.');
      await second.remove(item.id);
      assert(!await store.complete(claim, await actualResult(), now + 1), 'A deleted job was resurrected by late completion.');
      assert(!await store.fail(claim, 'late deleted error', now + 1), 'A deleted job was resurrected by late failure.');
      assert(!await store.heartbeat(claim, now + 1, 1_000), 'A deleted job accepted a heartbeat.');
      const completedItem = await importOne(store, 'qa-delete-ready.png');
      const completedClaim = await store.claimNext('qa-delete-ready-owner', now + 2, 60_000);
      assert(completedClaim?.id === completedItem.id, 'The ready deletion fixture was not claimed.');
      assert(await store.complete(completedClaim, await actualResult(), now + 3), 'The ready deletion fixture did not complete.');
      assert(await store.getOutput(completedItem.id), 'The ready deletion fixture never persisted an output.');
      await second.remove(completedItem.id);
      const raw = await readRawDatabase(name);
      assert(raw.records.icons.length === 0 && raw.records.sources.length === 0 && raw.records.outputs.length === 0,
        'Deletion left an icon or binary payload row.');
      assert((await second.snapshot()).folders.some(folder => folder.name === 'Uncategorized'), 'Deleting the final item removed the reserved empty folder.');
      return { lateMutationsRejected: true, iconRows: 0, sourceRows: 0, outputRows: 0, reservedFolderRetained: true };
    }),
  },
  {
    name: 'Ready/queued/failed state and exact result metadata survive close/reopen',
    run: () => withQaDatabase('reopen', async ({ store, open, close }) => {
      const ready = await importOne(store, 'qa-ready.png');
      const now = Date.now();
      const readyClaim = await store.claimNext('qa-ready-worker', now, 60_000);
      assert(readyClaim?.id === ready.id, 'The persistence fixture was not claimed.');
      const result = await actualResult();
      assert(result.engine.id === 'pixel-rectangles' && !!result.engine.name && !!result.engine.version,
        'The actual exact-pixel result is missing its engine identity/version.');
      assert(result.verification.browser === navigator.userAgent && Number.isFinite(Date.parse(result.verification.checkedAt)) &&
        result.verification.colorSpace === 'srgb' && result.verification.pixelFormat === 'rgba8',
        'The actual browser check is missing valid timestamp/browser/color-space/pixel-format provenance.');
      assert(await store.complete(readyClaim, result, now + 1), 'A valid result was not saved.');
      const failed = await importOne(store, 'qa-failed.png');
      const failedClaim = await store.claimNext('qa-failed-worker', now + 2, 60_000);
      assert(failedClaim?.id === failed.id, 'The error persistence fixture was not claimed.');
      assert(await store.fail(failedClaim, 'Procedural QA conversion error.', now + 3), 'The current-owner failure was not saved.');
      const queued = await importOne(store, 'qa-queued.png');
      const before = await store.snapshot();
      close(store);
      const reopened = await open();
      const after = await reopened.snapshot();
      assert(JSON.stringify(after) === JSON.stringify(before), 'Reopening changed the durable collection snapshot.');
      const savedReady = oneItem(after, ready.id);
      assert(savedReady.status === 'ready' && JSON.stringify(savedReady.result) === JSON.stringify(resultMetadata(result)),
        'Saved conversion metadata, fidelity or provenance differs from the actual converter result.');
      assert(oneItem(after, failed.id).status === 'error' && oneItem(after, failed.id).message.includes('Procedural QA'), 'The failed item did not survive reopen.');
      assert(oneItem(after, queued.id).status === 'queued', 'The pending item did not survive reopen.');
      await equalBlob(await reopened.getSource(ready.id), fixtures[0].bytes, 'Reopened ready source bytes differ.');
      await equalBlob(await reopened.getOutput(ready.id, readyClaim.revision), new TextEncoder().encode(result.svg), 'Reopened SVG bytes differ from those actually verified.');
      assert(noBlobs(after), 'Reopening eagerly hydrated a result or source Blob into metadata.');
      const resumed = await reopened.claimNext('qa-resume-owner', now + 4, 60_000);
      assert(resumed?.id === queued.id, 'Reopening resumed a failed/ready item instead of the queued item.');
      return { ready: savedReady.id, queued: queued.id, failed: failed.id, savedResultMetadata: savedReady.result,
        exactSourceBytes: true, exactSvgBytes: true, metadataOnly: true, resumedQueuedItemOnly: true };
    }),
  },
];

function setupStorage(content: HTMLElement): void {
  content.innerHTML = `
    <h2>Independent browser storage assertions</h2>
    <p>Each check opens a uniquely named QA database, uses real IndexedDB transactions, then closes its connections and deletes only that QA database.
    Claim tests use independent connections and explicit clocks. SVG persistence uses an actual conversion and native browser fidelity result.</p>
    <p class="boundary">This page establishes storage contracts. A saved "ready" state is checked directly here; visual badges, keyboard behavior,
    operating-system folder gestures and the app's job controller are covered separately by the real application journey.</p>
    <div class="controls"><button id="run-storage">Run storage checks</button><button id="download-storage" disabled>Download report JSON</button></div>
    <p id="storage-status" class="status" role="status">Ready. No checks have run.</p>
    <div class="table-wrap"><table><thead><tr><th>Contract</th><th>Result</th><th>Evidence</th></tr></thead><tbody id="storage-results"></tbody></table></div>
    <h2>Machine-readable evidence</h2><pre id="storage-report">No browser evidence yet.</pre>`;
  const runButton = content.querySelector<HTMLButtonElement>('#run-storage')!;
  const download = content.querySelector<HTMLButtonElement>('#download-storage')!;
  const status = content.querySelector<HTMLElement>('#storage-status')!;
  const table = content.querySelector<HTMLElement>('#storage-results')!;
  const output = content.querySelector<HTMLElement>('#storage-report')!;
  let report: BrowserReport | undefined;
  download.addEventListener('click', () => { if (report) downloadJson(report, 'folio-icon-collection-browser-report.json'); });
  runButton.addEventListener('click', () => void (async () => {
    runButton.disabled = true; download.disabled = true; table.replaceChildren();
    report = { scope: 'Real IndexedDB contract checks on isolated QA databases; procedural PNGs only; no production collection reset',
      startedAt: new Date().toISOString(), browser: navigator.userAgent, devicePixelRatio, passed: 0, failed: 0, checks: [] };
    const unhandled: string[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => { unhandled.push(explain(event.reason)); };
    window.addEventListener('unhandledrejection', onUnhandled);
    try {
      for (const check of storageChecks) {
        status.textContent = `Running ${report.checks.length + 1}/${storageChecks.length}: ${check.name}`;
        const start = performance.now();
        let result: CheckResult;
        try { result = { name: check.name, status: 'pass', durationMs: Math.round(performance.now() - start), details: await check.run() };
          result.durationMs = Math.round(performance.now() - start); }
        catch (error) { result = { name: check.name, status: 'fail', durationMs: Math.round(performance.now() - start), details: { error: explain(error) } }; }
        report.checks.push(result); report[result.status === 'pass' ? 'passed' : 'failed']++;
        const row = document.createElement('tr'); row.dataset.status = result.status;
        for (const value of [result.name, `${result.status.toUpperCase()} · ${result.durationMs} ms`, JSON.stringify(result.details, null, 2)]) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        row.lastElementChild!.classList.add('details'); table.append(row);
        output.textContent = JSON.stringify(report, null, 2);
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      if (unhandled.length) {
        report.checks.push({ name: 'No unhandled promise rejections during native abort/recovery checks', status: 'fail', durationMs: 0, details: unhandled });
        report.failed++;
      }
      report.completedAt = new Date().toISOString();
      output.textContent = JSON.stringify(report, null, 2);
      status.textContent = `${report.passed} passed, ${report.failed} failed. ${report.failed ? 'Review the concrete failures below.' : 'All listed storage contracts passed in this browser.'}`;
      document.title = `${report.failed ? 'FAIL' : 'PASS'} · Folio icon collection storage`;
      download.disabled = false;
    } finally { window.removeEventListener('unhandledrejection', onUnhandled); runButton.disabled = false; }
  })());
}

const content = root.querySelector<HTMLElement>('#check-content')!;
if (document.body.dataset.checkView === 'interactive') setupInteractive(content);
else setupStorage(content);

