import {writeFile} from 'node:fs/promises';

// Generated HTML is already ignored by the repository's media/source-page policy.
// Run on the existing managed preview; this fixture never starts another server.
await writeFile(new URL('./revision10-ui-fixture.html', import.meta.url), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folio · isolated UI checks</title></head><body><div id="root"></div><script type="module" src="/tests/revision10-ui-fixture.tsx"></script></body></html>`);
console.log('Prepared /tests/revision10-ui-fixture.html on the existing development server.');
