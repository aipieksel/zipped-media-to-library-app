/// <reference types="vite/client" />
if (!import.meta.env.DEV) throw new Error('The isolated persistence runner is development-only.');
const output = document.getElementById('shared-runner-report')!, frame = document.createElement('iframe');
if (!('credentialless' in frame)) output.textContent = 'This browser does not support an isolated credentialless storage partition. No fixture database was opened.';
else {
  frame.setAttribute('credentialless', ''); frame.title = 'Isolated native IndexedDB persistence checks'; frame.style.cssText = 'width:100%;min-height:650px;border:1px solid #d8d8d8';
  const existing = (await indexedDB.databases()).map(db => db.name).sort();
  window.addEventListener('message', async event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'folio-shared-native-checks') return;
    const current = (await indexedDB.databases()).map(db => db.name).sort();
    const report = {...event.data.report, isolatedPartition: event.data.credentialless === true, parentDatabaseNamesUnchanged: JSON.stringify(existing) === JSON.stringify(current)};
    output.textContent = JSON.stringify(report, null, 2); (window as unknown as {__folioSharedChecks: unknown}).__folioSharedChecks = report;
  });
  frame.src = '/tests/shared-client-browser.html'; document.getElementById('shared-frame-container')!.append(frame);
}
