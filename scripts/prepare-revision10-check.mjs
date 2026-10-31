import {mkdir, writeFile} from 'node:fs/promises';
import {createPngFixtures} from '../tests/png-fixture-generator.ts';

await mkdir('.qa', {recursive: true});
await writeFile('.qa/revision10.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folio · isolated revision 10 QA</title></head><body><div id="root">Starting isolated synthetic workspace…</div><script type="module" src="/tests/revision10-browser-entry.tsx"></script></body></html>');
await mkdir('.qa/revision10-inputs', {recursive: true});
for (const fixture of createPngFixtures().slice(0, 3)) await writeFile('.qa/revision10-inputs/' + fixture.name, fixture.bytes);
console.log('Prepared development-only revision 10 QA entry and procedural PNG inputs.');
