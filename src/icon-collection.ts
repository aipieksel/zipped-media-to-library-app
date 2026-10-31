import {createEmbeddedRasterSvg, inspectRaster, rasterMimeHint} from './raster-input';
import {openDB} from 'idb';
import {isSharedWorkspaceEnabled, registerSharedDatabase, resolveSharedRecord, sharedDatabaseName, SHARED_ICONS_DB, subscribeSharedWorkspace, withSharedWrite} from './shared/runtime';
import {sharedIconIdentity, validateSharedIconSvg} from './shared/icon-trust';
import type {DBSchema, IDBPDatabase, IDBPTransaction} from 'idb';
import {uniqueId} from './identity';
import {allocateSvgFilename, PNG_SVG_LIMITS} from './png-svg';
import type {ConversionMode} from './png-svg';
import type {PngSvgFidelity, PngSvgResult} from './png-svg-browser';
import {recolorSvg, sanitizeSvg} from './saved-svg';
import {ICON_IMPORT_LIMITS, isIconRasterInput, normalizeIconPath} from './icon-drop';
import type {IconClaim, IconCollectionSnapshot, IconFolder, IconImportBatch, IconImportFile, IconImportReport, IconJob, IconPreferences, IconRecord, IconTreeProjection, SaveArtworkInput, SavedIconRecord, SavedIconSource, SavedIconVerification} from './icon-types';
import type {HtmlPage, TreeNode} from './types';

export type * from './icon-types';
export const ICON_DB_NAME = 'folio-icons';
export const ICON_DB_VERSION = 2;
export const UNCATEGORIZED_ICON_FOLDER_ID = 'icon-folder-uncategorized';
export const ICON_LEASE_MS = 30_000;
export const ICON_HEARTBEAT_MS = 8_000;

interface IconSource {id: string; blob: Blob}
interface IconOutput {id: string; revision: number; blob: Blob}
interface SavedSvg {id: string; revision: number; base: Blob; output: Blob}
interface IconSchema extends DBSchema {
  icons: {key: string; value: IconRecord; indexes: {byFolder: string; byStatus: string}};
  folders: {key: string; value: IconFolder};
  sources: {key: string; value: IconSource};
  outputs: {key: string; value: IconOutput};
  savedIcons: {key: string; value: SavedIconRecord; indexes: {byFolder: string}};
  savedSvg: {key: string; value: SavedSvg};
  savedSources: {key: string; value: IconSource};
  prefs: {key: string; value: {key: string; value: IconPreferences}};
}
type StoreName = 'icons' | 'folders' | 'sources' | 'outputs' | 'prefs' | 'savedIcons' | 'savedSvg' | 'savedSources';
type WriteTransaction = IDBPTransaction<IconSchema, StoreName[], 'readwrite'>;
const natural = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});
const nameKey = (name: string) => name.normalize('NFC').toLowerCase();
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const modeNames = ['pixels', 'embedded', 'smooth'];

export function normalizeIconPreferences(value?: Partial<IconPreferences>): IconPreferences {
  const sort = value?.order?.sort;
  const group = value?.order?.group;
  return {
    view: value?.view === 'saved' ? 'saved' : 'convert',
    selectedId: typeof value?.selectedId === 'string' && value.selectedId.length <= 256 ? value.selectedId : null,
    savedSelectedId: typeof value?.savedSelectedId === 'string' && value.savedSelectedId.length <= 256 ? value.savedSelectedId : null,
    expanded: Array.isArray(value?.expanded) ? [...new Set(value.expanded.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256))].slice(0, 50_000) : [UNCATEGORIZED_ICON_FOLDER_ID],
    order: {sort: sort && ['name-asc', 'name-desc', 'newest', 'oldest', 'largest', 'smallest'].includes(sort) ? sort : 'name-asc', group: group && ['folders', 'month', 'all'].includes(group) ? group : 'folders'},
    defaultMode: modeNames.includes(value?.defaultMode ?? '') ? value!.defaultMode! : 'pixels',
    zoom: value?.zoom && ['fit', '1', '2', '4'].includes(value.zoom) ? value.zoom : '1',
    background: value?.background && ['checker', 'light', 'dark'].includes(value.background) ? value.background : 'checker',
  };
}

export const emptyIconSnapshot = (): IconCollectionSnapshot => ({items: [], saved: [], folders: [], preferences: normalizeIconPreferences()});

function assertMode(mode: ConversionMode): void {
  if (!modeNames.includes(mode)) throw new Error('Choose a supported icon conversion mode.');
}

/** Shared sibling namespace: a folder and an icon cannot silently shadow each other. */
export function allocateIconName(source: string, used: Set<string>, file = false): string {
  let clean = source.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g, '_').trim().replace(/[. ]+$/g, '');
  if (!clean || /^\.+$/.test(clean)) clean = file ? 'icon.png' : 'Folder';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)) clean = '_' + clean;
  clean = Array.from(clean).slice(0, 150).join('');
  const extension = file ? /\.[^.]+$/.exec(clean)?.[0] ?? '' : '';
  const stem = extension ? clean.slice(0, -extension.length) : clean;
  const keys = new Set([...used].map(nameKey));
  let name = clean;
  let suffix = 2;
  while (keys.has(nameKey(name))) name = `${stem} (${suffix++})${extension}`;
  used.add(nameKey(name));
  return name;
}

interface PreparedImport extends IconImportBatch {files: IconImportFile[]; notices: string[]; skipped: number}

/** Bound accepted bytes and all discovered paths before opening an IDB transaction. */
export function prepareIconImport(batch: IconImportBatch): PreparedImport {
  if (!batch || !Array.isArray(batch.files) || !Array.isArray(batch.directories)) throw new Error('The icon import is invalid.');
  if (batch.files.length + batch.directories.length > ICON_IMPORT_LIMITS.maxEntries) throw new Error(`An import can contain at most ${ICON_IMPORT_LIMITS.maxEntries.toLocaleString()} discovered entries. Choose a smaller folder.`);
  const notices = (batch.notices ?? []).filter(value => typeof value === 'string').slice(0, 30);
  let skipped = Number.isSafeInteger(batch.skipped) && batch.skipped! > 0 ? batch.skipped! : 0;
  let sourceBytes = 0;
  const files: IconImportFile[] = [];
  const roots = new Map<string, string>();
  const validateRoot = (rootKey: string, path: string) => {
    if (typeof rootKey !== 'string' || !rootKey || rootKey.length > 256 || /\0/.test(rootKey)) throw new Error('A dropped directory has an invalid root identity.');
    const top = path.split('/')[0];
    if (roots.has(rootKey) && roots.get(rootKey) !== top) throw new Error('A dropped directory has conflicting root paths.');
    roots.set(rootKey, top);
  };
  const directories = batch.directories.map(directory => {
    const relativePath = normalizeIconPath(directory.relativePath);
    validateRoot(directory.rootKey, relativePath);
    return {relativePath, rootKey: directory.rootKey};
  });
  for (const entry of batch.files) {
    const file = entry.file;
    if (!(file instanceof Blob) || typeof file.name !== 'string') throw new Error('An icon source is not a local file.');
    const relativePath = normalizeIconPath(entry.relativePath);
    if (entry.rootKey !== undefined) {
      validateRoot(entry.rootKey, relativePath);
      if (!relativePath.includes('/')) throw new Error('A directory file must retain its root folder path.');
    } else if (relativePath.includes('/')) throw new Error('A nested file is missing its directory root identity.');
    let reason = '';
    if (!isIconRasterInput(file)) reason = 'Only PNG and WebP files are added to Icons.';
    else if (file.size > PNG_SVG_LIMITS.maxInputBytes) reason = 'The image exceeds the 20 MiB per-file limit.';
    else if (files.length >= ICON_IMPORT_LIMITS.maxFiles || sourceBytes + file.size > ICON_IMPORT_LIMITS.maxSourceBytes) reason = 'Each import accepts up to 100 PNG or WebP files and 100 MiB of original bytes.';
    if (reason) {
      skipped++;
      if (notices.length < 30) notices.push(`${file.name}: ${reason}`);
      continue;
    }
    files.push({...entry, relativePath});
    sourceBytes += file.size;
  }
  return {files, directories, notices, skipped};
}

/** A claim expires independently of JavaScript closures, including sleeping tabs. */
export function isCurrentIconClaim(item: IconRecord | undefined, claim: IconClaim, now: number): boolean {
  return !!item && item.status === 'processing' && item.id === claim.id && item.revision === claim.revision &&
    item.claim?.owner === claim.owner && item.claim?.token === claim.token && item.claim.expiresAt > now;
}

function checkLease(owner: string, now: number, leaseMs: number): void {
  if (!owner || owner.length > 256 || !validTime(now) || !Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 300_000 || !Number.isSafeInteger(now + leaseMs)) throw new Error('Invalid icon job lease.');
}

function resultBlob(result: PngSvgResult): Blob {
  if (!result || typeof result.svg !== 'string') throw new Error('The converter did not return an SVG.');
  const blob = new Blob([result.svg], {type: 'image/svg+xml'});
  if (!blob.size || blob.size > PNG_SVG_LIMITS.maxSvgBytes || result.outputBytes !== blob.size) throw new Error('The SVG has invalid output metadata or exceeds the 24 MiB limit.');
  if (![result.width, result.height].every(value => Number.isSafeInteger(value) && value > 0 && value <= PNG_SVG_LIMITS.maxSide) || result.width * result.height > PNG_SVG_LIMITS.maxPixels) throw new Error('The SVG dimensions are invalid.');
  const fidelity = result.fidelity;
  if (!fidelity || fidelity.totalPixels !== result.width * result.height || !['verified', 'different', 'unavailable'].includes(fidelity.status)) throw new Error('The saved pixel-check metadata is invalid.');
  if (fidelity.status === 'unavailable' ? fidelity.differingPixels !== null : !Number.isSafeInteger(fidelity.differingPixels) || fidelity.differingPixels! < 0 || fidelity.differingPixels! > fidelity.totalPixels || (fidelity.status === 'verified') !== (fidelity.differingPixels === 0)) throw new Error('The saved pixel-check count is inconsistent.');
  // Provenance is emitted by every converter mode. Do not synthesize a fresh check here.
  const provenance = result as PngSvgResult & {engine?: {id: string; name: string; version: string}; verification?: {checkedAt: string; browser: string; colorSpace: string; pixelFormat: string}};
  if (!provenance.engine?.id || !provenance.engine.name || !provenance.engine.version || !provenance.verification?.checkedAt || !Number.isFinite(Date.parse(provenance.verification.checkedAt)) || !provenance.verification.browser || provenance.verification.colorSpace !== 'srgb' || provenance.verification.pixelFormat !== 'rgba8') throw new Error('The converter result is missing its saved verification provenance.');
  return blob;
}

const unchecked = (width: number, height: number, reason = 'This SVG has not been checked at native dimensions.'): PngSvgFidelity => ({status: 'unavailable', differingPixels: null, totalPixels: width * height, reason});
function savedCheck(fidelity: PngSvgFidelity | undefined, verification: SavedIconVerification | undefined, width: number, height: number): {fidelity: PngSvgFidelity; verification?: SavedIconVerification} {
  if (!fidelity) return {fidelity: unchecked(width, height)};
  if (fidelity.totalPixels !== width * height || !['verified', 'different', 'unavailable'].includes(fidelity.status) ||
    (fidelity.status === 'unavailable' ? fidelity.differingPixels !== null : !Number.isSafeInteger(fidelity.differingPixels) || fidelity.differingPixels! < 0 || fidelity.differingPixels! > fidelity.totalPixels || (fidelity.status === 'verified') !== (fidelity.differingPixels === 0))) throw new Error('The saved artwork pixel-check metadata is inconsistent.');
  if (fidelity.status !== 'unavailable' && !verification) throw new Error('A saved pixel check requires its actual browser and check time.');
  if (verification && (typeof verification.checkedAt !== 'string' || !Number.isFinite(Date.parse(verification.checkedAt)) || typeof verification.browser !== 'string' || !verification.browser || verification.browser.length > 1000 || verification.colorSpace !== 'srgb' || verification.pixelFormat !== 'rgba8')) throw new Error('The saved artwork verification provenance is invalid.');
  return {fidelity: {...fidelity, ...(fidelity.reason ? {reason: String(fidelity.reason).slice(0, 2000)} : {})}, ...(verification ? {verification: {...verification}} : {})};
}
function checkSavedRevision(revision: number): void {if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Choose a current saved artwork revision.');}
async function sourceSnapshot(source: SaveArtworkInput['source'], width: number, height: number): Promise<{metadata: SavedIconSource; blob: Blob}> {
  if (!source || !['icons', 'images'].includes(source.kind) || typeof source.id !== 'string' || !source.id || source.id.length > 256 || typeof source.name !== 'string' || !source.name || source.name.length > 2000 || !['image/png', 'image/webp', 'image/jpeg'].includes(source.mime) || !(source.blob instanceof Blob) || !source.blob.size || source.blob.size > PNG_SVG_LIMITS.maxInputBytes) throw new Error('The saved artwork requires a supported original image snapshot of up to 20 MiB.');
  if (source.revision !== undefined) checkSavedRevision(source.revision);
  const bytes = new Uint8Array(await source.blob.arrayBuffer());
  if (source.mime === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('The saved JPEG source signature is invalid.');
  } else {
    const metadata = inspectRaster(bytes);
    if (metadata.mime !== source.mime || metadata.width !== width || metadata.height !== height) throw new Error('The saved source format or dimensions do not match the artwork.');
  }
  return {metadata: {kind: source.kind, id: source.id, ...(source.revision !== undefined ? {revision: source.revision} : {}), name: source.name, mime: source.mime, size: source.blob.size}, blob: source.blob.slice(0, source.blob.size, source.mime)};
}
interface PreparedArtwork {
  name: string;
  folderId?: string;
  source: SavedIconSource;
  sourceBlob: Blob;
  base: Blob;
  width: number;
  height: number;
  provenance: SavedIconRecord['provenance'];
  recolorable: boolean;
  fidelity: PngSvgFidelity;
  verification?: SavedIconVerification;
  /** A local source may change while parsing; the final atomic write checks it again. */
  currentIcon?: {id: string; revision: number; requireReady: boolean};
}

/** Existing operations use a separate authenticated shared cache when that workspace is active. */
export class IconCollectionStore {
  private readonly listeners = new Set<() => void>();
  private readonly channel?: BroadcastChannel;
  private closed = false;
  private readonly unsubscribeShared: () => void;
  private readonly sharedChecks = new Map<string, {fidelity: PngSvgFidelity; verification?: SavedIconVerification}>();
  private readonly servedSaved = new Map<string, string>();
  private readonly checkAbort = new AbortController();

  constructor(private readonly db: IDBPDatabase<IconSchema>, readonly name: string) {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`folio-icons-change:${name}`);
      this.channel.onmessage = () => {for (const listener of this.listeners) listener();};
    }
    this.unsubscribeShared = subscribeSharedWorkspace(change => {if (change.icons && name === SHARED_ICONS_DB) this.announce();});
  }

  subscribe(listener: () => void): () => void {this.listeners.add(listener); return () => {this.listeners.delete(listener);};}
  close(): void {this.closed = true; this.checkAbort.abort(); this.sharedChecks.clear(); this.servedSaved.clear(); this.unsubscribeShared(); this.channel?.close(); this.listeners.clear(); this.db.close();}
  private announce(): void {if (this.closed) return; this.channel?.postMessage('changed'); for (const listener of this.listeners) listener();}

  private async write<T>(stores: StoreName[], action: (tx: WriteTransaction) => Promise<T>, announce = true, share = true): Promise<T> {
    if (this.closed) throw new Error('The local Icons collection is closed. Reload to reopen it.');
    const perform = async (db: IDBPDatabase<IconSchema>) => {
      const tx = db.transaction(stores, 'readwrite');
      try {const value = await action(tx); await tx.done; return value;}
      catch (error) {try {tx.abort();} catch { /* IndexedDB may already have aborted. */ } await tx.done.catch(() => undefined); throw error;}
    };
    // Claims, heartbeat, release and view preferences are device work, not shared edits.
    const value = share && announce && stores.some(name => name !== 'prefs') ? await withSharedWrite('icons', this.db, perform) : await perform(this.db);
    if (announce) this.announce();
    return value;
  }

  async snapshot(): Promise<IconCollectionSnapshot> {
    const tx = this.db.transaction(['icons', 'savedIcons', 'folders', 'prefs', 'sources', 'outputs', 'savedSources', 'savedSvg'], 'readonly');
    const [items, saved, folders, prefs] = await Promise.all([tx.objectStore('icons').getAll(), tx.objectStore('savedIcons').getAll(), tx.objectStore('folders').getAll(), tx.objectStore('prefs').get('workspace')]);
    if (this.name === SHARED_ICONS_DB) {
      for (const item of items) if (item.result) {
        const [source, output] = await Promise.all([tx.objectStore('sources').get(item.id), tx.objectStore('outputs').get(item.id)]);
        const check = this.sharedChecks.get(sharedIconIdentity(item, source, output));
        item.result = {...item.result, fidelity: check?.fidelity ?? unchecked(item.result.width, item.result.height, 'Open this icon to check its shared SVG bytes in this browser.'), verification: check?.verification as PngSvgResult['verification']};
      }
      for (const item of saved) {
        const [source, output] = await Promise.all([tx.objectStore('savedSources').get(item.id), tx.objectStore('savedSvg').get(item.id)]);
        const check = this.sharedChecks.get(sharedIconIdentity(item, source, output));
        item.fidelity = check?.fidelity ?? unchecked(item.width, item.height, 'This shared SVG will be checked in this browser when opened.');
        item.verification = check?.verification;
      }
    }
    await tx.done;
    items.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    folders.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    saved.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    return {items, saved, folders, preferences: normalizeIconPreferences(prefs?.value)};
  }

  async getSource(id: string): Promise<Blob | undefined> {
    const tx = this.db.transaction(['icons', 'sources'], 'readonly');
    const [item, source] = await Promise.all([tx.objectStore('icons').getKey(id), tx.objectStore('sources').get(id)]);
    await tx.done;
    return item && source ? (await resolveSharedRecord(source)).blob : undefined;
  }

  async getOutput(id: string, revision?: number): Promise<Blob | undefined> {
    const tx = this.db.transaction(['icons', 'outputs', 'sources'], 'readonly');
    const [item, output, source] = await Promise.all([tx.objectStore('icons').get(id), tx.objectStore('outputs').get(id), tx.objectStore('sources').get(id)]);
    await tx.done;
    if (item?.status !== 'ready' || !item.result || output?.revision !== item.revision || revision !== undefined && revision !== item.revision) return undefined;
    const resolved = await resolveSharedRecord(output);
    if (this.name === SHARED_ICONS_DB) {
      if (!source) throw new Error('The shared artwork source is missing.');
      const original = await resolveSharedRecord(source), key = sharedIconIdentity(item, source, output);
      const svg = await validateSharedIconSvg(resolved.blob, original.blob, item);
      if (!this.sharedChecks.has(key)) {
        try {
          const {checkArtworkPixels} = await import('./ai/fidelity');
          this.sharedChecks.set(key, await checkArtworkPixels(svg, original.blob, item.result.width, item.result.height, this.checkAbort.signal));
        } catch (error) {
          if (this.checkAbort.signal.aborted) throw error;
          this.sharedChecks.set(key, {fidelity: unchecked(item.result.width, item.result.height, error instanceof Error ? error.message : 'The native pixel check could not run.')});
        }
        this.announce();
      }
    }
    return resolved.blob;
  }

  async getSavedOutput(id: string, revision?: number): Promise<Blob | undefined> {
    const tx = this.db.transaction(['savedIcons', 'savedSvg', 'savedSources'], 'readonly');
    const [item, svg, source] = await Promise.all([tx.objectStore('savedIcons').get(id), tx.objectStore('savedSvg').get(id), tx.objectStore('savedSources').get(id)]);
    await tx.done;
    if (!item || svg?.revision !== item.revision || revision !== undefined && revision !== item.revision) return undefined;
    const resolved = await resolveSharedRecord(svg);
    if (this.name === SHARED_ICONS_DB) {
      if (!source) throw new Error('The shared artwork source is missing.');
      await validateSharedIconSvg(resolved.output, (await resolveSharedRecord(source)).blob, item);
      this.servedSaved.set(id, sharedIconIdentity(item, source, svg));
    }
    return resolved.output;
  }

  async getSavedSource(id: string): Promise<Blob | undefined> {
    const tx = this.db.transaction(['savedIcons', 'savedSources'], 'readonly');
    const [item, source] = await Promise.all([tx.objectStore('savedIcons').getKey(id), tx.objectStore('savedSources').get(id)]);
    await tx.done;
    return item && source ? (await resolveSharedRecord(source)).blob : undefined;
  }

  private async commitArtwork(input: PreparedArtwork): Promise<SavedIconRecord> {
    return this.write(['icons', 'sources', 'outputs', 'folders', 'savedIcons', 'savedSvg', 'savedSources', 'prefs'], async tx => {
      if (input.currentIcon) {
        const current = await tx.objectStore('icons').get(input.currentIcon.id);
        if (!current || current.revision !== input.currentIcon.revision || input.currentIcon.requireReady && (current.status !== 'ready' || !current.result || !await tx.objectStore('outputs').getKey(current.id)) || !await tx.objectStore('sources').getKey(current.id)) throw new Error('The original icon changed or was removed before saving. Review the current result and try again.');
      }
      const folderId = input.folderId ?? UNCATEGORIZED_ICON_FOLDER_ID;
      if (!await tx.objectStore('folders').getKey(folderId)) throw new Error('The destination folder was removed. Choose another folder.');
      const existing = await tx.objectStore('savedIcons').getAll();
      const filename = allocateSvgFilename(input.name.replace(/\.(?:svg|jpe?g)$/i, ''), new Set(existing.map(item => item.filename)));
      const names = new Set(existing.filter(item => item.folderId === folderId).map(item => item.name));
      for (const folder of await tx.objectStore('folders').getAll()) if (folder.parentId === folderId) names.add(folder.name);
      const now = Date.now(), id = `saved-icon-${uniqueId()}`;
      const item: SavedIconRecord = {id, folderId, name: allocateIconName(filename, names, true), filename, createdAt: now, updatedAt: now, favorite: false, revision: 1, width: input.width, height: input.height, outputBytes: input.base.size, baseOutputBytes: input.base.size, source: input.source, provenance: input.provenance, recolorable: input.recolorable, color: null, fidelity: input.fidelity, verification: input.verification, baseFidelity: input.fidelity, baseVerification: input.verification};
      await tx.objectStore('savedSources').add({id, blob: input.sourceBlob});
      await tx.objectStore('savedSvg').add({id, revision: 1, base: input.base, output: input.base});
      await tx.objectStore('savedIcons').add(item);
      const preferences = normalizeIconPreferences((await tx.objectStore('prefs').get('workspace'))?.value);
      await tx.objectStore('prefs').put({key: 'workspace', value: {...preferences, savedSelectedId: id, expanded: [...new Set([...preferences.expanded, folderId])]}});
      return item;
    });
  }

  /** Only a current successful local conversion may save its trusted embedded bitmap wrapper. */
  async saveConverted(id: string, expectedRevision: number): Promise<SavedIconRecord> {
    checkSavedRevision(expectedRevision);
    const tx = this.db.transaction(['icons', 'sources', 'outputs'], 'readonly');
    let [item, source, output] = await Promise.all([tx.objectStore('icons').get(id), tx.objectStore('sources').get(id), tx.objectStore('outputs').get(id)]);
    await tx.done;
    if (!item || item.revision !== expectedRevision || item.status !== 'ready' || !item.result || !source || output?.revision !== expectedRevision) throw new Error('Choose a current successful conversion before saving.');
    source = await resolveSharedRecord(source); output = await resolveSharedRecord(output);
    if (output.blob.size > PNG_SVG_LIMITS.maxSvgBytes) throw new Error('The saved SVG exceeds the output limit.');
    const svg = await output.blob.text(), result = item.result;
    resultBlob({...result, svg});
    const mime = result.sourceFormat === 'webp' || item.sourceMime === 'image/webp' ? 'image/webp' : 'image/png';
    const captured = await sourceSnapshot({kind: 'icons', id, revision: expectedRevision, name: item.sourceName, mime, blob: source.blob}, result.width, result.height);
    if (item.mode === 'embedded') {
      const expected = createEmbeddedRasterSvg(new Uint8Array(await captured.blob.arrayBuffer()), result.width, result.height);
      if (svg !== expected) throw new Error('The embedded SVG does not contain the exact saved original bytes.');
    } else sanitizeSvg(svg, {width: result.width, height: result.height, profile: 'local-vector'});
    // Keep the already-verified converter string exactly, even if canonical attribute order would differ.
    return this.commitArtwork({name: item.filename, folderId: item.folderId, source: captured.metadata, sourceBlob: captured.blob, base: new Blob([svg], {type: 'image/svg+xml;charset=utf-8'}), width: result.width, height: result.height, provenance: {kind: 'conversion', mode: item.mode, engine: {...result.engine}}, recolorable: item.mode !== 'embedded', ...savedCheck(result.fidelity, result.verification, result.width, result.height), currentIcon: {id, revision: expectedRevision, requireReady: true}});
  }

  /** Generic/AI artwork accepts vector geometry only; it cannot opt into trusted embedded content. */
  async saveArtwork(input: SaveArtworkInput): Promise<SavedIconRecord> {
    if (!input || typeof input.name !== 'string' || !input.name || input.name.length > 2000 || input.provenance?.kind !== 'ai' || typeof input.provenance.provider !== 'string' || !input.provenance.provider || input.provenance.provider.length > 100 || typeof input.provenance.model !== 'string' || !input.provenance.model || input.provenance.model.length > 200 || input.provenance.generatedAt !== undefined && (!Number.isFinite(Date.parse(input.provenance.generatedAt)))) throw new Error('The AI artwork metadata is invalid.');
    const result = sanitizeSvg(input.svg, {width: input.width, height: input.height, profile: 'ai'});
    let source = input.source, currentIcon: PreparedArtwork['currentIcon'];
    if (source?.kind === 'icons') {
      if (source.revision === undefined) throw new Error('The source conversion revision is required.');
      const tx = this.db.transaction(['icons', 'sources'], 'readonly');
      const [item, original] = await Promise.all([tx.objectStore('icons').get(source.id), tx.objectStore('sources').get(source.id)]);
      await tx.done;
      if (!item || item.revision !== source.revision || !original) throw new Error('The original icon changed or was removed.');
      source = {...source, name: item.sourceName, mime: item.sourceMime ?? 'image/png', blob: (await resolveSharedRecord(original)).blob};
      currentIcon = {id: item.id, revision: item.revision, requireReady: false};
    }
    const captured = await sourceSnapshot(source, input.width, input.height);
    const check = result.svg === input.svg ? savedCheck(input.fidelity, input.verification, input.width, input.height) : {fidelity: unchecked(input.width, input.height, 'The SVG was normalized. A fresh native pixel check is required.')};
    return this.commitArtwork({name: input.name, folderId: input.folderId, source: captured.metadata, sourceBlob: captured.blob, base: new Blob([result.svg], {type: 'image/svg+xml;charset=utf-8'}), width: input.width, height: input.height, provenance: {...input.provenance}, recolorable: true, ...check, currentIcon});
  }

  async recolorSaved(id: string, color: string | null, expectedRevision: number): Promise<SavedIconRecord> {
    checkSavedRevision(expectedRevision);
    const tx = this.db.transaction(['savedIcons', 'savedSvg'], 'readonly');
    let [item, svg] = await Promise.all([tx.objectStore('savedIcons').get(id), tx.objectStore('savedSvg').get(id)]);
    await tx.done;
    if (!item || !svg || item.revision !== expectedRevision || svg.revision !== expectedRevision) throw new Error('The saved artwork changed. Reload its current version and try again.');
    svg = await resolveSharedRecord(svg);
    if (!item.recolorable && color !== null) throw new Error('This SVG contains an embedded bitmap. Only vector artwork can be recolored.');
    const normalizedColor = color === null ? null : typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : undefined;
    if (normalizedColor === undefined) throw new Error('Choose a six-digit hex color.');
    if (item.color === normalizedColor) return item;
    const output = normalizedColor === null ? svg.base : new Blob([recolorSvg(await svg.base.text(), normalizedColor, {width: item.width, height: item.height, profile: item.provenance.kind === 'ai' ? 'ai' : 'local-vector'}).svg], {type: 'image/svg+xml;charset=utf-8'});
    return this.write(['savedIcons', 'savedSvg'], async write => {
      const current = await write.objectStore('savedIcons').get(id);
      if (!current || current.revision !== expectedRevision) throw new Error('The saved artwork changed while preparing its color. Try again.');
      const next: SavedIconRecord = {...current, revision: current.revision + 1, color: normalizedColor, outputBytes: output.size, updatedAt: Date.now(), fidelity: normalizedColor === null ? current.baseFidelity : unchecked(current.width, current.height, 'Color changed. This variant has not been checked against its original image.'), verification: normalizedColor === null ? current.baseVerification : undefined};
      await write.objectStore('savedSvg').put({...svg, revision: next.revision, output});
      await write.objectStore('savedIcons').put(next);
      return next;
    });
  }

  /** A native browser check may only stamp the exact saved content revision it rendered. */
  async recordSavedVerification(id: string, expectedRevision: number, fidelity: PngSvgFidelity, verification: SavedIconVerification): Promise<boolean> {
    checkSavedRevision(expectedRevision);
    if (this.name === SHARED_ICONS_DB) {
      const tx = this.db.transaction(['savedIcons', 'savedSvg', 'savedSources'], 'readonly');
      const [item, svg, source] = await Promise.all([tx.objectStore('savedIcons').get(id), tx.objectStore('savedSvg').get(id), tx.objectStore('savedSources').get(id)]);
      await tx.done;
      if (!item || item.revision !== expectedRevision || svg?.revision !== expectedRevision || !source) return false;
      const identity = sharedIconIdentity(item, source, svg);
      if (identity !== this.servedSaved.get(id)) return false;
      this.sharedChecks.set(identity, savedCheck(fidelity, verification, item.width, item.height));
      this.announce(); return true;
    }
    return this.write(['savedIcons', 'savedSvg'], async tx => {
      const item = await tx.objectStore('savedIcons').get(id), svg = await tx.objectStore('savedSvg').get(id);
      if (!item || item.revision !== expectedRevision || svg?.revision !== expectedRevision) return false;
      const check = savedCheck(fidelity, verification, item.width, item.height);
      await tx.objectStore('savedIcons').put({...item, ...check, ...(item.color === null ? {baseFidelity: check.fidelity, baseVerification: check.verification} : {})});
      return true;
    });
  }

  async removeSaved(id: string): Promise<void> {
    await this.write(['savedIcons', 'savedSvg', 'savedSources', 'prefs'], async tx => {
      await tx.objectStore('savedIcons').delete(id); await tx.objectStore('savedSvg').delete(id); await tx.objectStore('savedSources').delete(id);
      const preferences = normalizeIconPreferences((await tx.objectStore('prefs').get('workspace'))?.value);
      if (preferences.savedSelectedId === id) await tx.objectStore('prefs').put({key: 'workspace', value: {...preferences, savedSelectedId: null}});
    });
  }

  async moveSaved(id: string, folderId: string): Promise<SavedIconRecord> {
    return this.write(['savedIcons', 'folders'], async tx => {
      const item = await tx.objectStore('savedIcons').get(id);
      if (!item) throw new Error('This saved artwork was removed.');
      if (!await tx.objectStore('folders').getKey(folderId)) throw new Error('Choose an existing icon folder.');
      if (item.folderId === folderId) return item;
      const names = new Set((await tx.objectStore('savedIcons').index('byFolder').getAll(folderId)).map(other => other.name));
      for (const folder of await tx.objectStore('folders').getAll()) if (folder.parentId === folderId) names.add(folder.name);
      const next = {...item, folderId, name: allocateIconName(item.name, names, true), updatedAt: Date.now()};
      await tx.objectStore('savedIcons').put(next); return next;
    });
  }

  async setSavedFavorite(id: string, favorite: boolean): Promise<void> {
    if (typeof favorite !== 'boolean') throw new Error('Invalid artwork favorite.');
    await this.write(['savedIcons'], async tx => {
      const item = await tx.objectStore('savedIcons').get(id);
      if (!item) throw new Error('This saved artwork was removed.');
      await tx.objectStore('savedIcons').put({...item, favorite});
    });
  }

  async importEntries(batch: IconImportBatch, mode: ConversionMode = 'pixels'): Promise<IconImportReport> {
    assertMode(mode);
    const prepared = prepareIconImport(batch);
    return this.write(['icons', 'folders', 'sources', 'prefs'], async tx => {
      const [existingItems, existingFolders, storedPrefs] = await Promise.all([tx.objectStore('icons').getAll(), tx.objectStore('folders').getAll(), tx.objectStore('prefs').get('workspace')]);
      const folders = new Map(existingFolders.map(folder => [folder.id, folder]));
      const siblingNames = new Map<string | null, Set<string>>();
      const namesAt = (parent: string | null): Set<string> => {
        let names = siblingNames.get(parent);
        if (!names) {names = new Set(); siblingNames.set(parent, names);}
        return names;
      };
      for (const folder of existingFolders) namesAt(folder.parentId).add(nameKey(folder.name));
      for (const item of existingItems) namesAt(item.folderId).add(nameKey(item.name));
      const outputNames = new Set(existingItems.map(item => item.filename));
      const importedFolders = new Map<string, string>();
      const createdFolders: IconFolder[] = [];
      const now = Date.now();
      const ensureFolder = (rootKey: string, path: string): string => {
        let parentId: string | null = null;
        const segments = path.split('/');
        for (let index = 0; index < segments.length; index++) {
          const key = `${rootKey}\0${segments.slice(0, index + 1).join('/')}`;
          let id = importedFolders.get(key);
          if (!id) {
            id = `icon-folder-${uniqueId()}`;
            const folder: IconFolder = {id, parentId, name: allocateIconName(segments[index], namesAt(parentId)), createdAt: now, favorite: false};
            importedFolders.set(key, id); folders.set(id, folder); createdFolders.push(folder);
          }
          parentId = id;
        }
        return parentId!;
      };
      for (const directory of prepared.directories) ensureFolder(directory.rootKey, directory.relativePath);
      const added: IconRecord[] = [];
      const sources: IconSource[] = [];
      for (const entry of prepared.files) {
        const parts = entry.relativePath.split('/');
        const folderId = entry.rootKey ? ensureFolder(entry.rootKey, parts.slice(0, -1).join('/')) : UNCATEGORIZED_ICON_FOLDER_ID;
        if (!folders.has(folderId)) throw new Error('The default icon folder is unavailable. Reload and retry.');
        const id = `icon-${uniqueId()}`;
        const item: IconRecord = {
          id, folderId, name: allocateIconName(parts.at(-1)!, namesAt(folderId), true), sourceName: entry.file.name, sourceMime: rasterMimeHint(entry.file),
          sourcePath: entry.relativePath, filename: allocateSvgFilename(entry.file.name, outputNames), size: entry.file.size,
          lastModified: validTime(entry.file.lastModified) ? entry.file.lastModified : 0, createdAt: now, updatedAt: now,
          mode, revision: 1, status: 'queued', message: isSharedWorkspaceEnabled() ? 'Saved to workspace · waiting to convert…' : 'Saved locally · waiting to convert…', favorite: false,
        };
        added.push(item); sources.push({id, blob: entry.file.slice(0, entry.file.size, rasterMimeHint(entry.file))});
      }
      // The write order is deliberate: aborting any later write rolls back folders and sources.
      for (const folder of createdFolders) await tx.objectStore('folders').add(folder);
      for (const source of sources) await tx.objectStore('sources').add(source);
      for (const item of added) await tx.objectStore('icons').add(item);
      const prefs = normalizeIconPreferences(storedPrefs?.value);
      if (added.length || createdFolders.length) await tx.objectStore('prefs').put({key: 'workspace', value: normalizeIconPreferences({...prefs, selectedId: added[0]?.id ?? prefs.selectedId, expanded: [...new Set([...prefs.expanded, ...createdFolders.map(folder => folder.id), UNCATEGORIZED_ICON_FOLDER_ID])]})});
      return {added, folders: createdFolders, skipped: prepared.skipped, notices: prepared.notices};
    });
  }

  async claimNext(owner: string, now = Date.now(), leaseMs = ICON_LEASE_MS): Promise<IconJob | undefined> {
    checkLease(owner, now, leaseMs);
    let changed = false;
    const job = await this.write(['icons'], async tx => {
      const items = await tx.objectStore('icons').getAll();
      // One live worker across this local collection, even when it is open in two tabs.
      if (items.some(item => item.status === 'processing' && item.claim && item.claim.expiresAt > now)) return undefined;
      const eligible = items.filter(item => item.status === 'queued' || item.status === 'processing' && (!item.claim || item.claim.expiresAt <= now));
      eligible.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      const previous = eligible[0];
      if (!previous) return undefined;
      const claim = {owner, token: uniqueId(), expiresAt: now + leaseMs};
      const item: IconRecord = {...previous, status: 'processing', message: 'Reading saved image…', updatedAt: now, claim};
      await tx.objectStore('icons').put(item); changed = true;
      return {id: item.id, revision: item.revision, ...claim, item};
    }, false);
    if (changed) this.announce();
    return job;
  }

  async heartbeat(claim: IconClaim, now = Date.now(), leaseMs = ICON_LEASE_MS): Promise<boolean> {
    checkLease(claim.owner, now, leaseMs);
    return this.write(['icons'], async tx => {
      const item = await tx.objectStore('icons').get(claim.id);
      if (!isCurrentIconClaim(item, claim, now)) return false;
      await tx.objectStore('icons').put({...item!, claim: {...item!.claim!, expiresAt: now + leaseMs}});
      return true;
    }, false);
  }

  async complete(claim: IconClaim, result: PngSvgResult, now = Date.now()): Promise<boolean> {
    const blob = resultBlob(result);
    return this.write(['icons', 'outputs'], async tx => {
      const item = await tx.objectStore('icons').get(claim.id);
      if (!isCurrentIconClaim(item, claim, now)) return false;
      if (result.mode !== item!.mode || result.sourceBytes !== item!.size) throw new Error('The converter result no longer matches this saved source or mode.');
      const {svg: _svg, ...metadata} = result;
      await tx.objectStore('outputs').put({id: item!.id, revision: item!.revision, blob});
      await tx.objectStore('icons').put({...item!, status: 'ready', message: isSharedWorkspaceEnabled() ? 'SVG saved to workspace.' : 'SVG saved locally.', updatedAt: now, sourceMime: result.sourceFormat === 'webp' ? 'image/webp' : 'image/png', result: metadata, claim: undefined});
      return true;
    });
  }

  async fail(claim: IconClaim, message: string, now = Date.now()): Promise<boolean> {
    return this.write(['icons'], async tx => {
      const item = await tx.objectStore('icons').get(claim.id);
      if (!isCurrentIconClaim(item, claim, now)) return false;
      await tx.objectStore('icons').put({...item!, status: 'error', message: String(message).slice(0, 2000) || 'This image could not be converted.', claim: undefined, result: undefined, updatedAt: now});
      return true;
    });
  }

  /** Release our own interrupted work, without disturbing a newer claim or user cancellation. */
  async release(claim: IconClaim): Promise<boolean> {
    return this.write(['icons'], async tx => {
      const item = await tx.objectStore('icons').get(claim.id);
      if (!item || item.status !== 'processing' || item.revision !== claim.revision || item.claim?.owner !== claim.owner || item.claim?.token !== claim.token) return false;
      await tx.objectStore('icons').put({...item, status: 'queued', claim: undefined, message: 'Saved locally · waiting to resume…', updatedAt: Date.now()});
      return true;
    }, true, false);
  }

  /** Failed publication is recoverable in Workspace Settings; do not automatically rerun it. */
  async pauseAfterSharedFailure(claim: IconClaim, message: string): Promise<void> {
    await this.write(['icons'], async tx => {
      const item = await tx.objectStore('icons').get(claim.id);
      if (!item || item.revision !== claim.revision || item.claim?.owner !== claim.owner || item.claim?.token !== claim.token) return;
      await tx.objectStore('icons').put({...item, status: 'cancelled', claim: undefined, message: String(message).slice(0, 2000), updatedAt: Date.now()});
    }, true, false);
  }

  async retry(id: string, mode?: ConversionMode): Promise<IconRecord> {
    if (mode !== undefined) assertMode(mode);
    return this.write(['icons', 'outputs'], async tx => {
      const item = await tx.objectStore('icons').get(id);
      if (!item) throw new Error('This icon was removed.');
      const next: IconRecord = {...item, mode: mode ?? item.mode, revision: item.revision + 1, status: 'queued', claim: undefined, result: undefined, updatedAt: Date.now(), message: 'Saved locally · waiting to convert…'};
      await tx.objectStore('outputs').delete(id);
      await tx.objectStore('icons').put(next);
      return next;
    });
  }

  async cancel(id: string): Promise<void> {
    await this.write(['icons', 'outputs'], async tx => {
      const item = await tx.objectStore('icons').get(id);
      if (!item || !['queued', 'processing'].includes(item.status)) return;
      await tx.objectStore('outputs').delete(id);
      const next = {...item, revision: item.revision + 1, status: 'cancelled' as const, claim: undefined, result: undefined, message: 'Conversion stopped. The original image is saved; retry whenever you are ready.', updatedAt: Date.now()} as IconRecord & {sharedPending?: boolean};
      delete next.sharedPending;
      await tx.objectStore('icons').put(next);
    });
  }

  async cancelAll(): Promise<void> {
    await this.write(['icons', 'outputs'], async tx => {
      for (const item of await tx.objectStore('icons').getAll()) if (item.status === 'queued' || item.status === 'processing') {
        await tx.objectStore('outputs').delete(item.id);
        const next = {...item, revision: item.revision + 1, status: 'cancelled' as const, claim: undefined, result: undefined, message: 'Conversion stopped. The original image is saved; retry whenever you are ready.', updatedAt: Date.now()} as IconRecord & {sharedPending?: boolean};
        delete next.sharedPending;
        await tx.objectStore('icons').put(next);
      }
    });
  }

  async remove(id: string): Promise<void> {
    await this.write(['icons', 'sources', 'outputs', 'prefs'], async tx => {
      await tx.objectStore('icons').delete(id); await tx.objectStore('sources').delete(id); await tx.objectStore('outputs').delete(id);
      const prefs = normalizeIconPreferences((await tx.objectStore('prefs').get('workspace'))?.value);
      if (prefs.selectedId === id) await tx.objectStore('prefs').put({key: 'workspace', value: {...prefs, selectedId: null}});
    });
  }

  async removeFolder(id: string): Promise<void> {
    if (id === UNCATEGORIZED_ICON_FOLDER_ID) throw new Error('Uncategorized is the permanent destination for loose icons. Remove its icons individually.');
    await this.write(['icons', 'folders', 'sources', 'outputs', 'savedIcons', 'prefs'], async tx => {
      const folders = await tx.objectStore('folders').getAll();
      const removed = new Set<string>([id]);
      let changed = true;
      while (changed) {changed = false; for (const folder of folders) if (folder.parentId && removed.has(folder.parentId) && !removed.has(folder.id)) {removed.add(folder.id); changed = true;}}
      const deletedItems = new Set<string>();
      for (const item of await tx.objectStore('icons').getAll()) if (removed.has(item.folderId)) {
        deletedItems.add(item.id); await tx.objectStore('icons').delete(item.id); await tx.objectStore('sources').delete(item.id); await tx.objectStore('outputs').delete(item.id);
      }
      // A conversion-folder removal never deletes deliberately saved artwork or its source snapshot.
      const saved = await tx.objectStore('savedIcons').getAll();
      const names = new Set(saved.filter(item => item.folderId === UNCATEGORIZED_ICON_FOLDER_ID).map(item => item.name));
      for (const folder of folders) if (folder.parentId === UNCATEGORIZED_ICON_FOLDER_ID && !removed.has(folder.id)) names.add(folder.name);
      for (const item of saved) if (removed.has(item.folderId)) await tx.objectStore('savedIcons').put({...item, folderId: UNCATEGORIZED_ICON_FOLDER_ID, name: allocateIconName(item.name, names, true), updatedAt: Date.now()});
      for (const folderId of removed) await tx.objectStore('folders').delete(folderId);
      const prefs = normalizeIconPreferences((await tx.objectStore('prefs').get('workspace'))?.value);
      await tx.objectStore('prefs').put({key: 'workspace', value: {...prefs, selectedId: prefs.selectedId && deletedItems.has(prefs.selectedId) ? null : prefs.selectedId, expanded: prefs.expanded.filter(folderId => !removed.has(folderId))}});
    });
  }

  async createFolder(name: string, parentId: string | null = null): Promise<IconFolder> {
    if (!name.trim()) throw new Error('Enter a folder name.');
    if (name.length > 150) throw new Error('Use a folder name of 150 characters or fewer.');
    return this.write(['folders', 'icons', 'savedIcons'], async tx => {
      if (parentId !== null && !await tx.objectStore('folders').getKey(parentId)) throw new Error('Choose an existing parent folder.');
      const folders = await tx.objectStore('folders').getAll();
      const folderMap = new Map(folders.map(folder => [folder.id, folder]));
      const ancestors = new Set<string>();
      let ancestor = parentId ? folderMap.get(parentId) : undefined;
      while (ancestor) {
        if (ancestors.has(ancestor.id) || ancestors.size >= ICON_IMPORT_LIMITS.maxDepth - 1) throw new Error(`Folders can be at most ${ICON_IMPORT_LIMITS.maxDepth} levels deep.`);
        ancestors.add(ancestor.id); ancestor = ancestor.parentId ? folderMap.get(ancestor.parentId) : undefined;
      }
      const names = new Set(folders.filter(folder => folder.parentId === parentId).map(folder => folder.name));
      if (parentId) for (const item of await tx.objectStore('icons').index('byFolder').getAll(parentId)) names.add(item.name);
      if (parentId) for (const item of await tx.objectStore('savedIcons').index('byFolder').getAll(parentId)) names.add(item.name);
      const folder: IconFolder = {id: `icon-folder-${uniqueId()}`, parentId, name: allocateIconName(name, names), createdAt: Date.now(), favorite: false};
      await tx.objectStore('folders').add(folder);
      return folder;
    });
  }

  async move(id: string, folderId: string): Promise<IconRecord> {
    return this.write(['icons', 'folders'], async tx => {
      if (!await tx.objectStore('folders').getKey(folderId)) throw new Error('Choose an existing icon folder.');
      const item = await tx.objectStore('icons').get(id);
      if (!item) throw new Error('This icon was removed.');
      if (item.folderId === folderId) return item;
      const names = new Set((await tx.objectStore('icons').index('byFolder').getAll(folderId)).map(other => other.name));
      for (const folder of await tx.objectStore('folders').getAll()) if (folder.parentId === folderId) names.add(folder.name);
      const next = {...item, folderId, name: allocateIconName(item.name, names, true), updatedAt: Date.now()};
      await tx.objectStore('icons').put(next);
      return next;
    });
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    if (typeof favorite !== 'boolean') throw new Error('Invalid icon favorite.');
    await this.write(['icons'], async tx => {
      const item = await tx.objectStore('icons').get(id);
      if (!item) throw new Error('This icon was removed.');
      await tx.objectStore('icons').put({...item, favorite});
    });
  }

  async setFolderFavorite(id: string, favorite: boolean): Promise<void> {
    if (typeof favorite !== 'boolean') throw new Error('Invalid folder favorite.');
    await this.write(['folders'], async tx => {
      const folder = await tx.objectStore('folders').get(id);
      if (!folder) throw new Error('This icon folder was removed.');
      await tx.objectStore('folders').put({...folder, favorite});
    });
  }

  async setPreferences(patch: Partial<IconPreferences> & {mode?: ConversionMode}): Promise<IconPreferences> {
    return this.write(['prefs'], async tx => {
      const current = normalizeIconPreferences((await tx.objectStore('prefs').get('workspace'))?.value);
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      if (defined.defaultMode === undefined && defined.mode !== undefined) defined.defaultMode = defined.mode;
      const value = normalizeIconPreferences({...current, ...defined});
      await tx.objectStore('prefs').put({key: 'workspace', value});
      return value;
    });
  }
}

/** Each call returns an independent handle; QA may use a dedicated database name. */
async function openIconDatabase(name: string): Promise<IDBPDatabase<IconSchema>> {
  name = sharedDatabaseName(name);
  if (!name || name.length > 180) throw new Error('Invalid local Icons database name.');
  let db: IDBPDatabase<IconSchema>;
  db = await openDB<IconSchema>(name, ICON_DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const icons = database.createObjectStore('icons', {keyPath: 'id'});
        icons.createIndex('byFolder', 'folderId'); icons.createIndex('byStatus', 'status');
        database.createObjectStore('folders', {keyPath: 'id'});
        database.createObjectStore('sources', {keyPath: 'id'});
        database.createObjectStore('outputs', {keyPath: 'id'});
        database.createObjectStore('prefs', {keyPath: 'key'});
      }
      if (oldVersion < 2) {
        const saved = database.createObjectStore('savedIcons', {keyPath: 'id'});
        saved.createIndex('byFolder', 'folderId');
        database.createObjectStore('savedSvg', {keyPath: 'id'});
        database.createObjectStore('savedSources', {keyPath: 'id'});
      }
    },
    blocking() {db?.close();},
  });
  const tx = db.transaction('folders', 'readwrite');
  try {
    if (!await tx.store.getKey(UNCATEGORIZED_ICON_FOLDER_ID)) await tx.store.add({id: UNCATEGORIZED_ICON_FOLDER_ID, parentId: null, name: 'Uncategorized', createdAt: Date.now(), favorite: false});
    await tx.done;
    registerSharedDatabase('icons', db);
    return db;
  } catch (error) {
    try {tx.abort();} catch { /* Already aborted. */ }
    await tx.done.catch(() => undefined); db.close(); throw error;
  }
}

export async function openIconCollection(name = ICON_DB_NAME): Promise<IconCollectionStore> {
  const db = await openIconDatabase(name);
  return new IconCollectionStore(db, db.name);
}

export function openSharedIconDatabase(): Promise<IDBPDatabase<IconSchema>> {return openIconDatabase(ICON_DB_NAME);}

/** Presentation-only adapters never enter the Library archive/file persistence APIs. */
export function projectIconCollection(snapshot: IconCollectionSnapshot, favoritesOnly = false): IconTreeProjection {
  return projectCollectionTree(snapshot.folders, snapshot.items.map(item => ({...item, mime: item.sourceMime ?? 'image/png'})), favoritesOnly);
}

/** The Saved view uses the same folder identities and ArchiveTree presentation as conversions. */
export function projectSavedIconCollection(snapshot: IconCollectionSnapshot, favoritesOnly = false): IconTreeProjection {
  return projectCollectionTree(snapshot.folders, snapshot.saved.map(item => ({id: item.id, folderId: item.folderId, name: item.name, size: item.outputBytes, mime: 'image/svg+xml', createdAt: item.createdAt, lastModified: 0, favorite: item.favorite})), favoritesOnly);
}

interface CollectionTreeItem {id: string; folderId: string; name: string; size: number; mime: string; createdAt: number; lastModified: number; favorite: boolean}
function projectCollectionTree(collectionFolders: IconFolder[], items: CollectionTreeItem[], favoritesOnly: boolean): IconTreeProjection {
  const folders = new Map(collectionFolders.map(folder => [folder.id, folder]));
  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  const folderPath = (id: string): string[] => {
    const names: string[] = [];
    const visited = new Set<string>();
    let folder = folders.get(id);
    while (folder && !visited.has(folder.id)) {visited.add(folder.id); names.unshift(folder.name); folder = folder.parentId ? folders.get(folder.parentId) : undefined;}
    return names;
  };
  const rootOf = (id: string): string => {
    const seen = new Set<string>();
    let folder = folders.get(id);
    while (folder?.parentId && folders.has(folder.parentId) && !seen.has(folder.id)) {seen.add(folder.id); folder = folders.get(folder.parentId);}
    return folder?.id ?? UNCATEGORIZED_ICON_FOLDER_ID;
  };
  for (const folder of collectionFolders) nodes.set(folder.id, {id: folder.id, folderId: folder.id, archiveId: rootOf(folder.id), label: folder.name, kind: 'collection', children: [], pageCount: 0});
  for (const folder of collectionFolders) {
    const node = nodes.get(folder.id)!;
    const parent = folder.parentId ? nodes.get(folder.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node); else roots.push(node);
  }
  const pages: HtmlPage[] = [];
  for (const item of items) {
    const parent = nodes.get(item.folderId);
    if (!parent) continue;
    const rootId = rootOf(item.folderId);
    pages.push({id: item.id, archiveId: rootId, rootId, path: [...folderPath(item.folderId), item.name].join('/'), label: item.name, isIndex: false, kind: 'image', size: item.size, mime: item.mime, addedAt: item.createdAt, ...(item.lastModified > 0 ? {modifiedAt: item.lastModified, dateSource: 'file' as const} : {})});
    parent.children.push({id: item.id, pageId: item.id, archiveId: rootId, label: item.name, kind: 'page', children: [], pageCount: 1});
  }
  const directFavorites = new Set(items.filter(item => item.favorite).map(item => item.id));
  const favoriteFolders = new Set(collectionFolders.filter(folder => folder.favorite).map(folder => folder.id));
  const visit = (node: TreeNode, inherited = false, path = new Set<string>()): TreeNode | undefined => {
    if (path.has(node.id)) return undefined;
    const starred = inherited || favoriteFolders.has(node.id);
    if (node.kind === 'page') return !favoritesOnly || starred || directFavorites.has(node.id) ? node : undefined;
    const nextPath = new Set(path).add(node.id);
    const children = node.children.map(child => visit(child, starred, nextPath)).filter((child): child is TreeNode => !!child);
    children.sort((a, b) => natural.compare(a.label, b.label) || a.id.localeCompare(b.id));
    if (favoritesOnly && !starred && !children.length) return undefined;
    return {...node, children, pageCount: children.reduce((count, child) => count + child.pageCount, 0)};
  };
  const tree = roots.map(root => visit(root)).filter((node): node is TreeNode => !!node);
  tree.sort((a, b) => a.id === UNCATEGORIZED_ICON_FOLDER_ID ? -1 : b.id === UNCATEGORIZED_ICON_FOLDER_ID ? 1 : natural.compare(a.label, b.label) || a.id.localeCompare(b.id));
  const rootCounts = new Map<string, {count: number; bytes: number}>();
  for (const page of pages) {const counts = rootCounts.get(page.rootId) ?? {count: 0, bytes: 0}; counts.count++; counts.bytes += page.size; rootCounts.set(page.rootId, counts);}
  const archives = collectionFolders.filter(folder => !folder.parentId).map(folder => {
    const counts = rootCounts.get(folder.id) ?? {count: 0, bytes: 0};
    return {id: folder.id, rootId: folder.id, parentId: null, mountPath: '', name: folder.name, createdAt: folder.createdAt, fileCount: counts.count, pageCount: 0, imageCount: counts.count, byteSize: counts.bytes, warnings: []};
  });
  return {tree, pages, archives, folders: collectionFolders.map(folder => ({id: folder.id, name: folderPath(folder.id).join(' / '), createdAt: folder.createdAt})), organization: new Map(items.map(item => [item.id, {id: item.id, favorite: item.favorite, folderId: item.folderId}])), favoriteFolders};
}
