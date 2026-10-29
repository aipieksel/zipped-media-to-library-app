/// <reference types="vite/client" />

/** Procedural development-only QA; this module is outside the production entry graph. */
import { convertPng, convertRaster, decodeRasterPixels, verifySvgPixels } from '../src/png-svg-browser';
import type { PngSvgResult } from '../src/png-svg-browser';
import { inspectRaster } from '../src/raster-input';
import { PngSvgError } from '../src/png-svg';

if (!import.meta.env.DEV) throw new Error('The WebP browser harness is available only in the development server.');

interface FixtureEntry {
  name: string;
  kind: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  lossless: boolean | null;
  alpha: boolean;
}
interface FixtureManifest { pillow: string; libwebp: string; files: FixtureEntry[] }
interface CheckResult { name: string; status: 'pass' | 'fail'; durationMs: number; details: unknown }
interface BrowserReport {
  scope: string;
  startedAt: string;
  completedAt?: string;
  browser: string;
  devicePixelRatio: number;
  encoder?: { pillow: string; libwebp: string };
  passed: number;
  failed: number;
  checks: CheckResult[];
}

const root = document.querySelector<HTMLElement>('#qa-root');
if (!root) throw new Error('The WebP QA page is missing #qa-root.');
root.innerHTML = `
  <h1>Folio · WebP conversion checks</h1>
  <p>Procedural lossy, lossless and alpha WebPs exercise the actual local converter and browser renderer.
  Pixel and embedded modes pass only with zero visible differences at native dimensions.
  Lossy references are the decoded files, not their pixels before compression.</p>
  <p>These results cover this browser’s native RGBA8 sRGB rendering. They do not establish equivalence in other browsers or color profiles.</p>
  <p><button id="run-webp-checks" type="button">Run WebP checks</button>
  <button id="download-webp-report" type="button" disabled>Download JSON report</button></p>
  <p id="webp-summary" role="status" aria-live="polite">Ready. Generate inputs with python scripts/prepare-webp-fixtures.py first.</p>
  <table><thead><tr><th>Check</th><th>Result</th><th>Time</th></tr></thead><tbody id="webp-check-results"></tbody></table>
  <h2>Complete report</h2><pre id="webp-json-report">No checks have run.</pre>`;

const runButton = root.querySelector<HTMLButtonElement>('#run-webp-checks')!;
const downloadButton = root.querySelector<HTMLButtonElement>('#download-webp-report')!;
const summary = root.querySelector<HTMLElement>('#webp-summary')!;
const tableBody = root.querySelector<HTMLTableSectionElement>('#webp-check-results')!;
const jsonReport = root.querySelector<HTMLElement>('#webp-json-report')!;
// QA fixtures are served from the local origin, not Vite's imported-asset graph.
const fixtureBase = new URL('/.qa/webp/', window.location.origin);
let lastReport: BrowserReport | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

/** Independent strict recount, including alpha and ignoring only wholly hidden RGB. */
function visibleDifferenceCount(first: Uint8ClampedArray, second: Uint8ClampedArray): number {
  assert(first.length === second.length && first.length % 4 === 0, 'Native comparison buffers differ in size.');
  let count = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    if (first[offset + 3] !== second[offset + 3] ||
      (first[offset + 3] > 0 && (first[offset] !== second[offset] || first[offset + 1] !== second[offset + 1] || first[offset + 2] !== second[offset + 2]))) count++;
  }
  return count;
}

/** Render the actual serialized SVG independently from the production verifier. */
async function renderNativeSvg(svg: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  const image = new Image();
  const canvas = document.createElement('canvas');
  let timeout: number | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = window.setTimeout(() => reject(new Error('Independent SVG readback exceeded 20 seconds.')), 20_000);
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Independent SVG readback could not decode the serialized output.'));
      image.src = url;
    });
    assert(image.naturalWidth === width && image.naturalHeight === height, 'The serialized SVG changed native dimensions.');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', {alpha: true, colorSpace: 'srgb', willReadFrequently: true});
    assert(context, 'Independent native readback could not allocate a canvas.');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height, {colorSpace: 'srgb'}).data;
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
    image.onload = null; image.onerror = null; image.removeAttribute('src');
    URL.revokeObjectURL(url);
    canvas.width = 0; canvas.height = 0;
  }
}

async function recount(file: File, result: PngSvgResult, requireZero: boolean): Promise<unknown> {
  const source = await decodeRasterPixels(file);
  assert(result.width === source.metadata.width && result.height === source.metadata.height, 'Conversion changed source dimensions.');
  const rendered = await renderNativeSvg(result.svg, result.width, result.height);
  const differences = visibleDifferenceCount(source.pixels, rendered);
  assert(result.fidelity.status !== 'unavailable', `Verification was unavailable: ${result.fidelity.reason}`);
  assert(result.fidelity.differingPixels === differences, 'Reported fidelity disagrees with independent native readback.');
  assert(result.fidelity.status === (differences === 0 ? 'verified' : 'different'), 'The zero-only verification badge is inconsistent.');
  assert(result.fidelity.totalPixels === result.width * result.height, 'Fidelity uses the wrong native pixel count.');
  if (requireZero) assert(differences === 0, `Expected zero native visible differences; observed ${differences}.`);
  assert(result.sourceBytes === file.size, 'Reported input size does not match the original bytes.');
  assert(result.outputBytes === new Blob([result.svg], {type: 'image/svg+xml'}).size, 'Reported SVG size does not match download bytes.');
  assert(result.sourceFormat === source.metadata.format, 'Saved source format disagrees with byte detection.');
  assert(result.verification.browser === navigator.userAgent && Number.isFinite(Date.parse(result.verification.checkedAt)), 'Verification lacks actual browser/time provenance.');
  return {
    width: result.width, height: result.height, sourceFormat: result.sourceFormat,
    sourceBytes: result.sourceBytes, outputBytes: result.outputBytes,
    engine: result.engine, rectangleCount: result.rectangleCount, pathCount: result.pathCount,
    fidelity: result.fidelity, independentDifferingPixels: differences,
    verification: result.verification, warnings: result.warnings,
  };
}

async function withImageCount<T>(operation: () => Promise<T>): Promise<{ value: T; imageStarts: number }> {
  const OriginalImage = window.Image;
  let imageStarts = 0;
  window.Image = new Proxy(OriginalImage, {
    construct(target, argumentsList, newTarget) {
      imageStarts++;
      return Reflect.construct(target, argumentsList, newTarget);
    },
  });
  try { return {value: await operation(), imageStarts}; }
  finally { window.Image = OriginalImage; }
}

async function capturedError(operation: () => Promise<unknown>): Promise<Error> {
  let failure: unknown;
  try { await operation(); } catch (error) { failure = error; }
  assert(failure instanceof Error, 'The invalid or cancelled conversion unexpectedly succeeded.');
  return failure;
}

function renderReport(report: BrowserReport): void {
  jsonReport.textContent = JSON.stringify(report, null, 2);
  summary.textContent = `${report.passed} passed · ${report.failed} failed${report.completedAt ? ' · complete' : ' · running'}`;
  downloadButton.disabled = report.checks.length === 0;
}

downloadButton.addEventListener('click', () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'folio-webp-browser-report.json';
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  downloadButton.disabled = true;
  tableBody.replaceChildren();
  const report: BrowserReport = {
    scope: 'Actual local WebP conversion with independently recounted native SVG pixels; procedural fixtures only.',
    startedAt: new Date().toISOString(), browser: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio, passed: 0, failed: 0, checks: [],
  };
  lastReport = report;
  const check = async (name: string, operation: () => Promise<unknown>): Promise<void> => {
    summary.textContent = `Running: ${name}`;
    const started = performance.now();
    let result: CheckResult;
    try { result = {name, status: 'pass', durationMs: performance.now() - started, details: await operation()}; }
    catch (error) { result = {name, status: 'fail', durationMs: performance.now() - started,
      details: error instanceof Error ? {name: error.name, message: error.message, stack: error.stack} : String(error)}; }
    result.durationMs = performance.now() - started;
    report.checks.push(result);
    if (result.status === 'pass') report.passed++; else report.failed++;
    const row = document.createElement('tr');
    for (const value of [result.name, result.status, `${Math.round(result.durationMs)} ms`]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    tableBody.append(row);
    renderReport(report);
  };

  try {
    const manifestResponse = await fetch(new URL('manifest.json', fixtureBase), {cache: 'no-store'});
    assert(manifestResponse.ok, 'Generate the procedural inputs with python scripts/prepare-webp-fixtures.py.');
    assert(manifestResponse.headers.get('content-type')?.includes('application/json'), `Expected a procedural fixture manifest at ${manifestResponse.url}; received ${manifestResponse.headers.get('content-type')}.`);
    const manifest = await manifestResponse.json() as FixtureManifest;
    assert(Array.isArray(manifest.files), 'The procedural fixture manifest is invalid.');
    report.encoder = {pillow: manifest.pillow, libwebp: manifest.libwebp};
    const fileCache = new Map<string, File>();
    const fixtureFile = async (name: string): Promise<File> => {
      const cached = fileCache.get(name);
      if (cached) return cached;
      const entry = manifest.files.find(file => file.name === name);
      assert(entry, `The manifest is missing ${name}.`);
      const response = await fetch(new URL(name, fixtureBase), {cache: 'no-store'});
      assert(response.ok, `The procedural input ${name} could not be loaded.`);
      const bytes = await response.arrayBuffer();
      assert(bytes.byteLength === entry.bytes, `The procedural input ${name} does not match its recorded byte length.`);
      const file = new File([bytes], name, {type: name.endsWith('.png') ? 'image/png' : 'image/webp'});
      fileCache.set(name, file);
      return file;
    };
    const staticFiles = ['opaque-lossless.webp', 'opaque-lossy.webp', 'alpha-lossless.webp', 'alpha-lossy.webp', 'monochrome-96.webp'];
    for (const name of staticFiles) {
      await check(`${name} · pixel vectors · zero native differences`, async () => {
        const file = await fixtureFile(name);
        const result = await convertRaster(file, {mode: 'pixels'});
        assert(result.engine.id === 'pixel-rectangles' && !result.svg.includes('<image'), 'Pixel mode did not return editable pixel geometry.');
        const lossy = name.includes('-lossy');
        assert(result.warnings.some(warning => /decoded lossy WebP/.test(warning)) === lossy, 'The decoded-lossy-reference warning is inaccurate.');
        return recount(file, result, true);
      });
      await check(`${name} · original-byte embedded bitmap · zero native differences`, async () => {
        const file = await fixtureFile(name);
        const result = await convertRaster(file, {mode: 'embedded'});
        assert(result.engine.id === 'original-webp', 'Embedded WebP reports the wrong engine.');
        const document = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        const images = document.querySelectorAll('image');
        assert(images.length === 1 && document.querySelectorAll('path,rect').length === 0, 'Embedded mode must remain one bitmap inside an SVG.');
        const encoded = /^data:image\/webp;base64,(.+)$/.exec(images[0].getAttribute('href') ?? '')?.[1];
        assert(encoded, 'Embedded output lacks the original WebP MIME.');
        const embedded = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
        assert(sameBytes(embedded, new Uint8Array(await file.arrayBuffer())), 'Embedded WebP bytes were modified or re-encoded.');
        return {originalBytesPreserved: true, mime: 'image/webp', result: await recount(file, result, true)};
      });
    }

    await check('WebP renamed to .png with wrong MIME still uses byte detection', async () => {
      const source = await fixtureFile('alpha-lossy.webp');
      const renamed = new File([await source.arrayBuffer()], 'renamed.png', {type: 'image/png'});
      const result = await convertRaster(renamed, {mode: 'pixels'});
      assert(result.sourceFormat === 'webp', 'The converter trusted the incorrect name or MIME.');
      return recount(renamed, result, true);
    });

    await check('PNG renamed to .webp retains generic and strict PNG compatibility', async () => {
      const source = await fixtureFile('monochrome-96.png');
      const renamed = new File([await source.arrayBuffer()], 'renamed.webp', {type: 'image/webp'});
      const result = await convertRaster(renamed, {mode: 'pixels'});
      assert(result.sourceFormat === 'png', 'The generic decoder misidentified PNG bytes.');
      const strict = await convertPng(renamed, {mode: 'pixels'});
      assert(strict.svg === result.svg, 'PNG compatibility changed the generated geometry.');
      return recount(renamed, result, true);
    });

    await check('Strict convertPng compatibility entry rejects actual WebP bytes', async () => {
      const file = await fixtureFile('opaque-lossless.webp');
      const error = await capturedError(() => convertPng(file, {mode: 'pixels'}));
      assert(error instanceof PngSvgError && error.code === 'invalid-png', 'The strict PNG API silently widened its input contract.');
      return {code: error.code, message: error.message};
    });

    await check('Equivalent procedural lossless WebP and PNG decode to identical native pixels', async () => {
      const webp = await decodeRasterPixels(await fixtureFile('monochrome-96.webp'));
      const png = await decodeRasterPixels(await fixtureFile('monochrome-96.png'));
      assert(webp.metadata.width === png.metadata.width && webp.metadata.height === png.metadata.height, 'Control dimensions differ.');
      const differences = visibleDifferenceCount(webp.pixels, png.pixels);
      assert(differences === 0, `Lossless procedural controls differ in ${differences} visible pixels.`);
      return {width: webp.metadata.width, height: webp.metadata.height, differingPixels: differences};
    });

    await check('Eligible 96px WebP uses native alpha contour profile 3', async () => {
      const file = await fixtureFile('monochrome-96.webp');
      const result = await convertRaster(file, {mode: 'smooth'});
      assert(result.engine.id === 'silhouette' && result.engine.name === 'Native alpha contours' &&
        result.engine.version === 'marching squares 1 / fit-curve 0.2.0 / silhouette profile 3', 'WebP did not use the actual shared native-alpha cubic engine.');
      assert((result.pathCount ?? 0) > 0 && /\bC\s/.test(result.svg) && !result.svg.includes('<image'), 'Smooth WebP output lacks editable cubic geometry.');
      assert(result.warnings.some(warning => /approximate/i.test(warning)), 'Smooth output lost its approximation disclosure.');
      return recount(file, result, false);
    });

    for (const [name, code] of [['animated.webp', 'animated-webp'], ['oversized.webp', 'image-limit'], ['invalid-riff.webp', 'invalid-webp']] as const) {
      await check(`${name} · rejected before browser image allocation`, async () => {
        const file = await fixtureFile(name);
        const observation = await withImageCount(() => capturedError(() => convertRaster(file, {mode: 'pixels'})));
        assert(observation.value instanceof PngSvgError && observation.value.code === code,
          `Expected ${code}; received ${observation.value.name}: ${observation.value.message}.`);
        assert(observation.imageStarts === 0, 'Invalid metadata reached the browser image decoder.');
        return {code, message: observation.value.message, imageStarts: observation.imageStarts};
      });
    }

    await check('Structurally valid missing entropy fails at the actual browser decoder', async () => {
      const file = await fixtureFile('invalid-entropy.webp');
      const metadata = inspectRaster(new Uint8Array(await file.arrayBuffer()));
      assert(metadata.width === 32 && metadata.height === 24, 'The intended entropy-negative fixture failed header inspection.');
      const observation = await withImageCount(() => capturedError(() => convertRaster(file, {mode: 'pixels'})));
      assert(observation.imageStarts === 1, 'The malformed entropy stream did not reach the browser decoder exactly once.');
      assert(/decode|render|damaged|unsupported/i.test(observation.value.message), 'Decoder failure lacks useful feedback.');
      return {metadata, imageStarts: observation.imageStarts, error: observation.value.message, producedResult: false};
    });

    await check('Pre-aborted WebP conversion cancels without allocating an image', async () => {
      const file = await fixtureFile('alpha-lossless.webp');
      const controller = new AbortController(); controller.abort();
      const observation = await withImageCount(() => capturedError(() => convertRaster(file, {mode: 'pixels', signal: controller.signal})));
      assert(observation.value instanceof DOMException && observation.value.name === 'AbortError', 'The cancellation was not reported as AbortError.');
      assert(observation.imageStarts === 0, 'Pre-aborted conversion reached the image decoder.');
      return {error: observation.value.name, imageStarts: observation.imageStarts};
    });

    await check('One deliberately changed WebP output pixel reports exactly one difference', async () => {
      const file = await fixtureFile('alpha-lossless.webp');
      const source = await decodeRasterPixels(file);
      assert(source.pixels[3] === 0, 'The negative control needs a transparent first source pixel.');
      const result = await convertRaster(file, {mode: 'pixels'});
      const changed = result.svg.replace('</svg>', '<rect x="0" y="0" width="1" height="1" fill="#ffffff"/></svg>');
      const fidelity = await verifySvgPixels(changed, source.pixels, source.metadata.width, source.metadata.height);
      const independentCount = visibleDifferenceCount(source.pixels, await renderNativeSvg(changed, result.width, result.height));
      assert(fidelity.status === 'different' && fidelity.differingPixels === 1 && independentCount === 1, 'The visible one-pixel change was not counted exactly.');
      return {fidelity, independentDifferingPixels: independentCount};
    });
  } catch (error) {
    await check('Harness setup', async () => { throw error; });
  } finally {
    report.completedAt = new Date().toISOString();
    renderReport(report);
    runButton.disabled = false;
  }
});
