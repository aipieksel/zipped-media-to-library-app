export type DocumentName = 'library' | 'icons' | 'appearance';
export interface SharedDocument<T = unknown> {name: DocumentName; revision: number; data: T | null; blobs: string[]; updatedAt: number | null}
export interface SharedBlobReference {kind: 'folio-blob-v1'; size: number; mime: string; chunks: {hash: string; size: number; offset?: number; length?: number}[]}
export const SHARED_CHUNK_BYTES = 8 * 1024 * 1024;
export const SHARED_DOCUMENT_BYTES = 1024 * 1024;
export const SHARED_FILE_BYTES = 128 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export class SharedWorkspaceError extends Error {
  constructor(message: string, readonly code = 'shared-error', readonly status = 0) {super(message); this.name = 'SharedWorkspaceError';}
}

export async function hashBytes(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateBlobReference(value: unknown): SharedBlobReference {
  if (!object(value) || value.kind !== 'folio-blob-v1' || !Number.isSafeInteger(value.size) || (value.size as number) < 0 || (value.size as number) > SHARED_FILE_BYTES || typeof value.mime !== 'string' || value.mime.length > 200 || /[\r\n\u0000]/.test(value.mime) || !Array.isArray(value.chunks) || value.chunks.length > 16) throw new SharedWorkspaceError('The shared file reference is invalid.', 'invalid-data');
  let size = 0;
  for (const chunk of value.chunks) {
    if (!object(chunk) || typeof chunk.hash !== 'string' || !HASH.test(chunk.hash) || !Number.isSafeInteger(chunk.size) || (chunk.size as number) < 1 || (chunk.size as number) > SHARED_CHUNK_BYTES) throw new SharedWorkspaceError('The shared file chunk is invalid.', 'invalid-data');
    if (chunk.offset !== undefined || chunk.length !== undefined) {
      if (!Number.isSafeInteger(chunk.offset) || !Number.isSafeInteger(chunk.length) || (chunk.offset as number) < 0 || (chunk.length as number) < 1 || (chunk.offset as number) + (chunk.length as number) > (chunk.size as number)) throw new SharedWorkspaceError('The shared file slice is outside its verified chunk.', 'invalid-data');
      size += chunk.length as number;
    } else size += chunk.size as number;
  }
  if (size !== value.size) throw new SharedWorkspaceError('The shared file size does not match its chunks.', 'invalid-data');
  return value as unknown as SharedBlobReference;
}

function validateDocument(value: unknown, name: DocumentName): SharedDocument {
  if (!object(value) || value.name !== name || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || !(value.data === null || object(value.data)) || !Array.isArray(value.blobs) || value.blobs.length > 10000 || value.blobs.some(hash => typeof hash !== 'string' || !HASH.test(hash)) || new Set(value.blobs).size !== value.blobs.length || !(value.updatedAt === null || Number.isSafeInteger(value.updatedAt))) throw new SharedWorkspaceError('The shared workspace returned invalid metadata.', 'invalid-data');
  return value as unknown as SharedDocument;
}

async function limitedBytes(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > limit) throw new SharedWorkspaceError('The shared response exceeds its size limit.', 'limit');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(), pieces: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) {await reader.cancel(); throw new SharedWorkspaceError('The shared response exceeds its size limit.', 'limit');}
      pieces.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length); let offset = 0;
  for (const piece of pieces) {bytes.set(piece, offset); offset += piece.byteLength;}
  return bytes;
}

export class SharedWorkspaceClient {
  private readonly requests = new Set<AbortController>();
  private readonly uploaded = new Set<string>();
  private readonly downloads = new Map<string, Promise<Blob>>();
  private readonly chunkDownloads = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
  private readonly chunks = new Map<string, Uint8Array<ArrayBuffer>>();
  private chunkBytes = 0;
  private closed = false;
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly onUnauthorized?: () => void) {}

  close(): void {this.closed = true; for (const request of this.requests) request.abort(); this.requests.clear(); this.downloads.clear(); this.chunkDownloads.clear(); this.chunks.clear(); this.chunkBytes = 0; this.uploaded.clear();}

  private assertOpen(): void {
    if (this.closed) throw new SharedWorkspaceError('Sign in to reopen the shared workspace.', 'signed-out', 401);
  }

  private async request<T>(path: string, init: RequestInit, consume: (response: Response) => Promise<T>): Promise<T> {
    this.assertOpen();
    const controller = new AbortController(); this.requests.add(controller);
    try {
      const response = await this.fetcher(path, {...init, credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
      if (!response.ok) {
        let detail: {error?: string; code?: string} = {};
        try {detail = JSON.parse(new TextDecoder().decode(await limitedBytes(response, 16 * 1024)));} catch { /* A non-JSON hosting error remains bounded. */ }
        if (response.status === 401 || response.status === 403) this.onUnauthorized?.();
        throw new SharedWorkspaceError(detail.error || (response.status === 409 ? 'The shared workspace changed on another device. Refresh and retry your change.' : `The shared workspace request failed (${response.status}).`), detail.code || (response.status === 409 ? 'conflict' : 'request-failed'), response.status);
      }
      const result = await consume(response);
      this.assertOpen();
      return result;
    } catch (error) {
      this.assertOpen();
      if (error instanceof SharedWorkspaceError) throw error;
      throw new SharedWorkspaceError('The shared workspace connection was interrupted. Retry when the connection is available.', 'network');
    } finally {this.requests.delete(controller);}
  }

  private async json(path: string, init?: RequestInit): Promise<unknown> {
    return this.request(path, init ?? {}, async response => {
      if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new SharedWorkspaceError('Sign in to load the shared workspace.', 'invalid-response');
      try {return JSON.parse(new TextDecoder().decode(await limitedBytes(response, SHARED_DOCUMENT_BYTES + 4096)));}
      catch (error) {if (error instanceof SharedWorkspaceError) throw error; throw new SharedWorkspaceError('The shared workspace response is incomplete.', 'invalid-response');}
    });
  }

  async read(name: DocumentName): Promise<SharedDocument> {return validateDocument(await this.json(`/api/workspace/documents/${name}`), name);}

  async write(name: DocumentName, data: unknown, blobs: readonly string[], expectedRevision: number): Promise<SharedDocument> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !(data === null || object(data)) || blobs.length > 10000 || blobs.some(hash => !HASH.test(hash)) || new Set(blobs).size !== blobs.length) throw new SharedWorkspaceError('The shared workspace update is invalid.', 'invalid-data');
    const body = JSON.stringify({expectedRevision, data, blobs});
    if (new TextEncoder().encode(body).byteLength > SHARED_DOCUMENT_BYTES) throw new SharedWorkspaceError('This collection exceeds the 1 MiB shared metadata limit. Split or reduce the import before retrying; your staged files are retained.', 'limit');
    const document = validateDocument(await this.json(`/api/workspace/documents/${name}`, {method: 'PUT', headers: {'content-type': 'application/json'}, body}), name);
    if (document.revision !== expectedRevision + 1) throw new SharedWorkspaceError('The server did not acknowledge the expected workspace revision.', 'invalid-response');
    return document;
  }

  async upload(blob: Blob): Promise<SharedBlobReference> {
    this.assertOpen();
    if (blob.size > SHARED_FILE_BYTES) throw new SharedWorkspaceError('A shared file may be at most 128 MiB.', 'limit');
    const chunks: SharedBlobReference['chunks'] = [];
    for (let start = 0; start < blob.size; start += SHARED_CHUNK_BYTES) {
      const part = blob.slice(start, Math.min(blob.size, start + SHARED_CHUNK_BYTES)), bytes = await part.arrayBuffer(), hash = await hashBytes(bytes);
      if (!this.uploaded.has(hash)) {
        const result = await this.json(`/api/workspace/blobs/${hash}`, {method: 'PUT', headers: {'content-type': 'application/octet-stream'}, body: bytes});
        if (!object(result) || result.hash !== hash || result.size !== bytes.byteLength) throw new SharedWorkspaceError('The uploaded file was not acknowledged correctly.', 'invalid-response');
        this.uploaded.add(hash);
      }
      chunks.push({hash, size: bytes.byteLength});
    }
    return {kind: 'folio-blob-v1', size: blob.size, mime: blob.type, chunks};
  }

  /** Pack small files into bounded immutable chunks so a large ZIP needs a bounded root index. */
  async uploadMany(blobs: readonly Blob[]): Promise<SharedBlobReference[]> {
    this.assertOpen();
    const references: SharedBlobReference[] = [], pending: {index: number; blob: Blob; offset: number}[] = [];
    let size = 0;
    const flush = async () => {
      if (!pending.length) return;
      const packed = await this.upload(new Blob(pending.map(item => item.blob))), chunk = packed.chunks[0];
      for (const item of pending) references[item.index] = {kind: 'folio-blob-v1', size: item.blob.size, mime: item.blob.type, chunks: [{...chunk, ...(pending.length > 1 ? {offset: item.offset, length: item.blob.size} : {})}]};
      pending.length = 0; size = 0;
    };
    for (const [index, blob] of blobs.entries()) {
      if (!blob.size || blob.size >= SHARED_CHUNK_BYTES) {await flush(); references[index] = await this.upload(blob); continue;}
      if (size + blob.size > SHARED_CHUNK_BYTES) await flush();
      pending.push({index, blob, offset: size}); size += blob.size;
    }
    await flush(); return references;
  }

  private async downloadChunk(chunk: SharedBlobReference['chunks'][number]): Promise<Uint8Array<ArrayBuffer>> {
    this.assertOpen();
    const cached = this.chunks.get(chunk.hash);
    if (cached) {if (cached.byteLength !== chunk.size) throw new SharedWorkspaceError('The shared chunk size is inconsistent.', 'integrity'); return cached;}
    let pending = this.chunkDownloads.get(chunk.hash);
    if (!pending) {
      pending = (async () => {
        const bytes = await this.request(`/api/workspace/blobs/${chunk.hash}`, {}, response => limitedBytes(response, chunk.size));
        if (bytes.byteLength !== chunk.size || await hashBytes(bytes.buffer) !== chunk.hash) throw new SharedWorkspaceError('A shared file failed its integrity check. Reload and try again.', 'integrity');
        this.assertOpen();
        while (this.chunkBytes + bytes.byteLength > 32 * 1024 * 1024 && this.chunks.size) {
          const first = this.chunks.keys().next().value!; this.chunkBytes -= this.chunks.get(first)!.byteLength; this.chunks.delete(first);
        }
        this.chunks.set(chunk.hash, bytes); this.chunkBytes += bytes.byteLength;
        return bytes;
      })();
      this.chunkDownloads.set(chunk.hash, pending);
    }
    try {const bytes = await pending; if (bytes.byteLength !== chunk.size) throw new SharedWorkspaceError('The shared chunk size is inconsistent.', 'integrity'); return bytes;}
    finally {if (this.chunkDownloads.get(chunk.hash) === pending) this.chunkDownloads.delete(chunk.hash);}
  }

  async download(reference: SharedBlobReference): Promise<Blob> {
    this.assertOpen();
    validateBlobReference(reference);
    const key = JSON.stringify(reference);
    const existing = this.downloads.get(key); if (existing) return existing;
    const pending = (async () => {
      const pieces: Uint8Array<ArrayBuffer>[] = [];
      for (const chunk of reference.chunks) {
        const bytes = await this.downloadChunk(chunk);
        pieces.push(chunk.offset === undefined ? bytes : bytes.slice(chunk.offset, chunk.offset + chunk.length!));
      }
      this.assertOpen();
      return new Blob(pieces, {type: reference.mime});
    })();
    this.downloads.set(key, pending);
    try {return await pending;} finally {this.downloads.delete(key);}
  }
}
