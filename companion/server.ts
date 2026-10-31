import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AI_COMPANION_PORT, AI_LIMITS, aiCompanionStatusSchema, aiSvgRequestSchema,
  aiSvgResultSchema, aiTestRequestSchema, aiTestResultSchema, type AiCompanionStatus,
} from '../src/ai/contracts';
import { CodexDriver, type AiDriver } from './codex';
import { CompanionError, publicError } from './errors';

export const DEFAULT_FOLIO_ORIGIN = 'https://folio-html-workspace.byronjacobs.chatgpt.site';
export interface CompanionOptions {
  port?: number; origin?: string; token?: string; driver?: AiDriver;
  timeoutMs?: number; // trusted host/test option, never accepted over HTTP
}
interface ActiveJob {
  id: string | null; controller: AbortController; done: Promise<void>; finish: () => void; timedOut: boolean;
}
export function normalizeOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Provide a valid Folio origin.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use only the Folio origin, without a path or credentials.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
    throw new Error('The Folio origin must use HTTPS, or localhost for development.');
  return url.origin;
}
async function bodyJson(request: IncomingMessage, signal: AbortSignal): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '') || request.headers['content-encoding'])
    throw new CompanionError('INVALID_REQUEST', 'Send an uncompressed JSON request.', 415);
  const contentLength = request.headers['content-length'];
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > AI_LIMITS.requestBytes))
    throw new CompanionError('PAYLOAD_TOO_LARGE', 'The AI request exceeds 14 MiB.', 413);
  const parts: Buffer[] = []; let length = 0;
  const abortRead = () => request.destroy();
  signal.addEventListener('abort', abortRead, { once: true });
  try {
    for await (const part of request) {
      if (signal.aborted) throw new CompanionError('CANCELLED', 'The AI request was cancelled.', 409);
      const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part);
      length += buffer.byteLength;
      if (length > AI_LIMITS.requestBytes) throw new CompanionError('PAYLOAD_TOO_LARGE', 'The AI request exceeds 14 MiB.', 413);
      parts.push(buffer);
    }
  } finally { signal.removeEventListener('abort', abortRead); }
  if (signal.aborted) throw new CompanionError('CANCELLED', 'The AI request was cancelled.', 409);
  try { return JSON.parse(Buffer.concat(parts, length).toString('utf8')); }
  catch { throw new CompanionError('INVALID_REQUEST', 'The companion received invalid JSON.'); }
}
function json(response: ServerResponse, status: number, body: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  const text = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  response.end(text);
}
export async function startCompanion(options: CompanionOptions = {}) {
  const origin = normalizeOrigin(options.origin ?? DEFAULT_FOLIO_ORIGIN);
  const requestedPort = options.port ?? AI_COMPANION_PORT;
  if (!Number.isInteger(requestedPort) || (requestedPort !== 0 && (requestedPort < 1024 || requestedPort > 65535))) throw new Error('Invalid companion port.');
  const token = options.token ?? randomBytes(32).toString('base64url');
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new Error('A strong pairing token is required.');
  const expected = Buffer.from(`Bearer ${token}`);
  const driver = options.driver ?? new CodexDriver();
  let active: ActiveJob | null = null;
  const activeId = () => active?.id ?? null;
  let lastStatus: AiCompanionStatus | null = null;
  let pendingStatus: Promise<AiCompanionStatus> | null = null;
  const shutdown = new AbortController();
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    void (async () => {
      const address = server.address();
      const actualPort = address && typeof address !== 'string' ? address.port : requestedPort;
      if (request.headers.host !== `127.0.0.1:${actualPort}`) throw new CompanionError('ORIGIN_NOT_ALLOWED', 'The companion accepts loopback requests only.', 403);
      if (request.headers.origin !== origin) throw new CompanionError('ORIGIN_NOT_ALLOWED', 'This site is not paired with the companion. Start it with your exact Folio origin.', 403);
      response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');
      if (request.method === 'OPTIONS') {
        const headers = (request.headers['access-control-request-headers'] ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
        if (!['GET', 'POST', 'DELETE'].includes(String(request.headers['access-control-request-method'])) || headers.some((header) => !['authorization', 'content-type'].includes(header)))
          throw new CompanionError('ORIGIN_NOT_ALLOWED', 'This request is not allowed.', 403);
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' });
        response.end(); return;
      }
      const supplied = Buffer.from(request.headers.authorization ?? '');
      if (supplied.byteLength !== expected.byteLength || !timingSafeEqual(supplied, expected))
        throw new CompanionError('PAIRING_REQUIRED', 'The pairing code is missing or expired. Copy the current code from your companion terminal.', 401);
      if (request.method === 'GET' && request.url === '/v1/status') {
        if (active) {
          if (!lastStatus) throw new CompanionError('COMPANION_BUSY', 'An AI request is in progress. Wait or cancel it before checking the connection.', 409);
          json(response, 200, { ...lastStatus, activeRequestId: active.id }); return;
        }
        pendingStatus ??= driver.status(shutdown.signal).finally(() => { pendingStatus = null; });
        lastStatus = aiCompanionStatusSchema.parse(await pendingStatus);
        json(response, 200, { ...lastStatus, activeRequestId: activeId() }); return;
      }
      const cancelMatch = request.url?.match(/^\/v1\/jobs\/([a-f0-9-]{36})$/i);
      if (request.method === 'DELETE' && cancelMatch) {
        if (active?.id === cancelMatch[1]) { const job = active; job.controller.abort(); await job.done; }
        response.writeHead(204); response.end(); return;
      }
      if (request.method !== 'POST' || !['/v1/svg', '/v1/test'].includes(request.url ?? ''))
        throw new CompanionError('NOT_FOUND', 'This companion endpoint does not exist.', 404);
      if (active || pendingStatus) throw new CompanionError('COMPANION_BUSY', 'The companion is busy. Wait for the current request to finish or cancel it.', 409);
      let resolveDone!: () => void;
      const job: ActiveJob = { id: null, controller: new AbortController(), done: new Promise<void>((resolve) => { resolveDone = resolve; }), finish: () => resolveDone(), timedOut: false };
      active = job;
      const close = () => { if (!response.writableEnded) job.controller.abort(); };
      response.once('close', close);
      const timer = setTimeout(() => { job.timedOut = true; job.controller.abort(); }, options.timeoutMs ?? AI_LIMITS.timeoutMs);
      try {
        const body = await bodyJson(request, job.controller.signal);
        if (request.url === '/v1/svg') {
          const parsed = aiSvgRequestSchema.safeParse(body);
          if (!parsed.success) throw new CompanionError('INVALID_REQUEST', 'Check the image, SVG size, model and instructions. Cleanup requires a current SVG of at most 2 MiB; use Recreate for larger geometry.');
          job.id = parsed.data.requestId;
          const result = aiSvgResultSchema.parse(await driver.generate(parsed.data, job.controller.signal));
          if (result.requestId !== job.id) throw new CompanionError('INVALID_OUTPUT', 'The AI result did not match this request.', 502);
          if (!job.controller.signal.aborted) json(response, 200, result);
        } else {
          const parsed = aiTestRequestSchema.safeParse(body);
          if (!parsed.success) throw new CompanionError('INVALID_REQUEST', 'Choose a model and reasoning level before testing.');
          job.id = parsed.data.requestId;
          const result = aiTestResultSchema.parse(await driver.test(parsed.data, job.controller.signal));
          if (result.requestId !== job.id) throw new CompanionError('INVALID_OUTPUT', 'The connection result did not match this request.', 502);
          if (!job.controller.signal.aborted) json(response, 200, result);
        }
        if (job.controller.signal.aborted) throw new CompanionError(job.timedOut ? 'TIMEOUT' : 'CANCELLED', job.timedOut ? 'The AI request timed out. Try a faster model or a simpler image.' : 'The AI request was cancelled.', job.timedOut ? 504 : 409);
      } catch (error) {
        if (job.timedOut) throw new CompanionError('TIMEOUT', 'The AI request timed out. Try a faster model or a simpler image.', 504);
        throw error;
      } finally {
        clearTimeout(timer); response.removeListener('close', close);
        if (active === job) active = null;
        job.finish();
      }
    })().catch((error) => {
      if (response.destroyed || response.writableEnded) return;
      const safe = publicError(error);
      response.setHeader('Connection', 'close');
      json(response, safe.status, { error: { code: safe.code, message: safe.message } });
    });
  });
  server.requestTimeout = 30_000; server.headersTimeout = 15_000; server.maxHeadersCount = 40;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(requestedPort, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  const address = server.address();
  const port = address && typeof address !== 'string' ? address.port : requestedPort;
  return {
    server, port, token, origin,
    async close(): Promise<void> {
      shutdown.abort(); active?.controller.abort();
      if (active) await active.done;
      if (pendingStatus) await pendingStatus.catch(() => undefined);
      await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeIdleConnections(); });
    },
  };
}
