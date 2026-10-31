import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountRequestError, createFolioAccountClient, isSessionDenied} from '../src/account/client';
import {accountNameError, accountPasswordError, FolioSessionSchema, SITE_SIGN_IN_PATH, SITE_SIGN_OUT_PATH} from '../src/account/contracts';
import {accountCapabilityLink, isAuthRoute, parseAuthRoute} from '../src/account/routes';

const account = {id: 'fixture-member-1', email: 'member@example.test', name: 'Fixture Member', role: 'member'};
const session = {authenticated: true, account, setupRequired: false, canBootstrap: false, canRecoverOwner: false, siteSignInPath: SITE_SIGN_IN_PATH, siteSignOutPath: SITE_SIGN_OUT_PATH};
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json'}});
const token = 'a'.repeat(64);

test('account login uses same-origin cookies and JSON with no redirect or response-token exposure', async () => {
  let seen: {path: string; init: RequestInit} | undefined;
  const client = createFolioAccountClient(async (input, init) => {
    seen = {path: String(input), init: init!};
    return reply({account, token: 'fixture-token-that-must-not-be-retained'});
  });
  const result = await client.login({email: '  MEMBER@example.test ', password: 'synthetic-password-1'});
  assert.equal(seen?.path, '/api/folio-auth/login');
  assert.equal(seen?.init.credentials, 'same-origin');
  assert.equal(seen?.init.cache, 'no-store');
  assert.equal(seen?.init.redirect, 'error');
  assert.equal(seen?.init.method, 'POST');
  assert.deepEqual(JSON.parse(String(seen?.init.body)), {email: 'member@example.test', password: 'synthetic-password-1'});
  assert.equal(new Headers(seen?.init.headers).get('content-type'), 'application/json');
  assert.equal(new Headers(seen?.init.headers).has('authorization'), false);
  assert.deepEqual(result, {account});
});

test('session parsing rejects identity and navigation inconsistencies', async () => {
  assert.equal(FolioSessionSchema.safeParse(session).success, true);
  for (const bad of [
    {...session, authenticated: false}, {...session, account: null},
    {...session, siteSignInPath: 'https://outside.example.test/login'},
    {...session, setupRequired: false, canBootstrap: true},
    {...session, setupRequired: true, canRecoverOwner: true},
  ]) {
    const client = createFolioAccountClient(async () => reply(bad));
    await assert.rejects(client.session(), (failure: unknown) => failure instanceof AccountRequestError && failure.code === 'response');
  }
});

test('bad step-up credentials and owner permissions do not masquerade as revoked sessions', () => {
  assert.equal(isSessionDenied(new AccountRequestError(401, 'signed_out', 'Sign in.')), true);
  assert.equal(isSessionDenied(new AccountRequestError(403, 'membership', 'No access.')), true);
  assert.equal(isSessionDenied(new AccountRequestError(401, 'credentials', 'Wrong password.')), false);
  assert.equal(isSessionDenied(new AccountRequestError(403, 'owner_required', 'Owner required.')), false);
  assert.equal(isSessionDenied(new Error('signed_out')), false);
});

test('structured account errors survive without reflecting submitted credentials', async () => {
  const client = createFolioAccountClient(async () => reply({error: 'The current password could not be verified.', code: 'credentials'}, 401));
  await assert.rejects(client.changePassword({currentPassword: 'synthetic-old-password', newPassword: 'synthetic-new-password'}), (failure: unknown) => {
    assert.ok(failure instanceof AccountRequestError);
    assert.equal(failure.status, 401); assert.equal(failure.code, 'credentials');
    assert.equal(failure.message.includes('synthetic'), false);
    return true;
  });
});

test('member identifiers cannot change the request route; DELETE still carries JSON', async () => {
  const calls: {path: string; init: RequestInit}[] = [];
  const client = createFolioAccountClient(async (input, init) => {calls.push({path: String(input), init: init!}); return reply({ok: true});});
  assert.throws(() => client.setMemberStatus('../owner-recovery', 'disabled'), AccountRequestError);
  assert.equal(calls.length, 0);
  await client.revokeInvitation('fixture-invite-1');
  assert.equal(calls[0].path, '/api/folio-auth/invitations/fixture-invite-1');
  assert.equal(calls[0].init.method, 'DELETE'); assert.equal(calls[0].init.body, '{}');
});

test('HTML and oversized account responses are rejected with bounded safe errors', async () => {
  const html = createFolioAccountClient(async () => new Response('<html>private provider page</html>', {headers: {'content-type': 'text/html'}}));
  await assert.rejects(html.session(), (failure: unknown) => failure instanceof AccountRequestError && failure.code === 'response' && !failure.message.includes('private provider'));
  const oversized = createFolioAccountClient(async () => new Response(new Uint8Array(1024 * 1024 + 1), {headers: {'content-type': 'application/json'}}));
  await assert.rejects(oversized.session(), (failure: unknown) => failure instanceof AccountRequestError && failure.message === 'The account response was too large.');
});

test('a lost mutation response is reported as unconfirmed rather than an unperformed action', async () => {
  const client = createFolioAccountClient(async () => {throw new TypeError('fixture disconnected');});
  await assert.rejects(client.login({email: 'member@example.test', password: 'synthetic-password'}), (failure: unknown) =>
    failure instanceof AccountRequestError && failure.code === 'network' && failure.message.includes('could not be confirmed') && !failure.message.includes('synthetic-password'));
});

test('invitations and recovery links carry capabilities only in the fragment and parse bounded input', () => {
  const capability = {token, email: 'person+team@example.test', expiresAt: 1_900_000_000_000};
  for (const kind of ['register', 'recover'] as const) {
    const link = new URL(accountCapabilityLink(kind, capability, 'https://folio.example.test/some/path?ignored=yes'));
    assert.equal(link.origin, 'https://folio.example.test'); assert.equal(link.pathname, '/'); assert.equal(link.search, '');
    assert.deepEqual(parseAuthRoute(link.hash), {kind, email: capability.email, token, invalidLink: false});
  }
  assert.equal(parseAuthRoute('#images'), null);
  assert.equal(isAuthRoute('#settings/profile'), false);
  assert.equal(parseAuthRoute('#register?token=wrong')?.invalidLink, true);
  assert.equal(parseAuthRoute('#recover?token=' + token + '&token=' + token)?.invalidLink, true);
  assert.equal(parseAuthRoute('#register?email=bad%0Aemail')?.invalidLink, true);
  assert.equal(parseAuthRoute('#recover?token=' + 'a'.repeat(4096))?.invalidLink, true);
  assert.throws(() => accountCapabilityLink('register', capability, 'javascript:alert(1)'));
});

test('account field validation matches server password and name bounds without trimming passwords', () => {
  assert.equal(accountNameError('Renée'), '');
  assert.notEqual(accountNameError('  '), '');
  assert.notEqual(accountNameError('name\u0000'), '');
  assert.notEqual(accountNameError('a'.repeat(81)), '');
  assert.equal(accountPasswordError(' '.repeat(12)), '');
  assert.notEqual(accountPasswordError('short'), '');
  assert.notEqual(accountPasswordError('a'.repeat(129)), '');
  assert.equal(accountPasswordError('synthetic-password'), '');
});
