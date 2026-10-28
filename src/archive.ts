import { uniqueId } from './identity';
import JSZip from 'jszip';
import type { ArchiveMeta, HtmlPage, ImportBundle, ImportLimits } from './types';

export type { ImportLimits } from './types';

const MiB = 1024 * 1024;
export const DEFAULT_IMPORT_LIMITS: Readonly<ImportLimits> = Object.freeze({
  maxCompressedBytes: 256 * MiB,
  maxExpandedBytes: 768 * MiB,
  maxEntryBytes: 128 * MiB,
  maxFiles: 20_000,
  maxDepth: 8,
});

const utf8 = new TextDecoder('utf-8', { fatal: true });
const cp437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crcUpdate(crc: number, bytes: Uint8Array): number {
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

function crc32(bytes: Uint8Array): number {
  return (crcUpdate(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
}

function decodeName(bytes: Uint8Array, strictUtf8 = false): string {
  try { return utf8.decode(bytes); } catch {
    if (strictUtf8) throw new Error('A ZIP member has an invalid UTF-8 filename.');
    return Array.from(bytes, byte => byte < 128 ? String.fromCharCode(byte) : cp437[byte - 128]).join('');
  }
}

/** Canonical, case-preserved member paths. Never use URL decoding for ZIP filenames. */
export function normaliseArchivePath(name: string): string {
  if (!name || name.includes('\0')) throw new Error('The ZIP contains an empty filename or a NUL character.');
  if (/^[\\/]/.test(name) || /^[a-zA-Z]:/.test(name)) throw new Error(`Absolute paths are not allowed in archives: ${name}`);
  const segments = name.replace(/\\/g, '/').split('/');
  if (segments.some(segment => segment === '..')) throw new Error(`Path traversal is not allowed in archives: ${name}`);
  const path = segments.filter(segment => segment !== '' && segment !== '.').join('/');
  if (!path) throw new Error('The ZIP contains an empty member path.');
  return path;
}

export function mimeForPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript',
    mjs: 'text/javascript', cjs: 'text/javascript', json: 'application/json',
    webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp', woff: 'font/woff',
    woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
    mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg',
    wav: 'audio/wav', txt: 'text/plain', md: 'text/markdown', xml: 'application/xml',
    pdf: 'application/pdf', zip: 'application/zip', wasm: 'application/wasm',
    csv: 'text/csv', map: 'application/json',
  };
  return Object.hasOwn(types, extension) ? types[extension] : 'application/octet-stream';
}

/** A narrow browser-image allowlist; other files stay available only as HTML resources. */
export function isSupportedImagePath(path: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i.test(path);
}

/** Direct images share the same canonical file and item identity as ZIP imports. */
export async function importImages(
  files: File[],
  name = 'Image import',
  overrides: Partial<ImportLimits> = {},
): Promise<ImportBundle> {
  const limits = { ...DEFAULT_IMPORT_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw new Error(`Invalid import limit: ${key}`);
  }
  if (!files.length) throw new Error('Choose at least one image to import.');
  if (files.length > limits.maxFiles) throw new Error(`The import exceeds the ${limits.maxFiles.toLocaleString()} file limit.`);
  const rootId = uniqueId();
  const archive: ArchiveMeta = {
    id: rootId, rootId, parentId: null, mountPath: '', name: name.trim() || 'Image import', createdAt: Date.now(),
    fileCount: 0, pageCount: 0, imageCount: 0, byteSize: 0, warnings: [],
  };
  const bundle: ImportBundle = { archives: [archive], pages: [], files: [] };
  const paths = new Set<string>();
  for (const file of files) {
    if (!(file instanceof Blob) || typeof file.name !== 'string') throw new Error('An imported image is not a valid file.');
    const path = normaliseArchivePath(file.name);
    if (!isSupportedImagePath(path)) throw new Error(`Unsupported image: ${file.name}. Use PNG, JPEG, GIF, WebP, AVIF, SVG, BMP or ICO.`);
    if (paths.has(path)) throw new Error(`Duplicate image filename: ${path}`);
    if (!file.size) throw new Error(`The image is empty: ${path}`);
    if (file.size > limits.maxEntryBytes) throw new Error(`An image exceeds the ${Math.round(limits.maxEntryBytes / MiB)} MB per-file limit.`);
    archive.byteSize += file.size;
    if (archive.byteSize > limits.maxExpandedBytes) throw new Error(`The import exceeds the ${Math.round(limits.maxExpandedBytes / MiB)} MB total-size limit.`);
    paths.add(path);
    const mime = mimeForPath(path);
    const id = `${rootId}/${path}`;
    const modifiedAt = Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : undefined;
    // Blob slicing retains the original bytes while assigning a safe, supported image MIME.
    bundle.files.push({ id, archiveId: rootId, path, blob: file.slice(0, file.size, mime), mime });
    bundle.pages.push({ id, archiveId: rootId, rootId, path, label: path.split('/').at(-1)!, isIndex: false, size: file.size, kind: 'image', addedAt:archive.createdAt, ...(modifiedAt ? { modifiedAt, dateSource: 'file' as const } : {}) });
    if (modifiedAt) archive.modifiedAt = Math.max(archive.modifiedAt ?? 0, modifiedAt);
    archive.fileCount++;
    archive.imageCount!++;
  }
  return bundle;
}

interface Budget { entries: number; declaredBytes: number; actualBytes: number }
interface Entry {
  path: string;
  directory: boolean;
  size: number;
  crc: number;
}

function checkedRange(offset: number, size: number, end: number, message = 'The ZIP is truncated or malformed.'): void {
  if (offset < 0 || size < 0 || offset + size > end) throw new Error(message);
}

function unicodePath(extra: Uint8Array, rawName: Uint8Array): string | undefined {
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let offset = 0;
  while (offset < extra.length) {
    checkedRange(offset, 4, extra.length, 'A ZIP extra field is truncated.');
    const tag = view.getUint16(offset, true);
    const size = view.getUint16(offset + 2, true);
    checkedRange(offset + 4, size, extra.length, 'A ZIP extra field is truncated.');
    if (tag === 0x7075 && size >= 5 && extra[offset + 4] === 1 && view.getUint32(offset + 5, true) === crc32(rawName)) {
      return decodeName(extra.subarray(offset + 9, offset + 4 + size), true);
    }
    offset += 4 + size;
  }
  return undefined;
}

/** Inspect raw headers before JSZip can normalise paths or overwrite duplicate entries. */
function inspectZip(buffer: ArrayBuffer, limits: ImportLimits, budget: Budget): Entry[] {
  if (buffer.byteLength > limits.maxCompressedBytes) throw new Error(`The ZIP exceeds the ${Math.round(limits.maxCompressedBytes / MiB)} MB compressed-size limit.`);
  if (buffer.byteLength < 22) throw new Error('This is not a complete ZIP file.');
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = -1;
  for (let offset = bytes.length - 22, minimum = Math.max(0, bytes.length - 65_557); offset >= minimum; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('The ZIP is truncated or its directory is missing.');
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const start = view.getUint32(end + 16, true);
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff) throw new Error('ZIP64 archives are not supported. Please export a standard ZIP.');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count) throw new Error('Split or multi-volume ZIP archives are not supported.');
  if (start + size !== end) throw new Error('The ZIP directory has an invalid offset or size.');
  budget.entries += count;
  if (budget.entries > limits.maxFiles) throw new Error(`The import exceeds the ${limits.maxFiles.toLocaleString()} archive-entry limit.`);

  const entries: Entry[] = [];
  const paths = new Set<string>();
  const rawPaths = new Set<string>();
  const ranges: Array<[number, number]> = [];
  let cursor = start;
  for (let index = 0; index < count; index++) {
    checkedRange(cursor, 46, end);
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('The ZIP has an invalid directory entry.');
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const nameSize = view.getUint16(cursor + 28, true);
    const extraSize = view.getUint16(cursor + 30, true);
    const commentSize = view.getUint16(cursor + 32, true);
    const attributes = view.getUint32(cursor + 38, true);
    const localOffset = view.getUint32(cursor + 42, true);
    checkedRange(cursor + 46, nameSize + extraSize + commentSize, end);
    if (flags & 1) throw new Error('Password-protected ZIP files are not supported.');
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression method ${method}. Please use a standard ZIP.`);
    if (view.getUint16(cursor + 34, true)) throw new Error('Split ZIP archives are not supported.');
    if ([compressedSize, expandedSize, localOffset].includes(0xffffffff)) throw new Error('ZIP64 entries are not supported. Please export a standard ZIP.');
    if (expandedSize > limits.maxEntryBytes) throw new Error(`A ZIP member exceeds the ${Math.round(limits.maxEntryBytes / MiB)} MB per-file limit.`);
    budget.declaredBytes += expandedSize;
    if (budget.declaredBytes > limits.maxExpandedBytes) throw new Error(`The import exceeds the ${Math.round(limits.maxExpandedBytes / MiB)} MB expanded-size limit.`);
    const centralName = bytes.subarray(cursor + 46, cursor + 46 + nameSize);
    const extra = bytes.subarray(cursor + 46 + nameSize, cursor + 46 + nameSize + extraSize);
    const rawName = decodeName(centralName, Boolean(flags & 0x800));
    const rawPath = normaliseArchivePath(rawName);
    checkedRange(localOffset, 30, start);
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`Missing local file header: ${rawPath}`);
    const localFlags = view.getUint16(localOffset + 6, true);
    if (localFlags !== flags || view.getUint16(localOffset + 8, true) !== method) throw new Error(`Conflicting ZIP headers: ${rawPath}`);
    const localNameSize = view.getUint16(localOffset + 26, true);
    const localExtraSize = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameSize + localExtraSize;
    checkedRange(localOffset + 30, localNameSize + localExtraSize, start);
    checkedRange(dataStart, compressedSize, start);
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameSize);
    if (normaliseArchivePath(decodeName(localName, Boolean(flags & 0x800))) !== rawPath) throw new Error(`Conflicting filenames in ZIP headers: ${rawPath}`);
    if (!(flags & 8)) {
      const localCrc = view.getUint32(localOffset + 14, true);
      const localCompressed = view.getUint32(localOffset + 18, true);
      const localExpanded = view.getUint32(localOffset + 22, true);
      if (localCrc !== crc || (localCompressed !== 0xffffffff && localCompressed !== compressedSize) || (localExpanded !== 0xffffffff && localExpanded !== expandedSize)) {
        throw new Error(`Conflicting sizes or checksum in ZIP headers: ${rawPath}`);
      }
    }
    const effectiveName = flags & 0x800 ? rawName : unicodePath(extra, localName) ?? rawName;
    // Validate extra fields even when the UTF-8 flag means their filename is unused.
    if (flags & 0x800) unicodePath(extra, localName);
    const path = normaliseArchivePath(effectiveName);
    if (paths.has(path) || rawPaths.has(rawPath)) throw new Error(`Duplicate archive path: ${path}`);
    paths.add(path);
    rawPaths.add(rawPath);
    const unixMode = attributes >>> 16;
    if ((unixMode & 0xf000) === 0xa000) throw new Error(`Symbolic links are not supported in ZIP previews: ${path}`);
    const directory = /[\\/]$/.test(effectiveName) || Boolean(attributes & 0x10) || (unixMode & 0xf000) === 0x4000;
    if (directory && expandedSize !== 0) throw new Error(`A directory contains unexpected file data: ${path}`);
    entries.push({ path, directory, size: expandedSize, crc });
    ranges.push([localOffset, dataStart + compressedSize]);
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  if (cursor !== end) throw new Error('The ZIP directory entry count does not match its contents.');
  ranges.sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index][0] < ranges[index - 1][1]) throw new Error('The ZIP contains overlapping file entries.');
  }
  return entries;
}

type StreamableZipFile = JSZip.JSZipObject & {
  internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>;
};

/** Pause inflation immediately if the stream exceeds its declared or actual limit. */
function extractBounded(file: JSZip.JSZipObject, entry: Entry, limits: ImportLimits, budget: Budget): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = (file as StreamableZipFile).internalStream('uint8array');
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    let crc = 0xffffffff;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stream.pause();
      chunks.length = 0;
      reject(error);
    };
    stream.on('data', chunk => {
      if (settled) return;
      size += chunk.byteLength;
      budget.actualBytes += chunk.byteLength;
      if (size > entry.size || size > limits.maxEntryBytes || budget.actualBytes > limits.maxExpandedBytes) {
        fail(new Error(`Inflation limit or declared-size mismatch: ${entry.path}`));
        return;
      }
      crc = crcUpdate(crc, chunk);
      chunks.push(new Uint8Array(chunk).buffer);
    });
    stream.on('error', error => fail(new Error(`Cannot extract ${entry.path}: ${error.message}`)));
    stream.on('end', () => {
      if (settled) return;
      if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) {
        fail(new Error(`The file is corrupt (size or checksum mismatch): ${entry.path}`));
        return;
      }
      settled = true;
      resolve(new Blob(chunks, { type: mimeForPath(entry.path) }));
    });
    stream.resume();
  });
}

function isMetadata(path: string): boolean {
  return path.split('/').some(segment => segment === '__MACOSX' || segment === '.DS_Store' || segment.startsWith('._'));
}

const comparePaths = (a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path, 'en', { numeric: true }) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export async function parseArchive(
  input: ArrayBuffer,
  name: string,
  onProgress?: (message: string) => void,
  overrides: Partial<ImportLimits> = {},
  sourceModifiedAt?: number,
): Promise<ImportBundle> {
  const limits = { ...DEFAULT_IMPORT_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw new Error(`Invalid import limit: ${key}`);
  }
  const bundle: ImportBundle = { archives: [], pages: [], files: [] };
  const budget: Budget = { entries: 0, declaredBytes: 0, actualBytes: 0 };
  const createdAt = Date.now();
  const rootId = uniqueId();

  async function visit(buffer: ArrayBuffer, archiveName: string, parentId: string | null, mountPath: string, depth: number): Promise<{ html: number; images: number }> {
    if (depth > limits.maxDepth) throw new Error(`Nested ZIP depth exceeds ${limits.maxDepth}: ${archiveName}`);
    onProgress?.(`Reading ${archiveName}…`);
    let entries: Entry[];
    let zip: JSZip;
    try {
      entries = inspectZip(buffer, limits, budget);
      zip = await JSZip.loadAsync(buffer, {
        createFolders: false,
        checkCRC32: false,
        decodeFileName: bytes => decodeName(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.map(value => value.charCodeAt(0)))),
      });
    } catch (error) {
      throw new Error(`${archiveName}: ${error instanceof Error ? error.message : 'Cannot read ZIP.'}`);
    }
    const loaded = new Map<string, JSZip.JSZipObject>();
    for (const file of Object.values(zip.files)) {
      const path = normaliseArchivePath(file.unsafeOriginalName ?? file.name);
      if (loaded.has(path)) throw new Error(`Duplicate decoded archive path: ${path}`);
      loaded.set(path, file);
    }
    if (loaded.size !== entries.length) throw new Error(`${archiveName}: ZIP members do not match the verified directory.`);
    const archiveId = parentId === null ? rootId : uniqueId();
    const archive: ArchiveMeta = {
      id: archiveId, rootId, parentId, mountPath, name: archiveName, createdAt,
      fileCount: 0, pageCount: 0, imageCount: 0, byteSize: 0, warnings: [],
    };
    bundle.archives.push(archive);
    for (const entry of entries.sort(comparePaths)) {
      const file = loaded.get(entry.path);
      if (!file || file.dir !== entry.directory) throw new Error(`${archiveName}: Conflicting archive member: ${entry.path}`);
      if (entry.directory || isMetadata(entry.path)) continue;
      onProgress?.(`Extracting ${archiveName} · ${entry.path}`);
      const blob = await extractBounded(file, entry, limits, budget);
      const id = `${archiveId}/${entry.path}`;
      // Ignore ZIP exporter sentinels; use the source file's modification date instead.
      const stamp = file.date?.getTime();
      const fileDate = Number.isFinite(stamp) && stamp !== Date.parse('1985-10-26T08:15:00Z') && file.date.getUTCFullYear() > 1980 && file.date.getUTCFullYear() <= 2100 ? stamp : undefined;
      const modifiedAt = fileDate ?? (Number.isFinite(sourceModifiedAt) && sourceModifiedAt! > 0 ? sourceModifiedAt : undefined);
      const dateSource = fileDate ? 'file' as const : 'imported' as const;
      if (modifiedAt) archive.modifiedAt = Math.max(archive.modifiedAt ?? 0, modifiedAt);
      bundle.files.push({ id, archiveId, path: entry.path, blob, mime: mimeForPath(entry.path) });
      archive.fileCount++;
      archive.byteSize += blob.size;
      if (/\.html?$/i.test(entry.path)) {
        const pieces = entry.path.split('/');
        const filename = pieces.at(-1)!;
        const isIndex = /^index\.html?$/i.test(filename);
        const page: HtmlPage = {
          id, archiveId, rootId, path: entry.path, isIndex, size: blob.size,
          label: isIndex ? pieces.at(-2) ?? archiveName.replace(/\.zip$/i, '') : filename,
          kind: 'html', addedAt:createdAt,
          ...(modifiedAt ? { modifiedAt, dateSource } : {}),
        };
        bundle.pages.push(page);
        archive.pageCount++;
      } else if (isSupportedImagePath(entry.path)) {
        bundle.pages.push({ id, archiveId, rootId, path: entry.path, label: entry.path.split('/').at(-1)!, isIndex: false, size: blob.size, kind: 'image', addedAt:createdAt, ...(modifiedAt ? { modifiedAt, dateSource } : {}) });
        archive.imageCount!++;
      }
      if (/\.zip$/i.test(entry.path)) {
        const nested = await visit(await blob.arrayBuffer(), entry.path.split('/').at(-1)!, archiveId, entry.path, depth + 1);
        archive.pageCount += nested.html;
        archive.imageCount! += nested.images;
      }
    }
    if (!archive.pageCount && !archive.imageCount) archive.warnings.push('No HTML pages or supported images found in this archive.');
    return { html: archive.pageCount, images: archive.imageCount ?? 0 };
  }

  await visit(input, name || 'archive.zip', null, '', 0);
  const htmlCount = bundle.pages.filter(page => page.kind !== 'image').length;
  const imageCount = bundle.pages.length - htmlCount;
  onProgress?.(`Ready · ${htmlCount} HTML ${htmlCount === 1 ? 'page' : 'pages'} · ${imageCount} ${imageCount === 1 ? 'image' : 'images'}`);
  return bundle;
}
