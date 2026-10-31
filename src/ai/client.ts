import type { ZodType } from 'zod';
import { inspectRaster } from '../raster-input';
import { uniqueId } from '../identity';
import {
  AI_LIMITS, aiCompanionStatusSchema, aiErrorSchema, aiImageSchema,
  aiSvgRequestSchema, aiSvgResultSchema, aiTestRequestSchema, aiTestResultSchema,
  type AiCompanionStatus, type AiConnection, type AiImageInput, type AiSelection,
  type AiSvgRequest, type AiSvgResult, type AiTestResult,
} from './contracts';

export class AiClientError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'AiClientError'; }
}
function abortError(): DOMException { return new DOMException('The AI request was cancelled.', 'AbortError'); }
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw abortError(); }
function connectionUrl(connection: AiConnection, path: string): string {
  if (!Number.isInteger(connection.port) || connection.port < 1024 || connection.port > 65535)
    throw new AiClientError('INVALID_CONNECTION', 'Choose a companion port between 1024 and 65535.');
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(connection.token))
    throw new AiClientError('PAIRING_REQUIRED', 'Enter the pairing code shown by your Folio companion.');
  return `http://127.0.0.1:${connection.port}${path}`;
}
async function fetchCompanion(connection: AiConnection, path: string, init: RequestInit): Promise<Response> {
  const url = connectionUrl(connection, path);
  try {
    // Current Chromium uses this hint for hosted HTTPS -> loopback permission.
    // Browsers that do not recognize the dictionary member ignore it.
    return await fetch(url, {
      ...init, mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error',
      targetAddressSpace: 'loopback',
      headers: { Authorization: `Bearer ${connection.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    } as RequestInit & { targetAddressSpace: 'loopback' });
  } catch (error) {
    if (init.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw abortError();
    throw new AiClientError('CONNECTION_FAILED', 'Could not reach the local companion. Start it on this computer, check the port, and allow this site to access your local network when your browser asks.');
  }
}
async function readJson(response: Response, signal?: AbortSignal): Promise<unknown> {
  throwIfAborted(signal);
  const maxBytes = AI_LIMITS.svgBytes * 3 + 64 * 1024;
  if (Number(response.headers.get('Content-Length')) > maxBytes)
    throw new AiClientError('INVALID_OUTPUT', 'The companion returned too much data.');
  if (!response.body) throw new AiClientError('INVALID_OUTPUT', 'The companion returned an empty response.');
  const reader = response.body.getReader();
  const cancelRead = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', cancelRead, { once: true });
  const decoder = new TextDecoder();
  let length = 0, text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new AiClientError('INVALID_OUTPUT', 'The companion returned too much data.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { signal?.removeEventListener('abort', cancelRead); reader.releaseLock(); }
  try { return JSON.parse(text); }
  catch { throw new AiClientError('INVALID_OUTPUT', 'The companion did not return a valid response.'); }
}
async function decodeResponse<T>(response: Response, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
  const body = await readJson(response, signal);
  if (!response.ok) {
    const parsed = aiErrorSchema.safeParse(body);
    if (parsed.success) throw new AiClientError(parsed.data.error.code, parsed.data.error.message);
    throw new AiClientError('COMPANION_ERROR', 'The companion could not complete this request.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AiClientError('INVALID_OUTPUT', 'The companion response is incompatible. Update the companion and reconnect.');
  return parsed.data;
}
export async function getAiStatus(connection: AiConnection, signal?: AbortSignal): Promise<AiCompanionStatus> {
  throwIfAborted(signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; cancel(); }, AI_LIMITS.statusTimeoutMs);
  try {
    const result = await decodeResponse(await fetchCompanion(connection, '/v1/status', { signal: controller.signal }), aiCompanionStatusSchema, controller.signal);
    throwIfAborted(signal);
    return result;
  } catch (error) {
    if (timedOut) throw new AiClientError('TIMEOUT', 'The companion connection check timed out. Check Codex in your terminal, then reconnect.');
    if (signal?.aborted) throw abortError();
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
}
export async function cancelAiJob(connection: AiConnection, requestId: string): Promise<void> {
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchCompanion(connection, `/v1/jobs/${requestId}`, { method: 'DELETE', signal: controller.signal });
    if (!response.ok && response.status !== 404) await decodeResponse(response, aiTestResultSchema, controller.signal);
  } finally { clearTimeout(timeout); }
}
async function runRequest<T>(connection: AiConnection, path: string, payload: {requestId: string}, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => { controller.abort(); void cancelAiJob(connection, payload.requestId).catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; cancel(); }, AI_LIMITS.timeoutMs + 30_000);
  try {
    const response = await fetchCompanion(connection, path, { method: 'POST', body: JSON.stringify(payload), signal: controller.signal });
    const result = await decodeResponse(response, schema, controller.signal);
    throwIfAborted(signal);
    if ((result as {requestId?: string}).requestId !== payload.requestId)
      throw new AiClientError('INVALID_OUTPUT', 'The companion returned a result for a different request.');
    return result;
  } catch (error) {
    if (timedOut) throw new AiClientError('TIMEOUT', 'The AI request timed out. Try a smaller source or a faster model.');
    if (signal?.aborted) throw abortError();
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
}
export async function testAiConnection(connection: AiConnection, selection: AiSelection, signal?: AbortSignal): Promise<AiTestResult> {
  const payload = aiTestRequestSchema.parse({ ...selection, requestId: uniqueId() });
  return runRequest(connection, '/v1/test', payload, aiTestResultSchema, signal);
}
export async function requestAiSvg(connection: AiConnection, request: AiSvgRequest, signal?: AbortSignal): Promise<AiSvgResult> {
  const payload = aiSvgRequestSchema.safeParse(request);
  if (!payload.success) throw new AiClientError('INVALID_REQUEST', payload.error.issues[0]?.message ?? 'Check the selected image and SVG.');
  return runRequest(connection, '/v1/svg', payload.data, aiSvgResultSchema, signal);
}

export async function prepareAiImage(blob: Blob, filename: string, signal?: AbortSignal): Promise<AiImageInput> {
  throwIfAborted(signal);
  if (!/^image\/(png|webp|jpeg)$/i.test(blob.type) && !/\.(png|webp|jpe?g)$/i.test(filename))
    throw new AiClientError('INVALID_IMAGE', 'AI recreation accepts PNG, WebP or JPEG images.');
  if (blob.size > AI_LIMITS.imageBytes)
    throw new AiClientError('IMAGE_TOO_LARGE', 'Choose a source image smaller than 8 MiB for AI recreation.');
  const sourceBytes = new Uint8Array(await blob.arrayBuffer());
  throwIfAborted(signal);
  try {
    if (sourceBytes[0] === 0xff && sourceBytes[1] === 0xd8) inspectJpeg(sourceBytes);
    else inspectRaster(sourceBytes);
  } catch {
    throw new AiClientError('INVALID_IMAGE', 'Choose a valid static PNG, WebP or JPEG within 4 megapixels and 4096 pixels per side. Animated images need a single exported frame.');
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw new AiClientError('INVALID_IMAGE', 'This image could not be decoded. Try a PNG, WebP or JPEG image.'); }
  try {
    throwIfAborted(signal);
    const {width, height} = bitmap;
    if (!width || !height || width > AI_LIMITS.side || height > AI_LIMITS.side || width * height > AI_LIMITS.pixels)
      throw new AiClientError('IMAGE_TOO_LARGE', 'AI recreation supports up to 4 megapixels and 4096 pixels per side. Choose a smaller original; Folio does not resize it silently.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new AiClientError('INVALID_IMAGE', 'Your browser could not prepare the image.');
    context.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new AiClientError('INVALID_IMAGE', 'Could not prepare a PNG attachment.')), 'image/png'));
    canvas.width = canvas.height = 1;
    throwIfAborted(signal);
    if (png.size > AI_LIMITS.imageBytes) throw new AiClientError('IMAGE_TOO_LARGE', 'The decoded PNG attachment exceeds 8 MiB. Choose a smaller original.');
    const bytes = new Uint8Array(await png.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    throwIfAborted(signal);
    return aiImageSchema.parse({ name: filename.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'image.png', mimeType: 'image/png', dataBase64: btoa(binary), width, height });
  } finally { bitmap.close(); }
}

/** Read allocation dimensions before browser decode; JPEG EXIF rotation is applied by the browser. */
function inspectJpeg(bytes: Uint8Array): void {
  let offset = 2;
  const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker.');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const size = bytes[offset] * 256 + bytes[offset + 1];
    if (size < 2 || offset + size > bytes.length) throw new Error('Invalid JPEG segment.');
    if (frames.has(marker)) {
      if (size < 8) throw new Error('Invalid JPEG frame.');
      const height = bytes[offset + 3] * 256 + bytes[offset + 4], width = bytes[offset + 5] * 256 + bytes[offset + 6];
      if (!width || !height || width > AI_LIMITS.side || height > AI_LIMITS.side || width * height > AI_LIMITS.pixels) throw new Error('Image size limit.');
      return;
    }
    offset += size;
  }
  throw new Error('Missing JPEG frame.');
}
