import {handleCollection} from './cloud.mjs';
import {handleFolioAuth, requireMembership} from './auth.mjs';
import {handleWorkspace} from './workspace.mjs';

/** All private metadata and media pass through the same active membership gate. */
export async function handlePrivateApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/account') {
    url.pathname = '/api/folio-auth/session';
    return handleFolioAuth(new Request(url, request), env);
  }
  const auth = await handleFolioAuth(request, env);
  if (auth) return auth;
  const workspace = await handleWorkspace(request, env);
  if (workspace) return workspace;
  if (url.pathname.startsWith('/api/collection')) {
    // Administrative ingest retains its separate exact-origin/token checks.
    // It is never authenticated by an ordinary browser member session.
    if (!url.pathname.startsWith('/api/collection/admin/')) {
      const member = await requireMembership(request, env);
      if (member instanceof Response) return member;
    }
    const response = await handleCollection(request, env);
    if (response) {
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'private, no-store');
      headers.set('pragma', 'no-cache');
      return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
    }
  }
  return null;
}
