import type {IconImportBatch, IconImportDirectory, IconImportFile} from './icon-types';

export const ICON_IMPORT_LIMITS = Object.freeze({
  maxFiles: 100,
  maxSourceBytes: 100 * 1024 * 1024,
  maxEntries: 5_000,
  maxDepth: 32,
  maxPathLength: 2_048,
});

/** Minimal browser entry surface, also usable by procedural traversal tests. */
export interface IconDropEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
  createReader?: () => {readEntries: (success: (entries: IconDropEntry[]) => void, failure?: (error: DOMException) => void) => void};
}

export interface CapturedIconDrop {
  entries: {entry: IconDropEntry; rootKey: string}[];
  files: File[];
  notices: string[];
}

export class IconDropLimitError extends Error {
  constructor(message: string) {super(message); this.name = 'IconDropLimitError';}
}

/** Keep relative source paths literal. Never URL-decode filenames or accept traversal. */
export function normalizeIconPath(input: string): string {
  if (typeof input !== 'string' || !input || input.length > ICON_IMPORT_LIMITS.maxPathLength || /^[\\/]/.test(input) || /^[a-z]:/i.test(input) || /[\u0000-\u001f\u007f-\u009f]/.test(input)) {
    throw new Error('A dropped file has an invalid or excessively long relative path.');
  }
  // Source paths are identities. Composed/decomposed sibling names may refer to
  // different directories; normalize only their allocated display/export names.
  const parts = input.replace(/\\/g, '/').split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Folder paths cannot contain empty segments, “.” or “..”.');
  if (parts.length > ICON_IMPORT_LIMITS.maxDepth) throw new IconDropLimitError(`Folders can be at most ${ICON_IMPORT_LIMITS.maxDepth} levels deep.`);
  return parts.join('/');
}

export const isPngInput = (file: Pick<File, 'name' | 'type'>): boolean => /\.png$/i.test(file.name) || file.type === 'image/png';

/** Must run during the drop event, before DataTransfer's protected data disappears. */
export function captureIconDrop(dataTransfer: DataTransfer): CapturedIconDrop {
  const entries: CapturedIconDrop['entries'] = [];
  const files: File[] = [];
  const notices: string[] = [];
  const items = Array.from(dataTransfer.items ?? []);
  for (const [index, item] of items.entries()) {
    if (item.kind !== 'file') continue;
    let entry: IconDropEntry | null = null;
    try {
      const getter = (item as DataTransferItem & {webkitGetAsEntry?: () => unknown}).webkitGetAsEntry;
      if (getter) entry = getter.call(item) as IconDropEntry | null;
    } catch {notices.push('One dropped directory entry could not be accessed.');}
    if (entry) entries.push({entry, rootKey: `drop-${index}`});
    else {
      const file = item.getAsFile();
      if (file) files.push(file);
      else notices.push('A dropped directory was not exposed by this browser. Use the folder chooser.');
    }
  }
  if (!items.length) files.push(...Array.from(dataTransfer.files ?? []));
  return {entries, files, notices};
}

function abortError(): DOMException {return new DOMException('Folder import cancelled.', 'AbortError');}

function readEntry<T>(start: (resolve: (value: T) => void, reject: (error: DOMException) => void) => void, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {clearTimeout(timer); signal?.removeEventListener('abort', abort);};
    const finish = (value?: T, error?: unknown) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(value as T);
    };
    const abort = () => finish(undefined, abortError());
    const timer = setTimeout(() => finish(undefined, new Error('Reading a dropped folder timed out. Try the folder chooser.')), 15_000);
    signal?.addEventListener('abort', abort, {once: true});
    try {start(value => finish(value), error => finish(undefined, error));} catch (error) {finish(undefined, error);}
  });
}

/** File-only pickers cannot report empty directories; directory-entry drops can. */
export function iconEntriesFromFiles(files: readonly File[]): IconImportBatch {
  if (files.length > ICON_IMPORT_LIMITS.maxEntries) throw new IconDropLimitError(`An import can inspect at most ${ICON_IMPORT_LIMITS.maxEntries.toLocaleString()} entries. Choose a smaller folder.`);
  const entries: IconImportFile[] = [];
  const directories = new Map<string, IconImportDirectory>();
  const notices: string[] = [];
  let skipped = 0;
  for (const file of files) {
    try {
      const relative = file.webkitRelativePath || file.name;
      const path = normalizeIconPath(relative);
      const segments = path.split('/');
      const rootKey = file.webkitRelativePath && segments.length > 1 ? `picker-${segments[0]}` : undefined;
      if (rootKey) for (let depth = 1; depth < segments.length; depth++) {
        const directory = segments.slice(0, depth).join('/');
        directories.set(`${rootKey}\0${directory}`, {rootKey, relativePath: directory});
        if (directories.size + files.length > ICON_IMPORT_LIMITS.maxEntries) throw new IconDropLimitError(`An import can inspect at most ${ICON_IMPORT_LIMITS.maxEntries.toLocaleString()} files and folders. Choose a smaller folder.`);
      }
      entries.push({file, relativePath: path, rootKey});
    } catch (error) {
      if (error instanceof IconDropLimitError) throw error;
      skipped++;
      if (notices.length < 20) notices.push(`${file.name}: ${error instanceof Error ? error.message : 'This file path could not be read.'}`);
    }
  }
  if (files.some(file => !!file.webkitRelativePath)) notices.push('The folder chooser preserves file paths; browsers do not expose empty folders through this picker.');
  return {files: entries, directories: [...directories.values()], notices, skipped};
}

/** Drain every readEntries batch; a directory reader is allowed to return many batches. */
export async function readIconDrop(captured: CapturedIconDrop, signal?: AbortSignal): Promise<IconImportBatch> {
  const fallback = iconEntriesFromFiles(captured.files);
  const files = [...fallback.files];
  const directories = [...fallback.directories];
  const notices = [...captured.notices, ...(fallback.notices ?? [])];
  const visited = new WeakSet<object>();
  let discovered = captured.files.length;
  let skipped = fallback.skipped ?? 0;
  const notice = (message: string) => {if (notices.length < 30) notices.push(message);};
  const visit = async (entry: IconDropEntry, parent: string, rootKey: string): Promise<void> => {
    if (signal?.aborted) throw abortError();
    if (++discovered > ICON_IMPORT_LIMITS.maxEntries) throw new IconDropLimitError(`An import can inspect at most ${ICON_IMPORT_LIMITS.maxEntries.toLocaleString()} entries, including folders and non-PNG files. Choose a smaller folder.`);
    if (visited.has(entry)) {skipped++; notice('A repeated directory entry was skipped.'); return;}
    visited.add(entry);
    try {
      if (!entry.name || /[\\/]/.test(entry.name)) throw new Error('A directory entry has an invalid name.');
      const path = normalizeIconPath(parent ? `${parent}/${entry.name}` : entry.name);
      if (entry.isDirectory && !entry.isFile && entry.createReader) {
        directories.push({relativePath: path, rootKey});
        const reader = entry.createReader();
        while (true) {
          const children = await readEntry<IconDropEntry[]>((success, failure) => reader.readEntries(success, failure), signal);
          if (!children.length) break;
          for (const child of children) await visit(child, path, rootKey);
        }
      } else if (entry.isFile && !entry.isDirectory && entry.file) {
        const file = await readEntry<File>((success, failure) => entry.file!(success, failure), signal);
        files.push({file, relativePath: path, rootKey: parent ? rootKey : undefined});
      } else throw new Error('This dropped entry is not a readable file or directory.');
    } catch (error) {
      if (error instanceof IconDropLimitError || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      skipped++;
      notice(`${entry.name}: ${error instanceof Error ? error.message : 'Could not read this entry.'}`);
    }
  };
  for (const {entry, rootKey} of captured.entries) await visit(entry, '', rootKey);
  if (!files.length && !directories.length && !notices.length) notices.push('No files were exposed by this browser. Choose PNG files or a folder.');
  return {files, directories, notices, skipped};
}
