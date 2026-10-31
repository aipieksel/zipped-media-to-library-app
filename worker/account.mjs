/**
 * Sites dispatch owns authentication and supplies these identity headers.
 * This handler must remain behind that boundary: it does not authenticate a
 * raw client header, service-access token, local preference or request body.
 */
const ID_HEADER = 'oai-authenticated-user-id';
const EMAIL_HEADER = 'oai-authenticated-user-email';
const NAME_HEADER = 'oai-authenticated-user-full-name';
const NAME_ENCODING_HEADER = 'oai-authenticated-user-full-name-encoding';
const SIGN_IN_PATH = '/signin-with-chatgpt?return_to=%2F';
const SIGN_OUT_PATH = '/signout-with-chatgpt?return_to=%2F';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

function boundedText(value, limit) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || CONTROL_CHARACTERS.test(value)) return null;
  return value.trim();
}

function platformProfile(headers) {
  const userId = boundedText(headers.get(ID_HEADER), 512);
  const email = boundedText(headers.get(EMAIL_HEADER), 320);
  if (!userId || /\s/u.test(userId) || !email || !/^[^\s<>@]+@[^\s<>@]+$/u.test(email)) return null;

  // Match the Sites helper: a name is decoded only with its explicit marker.
  // Missing/invalid names fall back to email; they never create an identity.
  let fullName = null;
  const encodedName = headers.get(NAME_HEADER);
  if (encodedName && encodedName.length <= 4096 && headers.get(NAME_ENCODING_HEADER) === 'percent-encoded-utf-8') {
    try { fullName = boundedText(decodeURIComponent(encodedName), 512); } catch { /* Invalid UTF-8/escapes: use email. */ }
  }
  return {userId, email, fullName, displayName: fullName ?? email};
}

function response(request, status, profile = null, error) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'pragma': 'no-cache',
    'expires': '0',
    'vary': [ID_HEADER, EMAIL_HEADER, NAME_HEADER, NAME_ENCODING_HEADER].join(', '),
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
  };
  if (status === 405) headers.allow = 'GET, HEAD';
  const value = {authenticated: profile !== null, profile, signInPath: SIGN_IN_PATH, signOutPath: SIGN_OUT_PATH, ...(error ? {error} : {})};
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(value), {status, headers});
}

/** Return null for routes owned by the existing Worker/platform dispatch. */
export function handleAccount(request) {
  if (new URL(request.url).pathname !== '/api/account') return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return response(request, 405, null, 'Use GET to view your account.');
  const profile = platformProfile(request.headers);
  return response(request, profile ? 200 : 401, profile);
}
