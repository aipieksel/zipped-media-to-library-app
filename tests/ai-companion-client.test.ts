import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiStatus, testAiConnection } from '../src/ai/client';
import { AI_LIMITS } from '../src/ai/contracts';

const connection = {port: 8798, token: 'a'.repeat(43)};
const status = {protocolVersion: 1, companionVersion: '1.0.0', activeRequestId: null, providers: [], checkedAt: new Date().toISOString()};

test('status requests use only loopback and the intended local permission hint', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit & {targetAddressSpace?: string}) => {
    assert.equal(url, 'http://127.0.0.1:8798/v1/status');
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    assert.equal(init.targetAddressSpace, 'loopback');
    assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${connection.token}`);
    return new Response(JSON.stringify(status));
  });
  assert.deepEqual(await getAiStatus(connection), status);
  await assert.rejects(getAiStatus({...connection, port: 80}), /between 1024/);
  await assert.rejects(getAiStatus({...connection, token: ''}), /pairing code/);
});

test('status cancellation interrupts a response whose body never finishes', async (t) => {
  const controller = new AbortController(); let readerCancelled = false;
  let responseStarted!: () => void;
  const started = new Promise<void>((resolve) => { responseStarted = resolve; });
  t.mock.method(globalThis, 'fetch', async () => {
    const body = new ReadableStream<Uint8Array>({start(stream) {stream.enqueue(new TextEncoder().encode('{'));}, cancel() {readerCancelled = true;}});
    responseStarted(); return new Response(body);
  });
  const operation = getAiStatus(connection, controller.signal);
  await started; await Promise.resolve(); controller.abort();
  await assert.rejects(operation, {name: 'AbortError'});
  assert.equal(readerCancelled, true);
});

test('the complete status request deadline includes a held response body', async (t) => {
  let readerCancelled = false, capturedDeadline = 0;
  const realTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback: (...args: unknown[]) => void, milliseconds: number, ...args: unknown[]) => {
    if (milliseconds === AI_LIMITS.statusTimeoutMs) {capturedDeadline = milliseconds; return realTimeout(callback, 5, ...args);}
    return realTimeout(callback, milliseconds, ...args);
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream<Uint8Array>({cancel() {readerCancelled = true;}})));
  await assert.rejects(getAiStatus(connection), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'TIMEOUT'));
  assert.equal(capturedDeadline, AI_LIMITS.statusTimeoutMs); assert.equal(readerCancelled, true);
});

test('status cancellation before connecting has no network effect', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {calls++; return new Response('{}');});
  const controller = new AbortController(); controller.abort();
  await assert.rejects(getAiStatus(connection, controller.signal), {name: 'AbortError'});
  assert.equal(calls, 0);
});

test('a connection test uses the shared secure UUID fallback when randomUUID is unavailable', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', {value: undefined, configurable: true});
  try {
    t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      assert.match(body.requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      return new Response(JSON.stringify({requestId: body.requestId, ok: true, provider: 'codex', model: 'fixture', message: 'Fixture', checkedAt: new Date().toISOString()}));
    });
    assert.equal((await testAiConnection(connection, {provider: 'codex', model: 'fixture', reasoning: 'high'})).ok, true);
  } finally {if (descriptor) Object.defineProperty(crypto, 'randomUUID', descriptor); else delete (crypto as unknown as Record<string, unknown>).randomUUID;}
});
