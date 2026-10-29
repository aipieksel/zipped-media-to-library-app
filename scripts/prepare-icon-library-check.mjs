import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPngFixtures } from '../tests/png-fixture-generator.ts';

// Development-only pages and procedural files. Nothing generated here enters
// the production import graph, Git, or a remote collection.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, '.qa');
const inputs = join(output, 'icon-library-inputs');
await mkdir(inputs, { recursive: true });
const fixtures = createPngFixtures();
for (const fixture of fixtures) await writeFile(join(inputs, `qa-${fixture.name}`), fixture.bytes);
const nested = join(inputs, 'QA Icons', 'Nested', 'Deeper');
await mkdir(nested, { recursive: true });
await mkdir(join(inputs, 'QA Icons', 'Empty'), { recursive: true });
await writeFile(join(inputs, 'QA Icons', 'mark.png'), fixtures[0].bytes);
await writeFile(join(inputs, 'QA Icons', 'Nested', 'mark.png'), fixtures[1].bytes);
await writeFile(join(nested, 'curved.png'), fixtures.find(fixture => fixture.category === 'antialiased').bytes);
await writeFile(join(inputs, 'QA Icons', 'readme.txt'), 'Procedural QA non-PNG: an import notice is expected.\n');

function html(view) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Folio · icon collection development checks</title>
  <style>
    :root { font: 15px/1.5 system-ui, sans-serif; color: #202522; background: #f3f4f0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { max-width: 1450px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 24px 0 8px; font-size: 19px; }
    p { margin: 8px 0 16px; max-width: 1000px; }
    a { color: #175f46; }
    nav, .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 16px 0; }
    button, select { font: inherit; border: 1px solid #aab6aa; background: white; color: #182d22; border-radius: 7px; padding: 8px 12px; }
    button { cursor: pointer; }
    button:disabled { cursor: default; opacity: .55; }
    button:focus-visible, a:focus-visible, select:focus-visible { outline: 3px solid #398d6d; outline-offset: 3px; }
    #run-storage { background: #245d45; color: white; }
    .status { padding: 12px 16px; background: #fff; border: 1px solid #c5cfc3; border-radius: 7px; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid #d8dfd6; }
    th { font-size: 13px; }
    td:nth-child(2) { white-space: nowrap; }
    tr[data-status="pass"] td:nth-child(2) { color: #176438; }
    tr[data-status="fail"] { background: #fff0ec; }
    tr[data-status="fail"] td:nth-child(2) { color: #a12620; font-weight: 700; }
    .details { white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, monospace; max-width: 780px; }
    pre { background: #fff; border: 1px solid #c5cfc3; border-radius: 7px; padding: 16px; overflow: auto; max-height: 560px; font-size: 12px; }
    .frame-wrap { max-width: 100%; overflow: auto; padding: 8px; background: #dfe5dc; border: 1px solid #b7c3b3; border-radius: 8px; }
    iframe { display: block; border: 0; background: #fff; width: 1360px; height: 844px; }
    .table-wrap { overflow: auto; }
    .boundary { color: #655326; }
    @media (max-width: 600px) { body { padding: 14px; } h1 { font-size: 22px; } th, td { padding: 8px; } }
  </style>
</head>
<body data-check-view="${view}">
  <main id="qa-root"></main>
  <script type="module" src="/tests/icon-collection-browser-check.ts"></script>
</body>
</html>
`;
}

await writeFile(join(output, 'icon-collection-check.html'), html('storage'));
await writeFile(join(output, 'icon-library-check.html'), html('interactive'));
console.log('Prepared ignored .qa/icon-collection-check.html and .qa/icon-library-check.html.');
console.log('Run with the existing tsx loader; open these pages on a dedicated development origin.');
console.log('Storage checks use unique QA databases. Interactive checks append procedural files to that development origin only.');
console.log('Synthetic directory-entry events test the app drop API; file-only folder choosers cannot report empty folders.');
