import {hashBytes, SHARED_CHUNK_BYTES, SHARED_DOCUMENT_BYTES} from '../src/shared/client';
import type {DocumentName, SharedDocument} from '../src/shared/client';

/** Isolated synthetic transport; production endpoints and accounts are never called. */
export function createSharedMemoryServer() {
  const documents = new Map<DocumentName, SharedDocument>(), chunks = new Map<string, Uint8Array<ArrayBuffer>>();
  const calls: {method: string; path: string; bytes: number}[] = [];
  let failWrites = false;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json'}});
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input instanceof Request ? input : new URL(String(input), 'https://folio-shared.test'), init);
    const path = new URL(request.url).pathname, bytes = request.method === 'PUT' ? new Uint8Array(await request.arrayBuffer()) : new Uint8Array();
    calls.push({method: request.method, path, bytes: bytes.byteLength});
    if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (request.method === 'PUT' && failWrites) return json({error: 'Synthetic connection failure.', code: 'fixture-failed'}, 503);
    const blob = /^\/api\/workspace\/blobs\/([a-f0-9]{64})$/.exec(path);
    if (blob) {
      if (request.method === 'PUT') {
        if (bytes.byteLength > SHARED_CHUNK_BYTES || await hashBytes(bytes.buffer) !== blob[1]) return json({error: 'Bad chunk.'}, 400);
        chunks.set(blob[1], bytes); return json({hash: blob[1], size: bytes.byteLength});
      }
      const published = [...documents.values()].some(document => document.blobs.includes(blob[1]));
      if (!published || !chunks.has(blob[1])) return json({error: 'Missing chunk.'}, 404);
      return new Response(chunks.get(blob[1])!, {headers: {'content-type': 'application/octet-stream'}});
    }
    const match = /^\/api\/workspace\/documents\/(library|icons|appearance)$/.exec(path);
    if (!match) return json({error: 'No fixture endpoint.'}, 404);
    const name = match[1] as DocumentName, current = documents.get(name) ?? {name, revision: 0, data: null, blobs: [], updatedAt: null};
    if (request.method !== 'PUT') return json(current);
    if (bytes.byteLength > SHARED_DOCUMENT_BYTES) return json({error: 'Metadata is too large.'}, 413);
    const candidate = JSON.parse(new TextDecoder().decode(bytes)) as {expectedRevision: number; data: Record<string, unknown>; blobs: string[]};
    if (candidate.expectedRevision !== current.revision) return json({error: 'Concurrent workspace edit.', code: 'conflict', revision: current.revision}, 409);
    if (candidate.blobs.length > 10000 || candidate.blobs.some(hash => !chunks.has(hash))) return json({error: 'Unpublished bytes.'}, 400);
    const committed = {name, revision: current.revision + 1, data: candidate.data, blobs: candidate.blobs, updatedAt: Date.now()};
    documents.set(name, structuredClone(committed)); return json(committed);
  };
  return {fetcher, documents, chunks, calls, failWrites(value: boolean) {failWrites = value;}};
}
