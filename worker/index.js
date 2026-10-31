import {handlePrivateApi} from './dispatch.mjs';
import assets from '../.sites-runtime/frontend-assets.json';

export default {
  async fetch(request, env) {
    const api = await handlePrivateApi(request, env);
    if (api) return api;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const pathname = new URL(request.url).pathname;
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset) return new Response('Not found', { status: 404 });
    const bytes = Uint8Array.from(atob(asset.body), character => character.charCodeAt(0));
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'content-type': asset.mime, 'content-length': String(bytes.length), 'x-content-type-options': 'nosniff', 'cache-control': pathname.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'private, no-cache' } });
  },
};
