import type {FolioCapability} from './contracts';

export interface AuthRoute {
  kind: 'login' | 'register' | 'recover';
  email: string;
  token: string;
  invalidLink: boolean;
}

export function parseAuthRoute(hash: string): AuthRoute | null {
  const prefix = hash.match(/^#(login|register|recover)(?:\?|$)/u);
  if (hash.length > 2048) return prefix ? {kind: prefix[1] as AuthRoute['kind'], email: '', token: '', invalidLink: true} : null;
  const match = hash.match(/^#(login|register|recover)(?:\?(.*))?$/u);
  if (!match) return null;
  const kind = match[1] as AuthRoute['kind'];
  const params = new URLSearchParams(match[2] ?? '');
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const validEmail = !email || (email.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(email) && !/[\u0000-\u001f\u007f-\u009f]/u.test(email));
  const validToken = !token || /^[a-f0-9]{64}$/u.test(token);
  return {kind, email: validEmail ? email : '', token: validToken ? token : '', invalidLink: !validEmail || !validToken || params.getAll('token').length > 1 || params.getAll('email').length > 1};
}

export function isAuthRoute(hash: string): boolean {return parseAuthRoute(hash) !== null;}

export function accountCapabilityLink(kind: 'register' | 'recover', capability: FolioCapability, origin: string): string {
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('The workspace address is unavailable.');
  url.pathname = '/'; url.search = '';
  url.hash = kind + '?' + new URLSearchParams({token: capability.token, email: capability.email}).toString();
  return url.href;
}

/** Remove a consumed capability; the replacement history entry has no token. */
export function clearConsumedAuthRoute(next: 'login' | 'html') {
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + '#' + next);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
