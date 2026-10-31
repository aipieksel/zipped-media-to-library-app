/// <reference types="vite/client" />
import React from 'react';
import {createRoot} from 'react-dom/client';
import {FolioRoot} from '../src/FolioRoot';
import {installAiUiFixture} from './ai-ui-fixture';
import '../src/styles.css';

if (!import.meta.env.DEV || !window.location.pathname.startsWith('/.qa/')) throw new Error('This test entry is development-only.');

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const request = new Request(input instanceof Request ? input : new URL(String(input), location.href), init);
  const url = new URL(request.url);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    url.pathname = '/__qa__' + url.pathname;
    // Keep the already bounded byte body as bytes. Passing Request.body through
    // a new Request turns it into a streaming upload, which needs HTTP/2 and is
    // unsupported by the managed HTTP/1 development preview.
    const body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();
    const response=await originalFetch(url,{method:request.method,headers:request.headers,body,credentials:request.credentials,cache:request.cache,signal:request.signal,redirect:request.redirect,mode:request.mode});
    if(!response.ok){
      const output=document.getElementById('qa-network')??document.body.appendChild(Object.assign(document.createElement('output'),{id:'qa-network'}));
      output.textContent=`Synthetic QA response: ${request.method} ${url.pathname} → ${response.status}`;
    }
    return response;
  }
  return originalFetch(request);
};
installAiUiFixture(window, () => 'success', () => undefined);

async function start() {
  const response = await originalFetch('/__qa__/session', {method: 'POST', credentials: 'same-origin'});
  if (!response.ok) throw new Error('Isolated QA account initialization failed: ' + response.status);
  createRoot(document.getElementById('root')!).render(<React.StrictMode><FolioRoot/></React.StrictMode>);
}
start().catch(error => {
  document.getElementById('root')!.textContent = error instanceof Error ? error.message : 'QA initialization failed.';
});
