import test from 'node:test';
import assert from 'node:assert/strict';
// Runtime-native Worker module; tests supply synthetic Sites dispatch headers.
// @ts-ignore
import {handleAccount} from '../worker/account.mjs';

const ID = 'oai-authenticated-user-id';
const EMAIL = 'oai-authenticated-user-email';
const NAME = 'oai-authenticated-user-full-name';
const ENCODING = 'oai-authenticated-user-full-name-encoding';
const identity = {[ID]: 'fixture-site-user-1', [EMAIL]: 'member@example.test'};
const signInPath = '/signin-with-chatgpt?return_to=%2F';
const signOutPath = '/signout-with-chatgpt?return_to=%2F';

function request(headers: Record<string, string> = {}, method = 'GET', path = '/api/account', body?: string): Request {
  return new Request('https://folio.example.test' + path, {method, headers, ...(body === undefined ? {} : {body})});
}

test('account route returns the trusted per-site identity and fixed top-level auth paths', async () => {
  const result = handleAccount(request(identity));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    authenticated: true,
    profile: {userId: identity[ID], email: identity[EMAIL], fullName: null, displayName: identity[EMAIL]},
    signInPath, signOutPath,
  });
});

test('missing, partial and malformed identity remains unauthenticated', async () => {
  for (const headers of [{}, {[ID]: identity[ID]}, {[EMAIL]: identity[EMAIL]}, {...identity, [ID]: ' '}, {...identity, [ID]: 'bad id'}, {...identity, [ID]: 'x'.repeat(513)}, {...identity, [EMAIL]: 'not-an-email'}, {...identity, [EMAIL]: 'a'.repeat(321)}]) {
    const result = handleAccount(request(headers));
    assert.equal(result.status, 401);
    assert.deepEqual(await result.json(), {authenticated: false, profile: null, signInPath, signOutPath});
  }
});

test('names use the Sites percent-encoded UTF-8 marker and safely fall back to email', async () => {
  const name = 'Renée 安 + Co';
  const result = handleAccount(request({...identity, [NAME]: encodeURIComponent(name), [ENCODING]: 'percent-encoded-utf-8'}));
  assert.equal((await result.json()).profile.fullName, name);
  for (const extra of [
    {[NAME]: encodeURIComponent(name)},
    {[NAME]: encodeURIComponent(name), [ENCODING]: 'unknown'},
    {[NAME]: '%E0%A4%A', [ENCODING]: 'percent-encoded-utf-8'},
    {[NAME]: '%00admin', [ENCODING]: 'percent-encoded-utf-8'},
    {[NAME]: '%20', [ENCODING]: 'percent-encoded-utf-8'},
    {[NAME]: 'x'.repeat(513), [ENCODING]: 'percent-encoded-utf-8'},
  ]) {
    const fallback = await handleAccount(request({...identity, ...extra})).json();
    assert.equal(fallback.profile.fullName, null);
    assert.equal(fallback.profile.displayName, identity[EMAIL]);
  }
});

test('a display name without identity cannot establish a session', async () => {
  const result = handleAccount(request({[NAME]: 'Someone', [ENCODING]: 'percent-encoded-utf-8'}));
  assert.equal(result.status, 401);
  assert.equal((await result.json()).profile, null);
});

test('identity responses and failures are private, uncached and not shared through CORS', () => {
  for (const result of [handleAccount(request(identity)), handleAccount(request()), handleAccount(request(identity, 'POST', '/api/account', '{}'))]) {
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.headers.get('pragma'), 'no-cache');
    assert.equal(result.headers.get('expires'), '0');
    assert.match(result.headers.get('content-type')!, /^application\/json;/);
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(result.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(result.headers.get('access-control-allow-origin'), null);
    assert.equal(result.headers.get('etag'), null);
    for (const header of [ID, EMAIL, NAME, ENCODING]) assert.ok(result.headers.get('vary')!.split(', ').includes(header));
  }
});

test('query, cookies, bearer and administrative tokens are not user identity', async () => {
  const result = handleAccount(request({
    'cookie': 'userId=claimed-user; email=claimed@example.test',
    'authorization': 'Bearer synthetic-service-fixture',
    'OAI-Sites-Authorization': 'Bearer synthetic-bypass-fixture',
    'x-folio-ingest-token': 'synthetic-admin-fixture',
    'x-user-id': 'claimed-user',
    'x-user-email': 'claimed@example.test',
  }, 'GET', '/api/account?userId=claimed-user&email=claimed%40example.test&authenticated=true'));
  assert.equal(result.status, 401);
  assert.equal((await result.json()).authenticated, false);
});

test('account is read-only and does not accept identity mutations in a request body', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const result = handleAccount(request(identity, method, '/api/account', JSON.stringify({authenticated: true, profile: identity})));
    assert.equal(result.status, 405);
    assert.equal(result.headers.get('allow'), 'GET, HEAD');
    assert.equal((await result.json()).authenticated, false);
  }
  for (const [headers, status] of [[identity, 200], [{}, 401]] as const) {
    const result = handleAccount(request(headers, 'HEAD'));
    assert.equal(result.status, status);
    assert.equal(await result.text(), '');
  }
});

test('caller return paths cannot redirect auth to another origin or reserved route', async () => {
  for (const returnTo of ['https://attacker.example.test/', '//attacker.example.test/', '/signin-with-chatgpt', '/callback']) {
    const result = await handleAccount(request(identity, 'GET', '/api/account?return_to=' + encodeURIComponent(returnTo))).json();
    assert.equal(result.signInPath, signInPath);
    assert.equal(result.signOutPath, signOutPath);
    for (const path of [result.signInPath, result.signOutPath]) assert.equal(new URL(path, 'https://folio.example.test').origin, 'https://folio.example.test');
  }
});

test('account route does not intercept existing files, collection or platform auth paths', () => {
  for (const path of ['/', '/api/account/other', '/api/collection', '/signin-with-chatgpt', '/signout-with-chatgpt', '/callback']) assert.equal(handleAccount(request(identity, 'GET', path)), null);
});
