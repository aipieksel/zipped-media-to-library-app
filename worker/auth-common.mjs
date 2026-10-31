/** Shared HTTP controls. No browser identity/header is trusted as a Folio session. */
export class HttpError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

export function json(value, status = 200, sourceHeaders) {
  const headers = new Headers(sourceHeaders);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'private, no-store');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('vary', 'Cookie');
  headers.delete('content-length');
  return new Response(JSON.stringify(value), {status, headers});
}

export function failure(error) {
  if (error instanceof HttpError) return json({error: error.message, code: error.code, ...error.extra}, error.status);
  // Database/auth errors can contain SQL, emails or credential data: never echo/log them.
  return json({error: 'The workspace service is unavailable. Please try again.', code: 'unavailable'}, 503);
}

export function assertOrigin(request, env) {
  const origin = new URL(request.url).origin;
  if ((env.FOLIO_APP_ORIGIN && env.FOLIO_APP_ORIGIN !== origin) || request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'origin', 'This action must be requested from Folio.');
  }
}

export async function boundedBytes(request, limit) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new HttpError(413, 'too_large', 'This request is too large.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'too_large', 'This request is too large.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}

export async function bodyJSON(request, limit = 16_384) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'content_type', 'Send JSON for this action.');
  try {
    const value = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(await boundedBytes(request, limit)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object');
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_json', 'The request must contain a JSON object.');
  }
}

export async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
}

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
}

/** One persistent atomic counter per policy/window; shared by Worker instances. */
export async function rateLimit(env, namespace, identity, maximum, windowMs = 60_000) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const key = await sha256(`${namespace}:${identity}:${bucket}`);
  const result = await env.DB.prepare('INSERT INTO folio_limits (key, attempts, expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key, (bucket + 2) * windowMs).first();
  if (result.attempts > maximum) throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait before trying again.');
  await env.DB.prepare('DELETE FROM folio_limits WHERE key IN (SELECT key FROM folio_limits WHERE expires_at < ? LIMIT 100)').bind(now).run();
}

export function clientIdentity(request) {
  // These are rate-limit labels only; neither header authenticates a Folio user.
  return request.headers.get('cf-connecting-ip') || request.headers.get('oai-authenticated-user-id') || 'unknown';
}

export function method(request, expected) {
  if (request.method !== expected) throw new HttpError(405, 'method', `Use ${expected} for this action.`);
}
