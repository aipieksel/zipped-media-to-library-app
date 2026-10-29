import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPngFixtures } from '../tests/png-fixture-generator.ts';

// Run with Node's existing tsx loader so both test runners share the same fixtures.
// Everything produced here stays in the ignored .qa directory, outside the app build.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, '.qa');
await mkdir(join(output, 'png'), { recursive: true });

const fixtures = createPngFixtures();
for (const fixture of fixtures) await writeFile(join(output, 'png', fixture.name), fixture.bytes);

function html(view) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Folio · local PNG to SVG development checks</title>
  <style>
    :root { font: 15px/1.5 system-ui, sans-serif; color: #202522; background: #f3f4f0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { max-width: 1450px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 24px 0 8px; font-size: 19px; }
    p { margin: 8px 0 16px; max-width: 980px; }
    a { color: #175f46; }
    nav, .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 16px 0; }
    button { font: inherit; border: 1px solid #bdc6bd; background: white; color: #182d22; border-radius: 7px; padding: 9px 13px; cursor: pointer; }
    button:disabled { cursor: default; opacity: .55; }
    button:focus-visible, a:focus-visible { outline: 3px solid #398d6d; outline-offset: 3px; }
    #run-checks { background: #245d45; color: white; }
    #summary, #ui-status { padding: 12px 16px; background: #fff; border: 1px solid #d8dfd6; border-radius: 7px; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid #e0e5df; }
    th { font-size: 13px; }
    td:nth-child(2) { white-space: nowrap; }
    tr[data-status="pass"] td:nth-child(2) { color: #176438; }
    tr[data-status="fail"] { background: #fff0ec; }
    tr[data-status="fail"] td:nth-child(2) { color: #a12620; font-weight: 700; }
    .details { white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, monospace; max-width: 700px; }
    pre { background: #fff; border: 1px solid #d8dfd6; border-radius: 7px; padding: 16px; overflow: auto; max-height: 560px; font-size: 12px; }
    .frame-wrap { max-width: 100%; overflow: auto; padding: 8px; background: #dfe5dc; border: 1px solid #c4cdc1; border-radius: 8px; }
    iframe { display: block; border: 0; background: #fff; width: 390px; height: 844px; }
    .table-wrap { overflow: auto; }
    @media(max-width: 600px) { body { padding: 14px; } h1 { font-size: 22px; } th,td { padding: 8px; } }
  </style>
</head>
<body data-check-view="${view}">
  <main id="qa-root"></main>
  <script type="module" src="/tests/png-svg-browser-check.ts"></script>
</body>
</html>
`;
}

await writeFile(join(output, 'png-svg-check.html'), html('checks'));
await writeFile(join(output, 'png-svg-responsive.html'), html('responsive'));
await writeFile(join(output, 'webp-check.html'), html('webp').replace('/tests/png-svg-browser-check.ts', '/tests/webp-browser-check.ts'));
console.log(`Prepared ${fixtures.length} synthetic PNG fixtures in .qa/png/ (ignored).`);
console.log('Start the app with npm run dev, then open these paths on its local origin:');
console.log('  /.qa/png-svg-check.html');
console.log('  /.qa/png-svg-responsive.html');
console.log('  /.qa/webp-check.html (first run python3 scripts/prepare-webp-fixtures.py)');
console.log('Use Run browser checks to execute the native renderer assertions and download their JSON report.');
