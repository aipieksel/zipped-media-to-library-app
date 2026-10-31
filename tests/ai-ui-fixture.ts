/// <reference types="vite/client" />

/** Scoped development adapter. Imported only by the ignored actual-app QA page. */
import {
  AI_LIMITS, aiCompanionStatusSchema, aiSvgRequestSchema, aiSvgResultSchema,
  aiTestRequestSchema, aiTestResultSchema,
} from '../src/ai/contracts';
import {inspectRaster} from '../src/raster-input';

if (!import.meta.env.DEV) throw new Error('AI UI fixtures are available only in the development harness.');

export const AI_UI_FIXTURE_LABEL = 'QA fixture · no provider';
export const AI_UI_FIXTURE_TOKEN = 'A'.repeat(43);
const MODEL = 'qa-fixture-no-provider';
const ORIGIN = 'http://127.0.0.1:8798';
export type AiUiFixtureMode = 'success' | 'held' | 'unsafe';
type Realm = Window & typeof globalThis;

export function installAiUiFixture(
  realm: Realm,
  mode: () => AiUiFixtureMode,
  observe: (value: unknown) => void,
): {dispose: () => void} {
  const originalFetch = realm.fetch;
  const held = new Map<string, () => void>();
  const seen = new Set<string>();
  let disposed = false;
  const receipt = (details: Record<string, unknown>) => observe({
    scope: AI_UI_FIXTURE_LABEL, providerRequests: 0, ...details,
  });
  const aborted = () => new realm.DOMException(`${AI_UI_FIXTURE_LABEL}: request cancelled.`, 'AbortError');
  const checkAbort = (signal: AbortSignal) => {if (signal.aborted) throw aborted();};
  const json = (body: unknown, status = 200) => new realm.Response(JSON.stringify(body), {
    status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
  });
  const failure = (code: string, message: string, status = 400) => json({
    error: {code, message: `${AI_UI_FIXTURE_LABEL}: ${message}`},
  }, status);
  const status = () => aiCompanionStatusSchema.parse({
    protocolVersion: 1, companionVersion: MODEL, activeRequestId: held.keys().next().value ?? null,
    checkedAt: new Date().toISOString(),
    providers: [{
      id: 'codex', name: AI_UI_FIXTURE_LABEL, installed: true, version: MODEL,
      auth: 'not-checked', ready: true,
      reason: `${AI_UI_FIXTURE_LABEL}. Simulated UI responses; no CLI, account or provider was contacted.`,
      capabilities: ['recreate-svg', 'clean-svg'],
      models: [{
        id: MODEL, name: AI_UI_FIXTURE_LABEL, description: `${AI_UI_FIXTURE_LABEL}. Procedural SVG response for UI checks only.`,
        defaultReasoning: 'medium', reasoning: [{id: 'medium', description: AI_UI_FIXTURE_LABEL}], supportsImages: true,
      }],
    }],
  });

  const intercept = async (input: RequestInfo | URL, init: RequestInit | undefined, url: URL): Promise<Response> => {
    const request = new realm.Request(input, init);
    checkAbort(request.signal);
    if (disposed) return failure('QA_DISABLED', 'Reload or enable the fixture again.', 503);
    if (url.username || url.password || url.search || url.hash)
      return failure('QA_URL', 'Only the exact fixture endpoint is supported.');
    if (request.headers.get('Authorization') !== `Bearer ${AI_UI_FIXTURE_TOKEN}`)
      return failure('UNAUTHORIZED', 'Use the public 43-character A pairing code displayed by the harness.', 401);
    if (url.pathname === '/v1/status' && request.method === 'GET') {
      receipt({action: 'status response', authentication: 'not checked; fixture only'});
      return json(status());
    }
    const cancellation = /^\/v1\/jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(url.pathname);
    if (cancellation && request.method === 'DELETE') {
      const requestId = cancellation[1];
      held.get(requestId)?.();
      receipt({action: 'cancel acknowledgement', requestId, knownRequest: seen.has(requestId)});
      return new realm.Response(null, {status: seen.has(requestId) ? 204 : 404});
    }
    if (!['/v1/svg', '/v1/test'].includes(url.pathname) || request.method !== 'POST')
      return failure('NOT_FOUND', 'This fixture route or method is unavailable.', 404);
    if (request.headers.get('Content-Type') !== 'application/json')
      return failure('INVALID_REQUEST', 'The fixture requires JSON.');
    const body = await request.text(); checkAbort(request.signal);
    if (new TextEncoder().encode(body).byteLength > AI_LIMITS.requestBytes)
      return failure('INVALID_REQUEST', 'The request exceeds the shared size limit.');
    let value: unknown;
    try {value = JSON.parse(body);} catch {return failure('INVALID_REQUEST', 'The request is not valid JSON.');}
    const svgParsed = url.pathname === '/v1/svg' ? aiSvgRequestSchema.safeParse(value) : null;
    const testParsed = url.pathname === '/v1/test' ? aiTestRequestSchema.safeParse(value) : null;
    const svgRequest = svgParsed?.success ? svgParsed.data : null;
    const testRequest = testParsed?.success ? testParsed.data : null;
    const payload = svgRequest ?? testRequest;
    if (!payload) return failure('INVALID_REQUEST', 'Request ID, attachment, instructions or selection failed the shared schema.');
    if (payload.provider !== 'codex' || payload.model !== MODEL || payload.reasoning !== 'medium')
      return failure('INVALID_SELECTION', 'Select the QA fixture model and medium reasoning.');
    if (held.size) return failure('BUSY', 'Cancel the held fixture request before starting another.', 409);
    if (seen.has(payload.requestId)) return failure('DUPLICATE_REQUEST', 'Request IDs must be unique.', 409);
    const responseMode = mode();
    if (!['success', 'held', 'unsafe'].includes(responseMode)) return failure('QA_MODE', 'Unknown fixture response mode.');
    if (svgRequest) {
      try {
        const bytes = Uint8Array.from(realm.atob(svgRequest.image.dataBase64), character => character.charCodeAt(0));
        const image = inspectRaster(bytes);
        if (bytes.byteLength > AI_LIMITS.imageBytes || image.format !== 'png' || image.width !== svgRequest.image.width || image.height !== svgRequest.image.height)
          return failure('INVALID_IMAGE', 'PNG attachment bytes and native dimension metadata do not agree.');
        receipt({action: 'validated SVG request', requestId: payload.requestId, mode: responseMode,
          operation: svgRequest.operation, attachmentBytes: bytes.byteLength, dimensions: [image.width, image.height],
          instructionsLength: svgRequest.instructions.length, instructionsSchemaValid: true,
          currentSvgIncluded: Boolean(svgRequest.currentSvg), requestIdSchemaValid: true,
          boundary: 'Only metadata recorded; attachment bytes, source filename, SVG and instruction text are omitted.'});
      } catch {return failure('INVALID_IMAGE', 'The supplied attachment is not a valid static PNG container.');}
    } else receipt({action: 'validated text test request', requestId: payload.requestId, mode: responseMode});
    checkAbort(request.signal);
    seen.add(payload.requestId);
    if (responseMode === 'held') return new Promise<Response>((_resolve, reject) => {
      const cancel = () => {
        request.signal.removeEventListener('abort', cancel);
        held.delete(payload.requestId);
        receipt({action: 'held request cancelled', requestId: payload.requestId});
        reject(aborted());
      };
      held.set(payload.requestId, cancel);
      request.signal.addEventListener('abort', cancel, {once: true});
      if (request.signal.aborted) cancel();
      else receipt({action: 'request held until AbortSignal or cancel endpoint', requestId: payload.requestId});
    });
    if (!svgRequest) return json(aiTestResultSchema.parse({
      requestId: payload.requestId, ok: true, provider: 'codex', model: MODEL,
      message: `${AI_UI_FIXTURE_LABEL}. Simulated text response; not an account or inference test.`, checkedAt: new Date().toISOString(),
    }));
    const {width, height} = svgRequest.image;
    const unsafe = responseMode === 'unsafe' ? `<script>/* ${AI_UI_FIXTURE_LABEL}: must be rejected */</script>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${AI_UI_FIXTURE_LABEL}</title>${unsafe}<rect width="${width}" height="${height}" fill="#49745a"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="#e7c17d" fill-opacity="0.65"/></svg>`;
    receipt({action: responseMode === 'unsafe' ? 'unsafe SVG returned for sanitizer rejection' : 'procedural SVG returned', requestId: payload.requestId});
    return json(aiSvgResultSchema.parse({requestId: payload.requestId, provider: 'codex', model: MODEL,
      svg, summary: `${AI_UI_FIXTURE_LABEL}. Deterministic ${width} × ${height} procedural artwork; no reconstruction quality or real-account claim.`, createdAt: new Date().toISOString(),
    }));
  };

  const wrapped: typeof fetch = (input, init) => {
    const address = typeof input === 'string' ? input : 'url' in input ? input.url : input.toString();
    const url = new URL(address, realm.location.href);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/v1/')) return originalFetch.call(realm, input, init);
    return intercept(input, init, url);
  };
  realm.fetch = wrapped;
  receipt({action: 'fixture enabled', interceptedOrigin: ORIGIN, paths: '/v1/*', authentication: 'not checked; fixture only'});
  return {dispose: () => {
    if (disposed) return;
    disposed = true;
    for (const cancel of Array.from(held.values())) cancel();
    // Keep the disabled endpoint blocked until this iframe reloads. A late
    // production cancel callback must never fall through to a real companion.
    receipt({action: 'fixture disabled; endpoint remains blocked until iframe reload'});
  }};
}
