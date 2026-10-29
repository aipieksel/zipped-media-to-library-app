/// <reference types="vite/client" />

/** Development-only browser checks, intentionally absent from the production entry graph. */
import JSZip from 'jszip';
import { convertPng, decodePngPixels, verifySvgPixels } from '../src/png-svg-browser';
import type { PngSvgFidelity, PngSvgResult } from '../src/png-svg-browser';
import { allocateSvgFilename, PNG_SVG_LIMITS, PngSvgError } from '../src/png-svg';
import { normalizeTracedSvg } from '../src/png-svg-trace';
import { buildSvgZip } from '../src/png-svg-download';
import {
  alphaTopology, concatenateBytes, createCurveReferenceFixture, createPngFixtures, encodeRgbaPng,
  meanAbsoluteAlphaError, pngChunk, pngHeader, PNG_SIGNATURE,
} from './png-fixture-generator';
import type { PngFixture } from './png-fixture-generator';

if (!import.meta.env.DEV) throw new Error('The PNG browser harness is available only in the development server.');

interface CheckResult {
  name: string;
  status: 'pass' | 'fail';
  durationMs: number;
  details: unknown;
}

interface BrowserReport {
  scope: string;
  startedAt: string;
  completedAt?: string;
  browser: string;
  devicePixelRatio: number;
  viewport: { width: number; height: number };
  passed: number;
  failed: number;
  checks: CheckResult[];
}

const fixtures = createPngFixtures();
const root = document.querySelector<HTMLElement>('#qa-root');
if (!root) throw new Error('The generated QA page is missing its root element.');
root.innerHTML = `
  <h1>Folio · local PNG to SVG development checks</h1>
  <p>These checks use procedural PNGs and the actual local converter, worker and browser renderer.
  A positive case passes only with zero visible RGBA differences at the original dimensions.
  Results describe this browser’s decoded 8-bit sRGB pixels; they do not establish accuracy in other browsers or color profiles.</p>
  <nav aria-label="Development checks">
    <a href="/.qa/png-svg-check.html">Native pixel checks</a>
    <a href="/.qa/png-svg-responsive.html">App layout and batch import</a>
    <a href="/#png-to-svg" target="_blank" rel="noopener">Open the converter</a>
  </nav>
  <div id="check-content"></div>`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pngFile(fixture: PngFixture, name = fixture.name): File {
  return new File([fixture.bytes], name, { type: 'image/png' });
}

function verified(fidelity: PngSvgFidelity): void {
  assert(fidelity.status === 'verified' && fidelity.differingPixels === 0,
    `Expected verified with zero differences; received ${JSON.stringify(fidelity)}.`);
}

function resultDetails(result: PngSvgResult): unknown {
  return {
    mode: result.mode, width: result.width, height: result.height,
    rectangleCount: result.rectangleCount, sourceBytes: result.sourceBytes,
    pathCount: result.pathCount, engine: result.engine, verification: result.verification,
    outputBytes: result.outputBytes, fidelity: result.fidelity, warnings: result.warnings,
  };
}

/** Enlarge the SVG viewport, retaining its original viewBox and actual geometry. */
async function rasterSvgAtSize(svg: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  parsed.documentElement.setAttribute('width', String(width));
  parsed.documentElement.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(parsed)], { type: 'image/svg+xml' }));
  const image = new Image();
  const canvas = document.createElement('canvas');
  let timer: number | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error('The enlarged SVG could not be rendered within 20 seconds.')), 20_000);
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The enlarged SVG failed to decode.'));
      image.src = url;
    });
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true });
    assert(context, 'A comparison canvas could not be created.');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
    image.onload = null; image.onerror = null; image.removeAttribute('src');
    URL.revokeObjectURL(url);
    canvas.width = 0; canvas.height = 0;
  }
}

/** Fail only the pinned local VTracer worker; the real fallback worker still runs. */
async function convertWithVTracerStartupFailure(file: File): Promise<{ result: PngSvgResult; failedStarts: number }> {
  const originalWorker = window.Worker;
  let failedStarts = 0;
  const interceptedWorker = new Proxy(originalWorker, {
    construct(target, argumentsList) {
      const workerUrl = new URL(String(argumentsList[0]), document.baseURI);
      if (workerUrl.origin === location.origin && workerUrl.pathname.endsWith('/vendor/vtracer/worker.js')) {
        failedStarts++;
        throw new Error('Deliberate development check: VTracer worker startup failed.');
      }
      return Reflect.construct(target, argumentsList);
    },
  });
  window.Worker = interceptedWorker;
  try {
    const result = await convertPng(file, { mode: 'smooth' });
    assert(failedStarts === 1, `Expected one deliberately failed VTracer startup; observed ${failedStarts}.`);
    assert(result.engine.name.startsWith('ImageTracer') && result.engine.version.startsWith('1.2.6'),
      `The actual fallback engine was not reported: ${JSON.stringify(result.engine)}.`);
    assert(result.warnings.some(warning => warning.startsWith('VTracer could not complete')),
      'The VTracer failure and fallback were not disclosed.');
    assert((result.pathCount ?? 0) > 0 && !result.svg.includes('<image'), 'The fallback did not produce editable geometry.');
    const source = await decodePngPixels(file);
    const comparison = await verifySvgPixels(result.svg, source.pixels, source.metadata.width, source.metadata.height);
    assert(comparison.status !== 'unavailable' && comparison.status === result.fidelity.status &&
      comparison.differingPixels === result.fidelity.differingPixels,
    'Fallback fidelity does not match a fresh rendering of its downloadable SVG.');
    return { result, failedStarts };
  } finally {
    window.Worker = originalWorker;
  }
}

async function rejectsWithCode(operation: () => Promise<unknown>, code: string): Promise<unknown> {
  let caught: unknown;
  try { await operation(); } catch (error) { caught = error; }
  assert(caught instanceof PngSvgError && caught.code === code,
    `Expected PngSvgError ${code}; received ${caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught)}.`);
  return { code: caught.code, message: caught.message };
}

async function rejectsAsAbort(operation: () => Promise<unknown>): Promise<unknown> {
  let caught: unknown;
  try { await operation(); } catch (error) { caught = error; }
  assert(caught instanceof DOMException && caught.name === 'AbortError',
    `Expected AbortError; received ${caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught)}.`);
  return { name: caught.name, message: caught.message };
}

function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setupPixelChecks(content: HTMLElement): void {
  content.innerHTML = `
    <div class="controls">
      <button id="run-checks" type="button">Run browser checks</button>
      <button id="download-report" type="button" disabled>Download JSON report</button>
    </div>
    <p id="summary" role="status" aria-live="polite">Ready. No checks have run in this browser yet.</p>
    <div class="table-wrap"><table aria-label="Browser check results">
      <thead><tr><th>Check</th><th>Result</th><th>Milliseconds</th><th>Evidence</th></tr></thead>
      <tbody id="results"></tbody>
    </table></div>
    <section id="curve-previews" aria-label="Synthetic contour comparison"></section>
    <details><summary>Full JSON report</summary><pre id="json-report">No report yet.</pre></details>`;
  const runButton = content.querySelector<HTMLButtonElement>('#run-checks')!;
  const downloadButton = content.querySelector<HTMLButtonElement>('#download-report')!;
  const summary = content.querySelector<HTMLElement>('#summary')!;
  const results = content.querySelector<HTMLTableSectionElement>('#results')!;
  const jsonReport = content.querySelector<HTMLElement>('#json-report')!;
  const curvePreviews = content.querySelector<HTMLElement>('#curve-previews')!;
  const previewUrls: string[] = [];
  const clearPreviews = () => { for (const url of previewUrls.splice(0)) URL.revokeObjectURL(url); curvePreviews.replaceChildren(); };
  window.addEventListener('pagehide', clearPreviews);
  let report: BrowserReport | undefined;
  const converted = new Map<PngFixture['category'], PngSvgResult>();

  const update = () => {
    if (!report) return;
    summary.textContent = `${report.passed} passed · ${report.failed} failed · ${report.checks.length} completed${report.completedAt ? ' · Finished' : ' · Running…'}`;
    jsonReport.textContent = JSON.stringify(report, null, 2);
  };
  const check = async (name: string, operation: () => Promise<unknown>) => {
    summary.textContent = `Running: ${name}`;
    const started = performance.now();
    let result: CheckResult;
    try {
      const details = await operation();
      result = { name, status: 'pass', durationMs: Math.round((performance.now() - started) * 10) / 10, details };
      report!.passed++;
    } catch (error) {
      result = {
        name, status: 'fail', durationMs: Math.round((performance.now() - started) * 10) / 10,
        details: { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) },
      };
      report!.failed++;
    }
    report!.checks.push(result);
    const row = document.createElement('tr');
    row.dataset.status = result.status;
    for (const value of [result.name, result.status.toUpperCase(), String(result.durationMs), JSON.stringify(result.details, null, 2)]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    row.lastElementChild!.classList.add('details');
    results.append(row);
    update();
  };

  downloadButton.addEventListener('click', () => {
    if (report) downloadJson(report, 'folio-png-svg-browser-report.json');
  });

  runButton.addEventListener('click', async () => {
    runButton.disabled = true;
    downloadButton.disabled = true;
    results.replaceChildren();
    clearPreviews();
    converted.clear();
    report = {
      scope: 'Actual serialized SVG rendered at native dimensions against decoded PNG RGBA in this browser; transparent pixels ignore hidden RGB only when both alpha values are zero.',
      startedAt: new Date().toISOString(), browser: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      passed: 0, failed: 0, checks: [],
    };
    update();
    try {
      for (const fixture of fixtures) {
        await check(`Pixel vectors: ${fixture.category} (${fixture.width} × ${fixture.height})`, async () => {
          const result = await convertPng(pngFile(fixture), { mode: 'pixels' });
          converted.set(fixture.category, result);
          assert(result.width === fixture.width && result.height === fixture.height, 'Native dimensions changed.');
          assert(result.mode === 'pixels' && result.rectangleCount !== null, 'Pixel geometry was not produced.');
          assert(!result.svg.includes('<image'), 'Pixel mode unexpectedly contains a bitmap image.');
          if (fixture.category === 'transparent') assert(result.rectangleCount === 0, 'Invisible pixels created geometry.');
          else assert(result.rectangleCount > 0 && result.svg.includes('<rect'), 'Visible pixels have no editable rectangles.');
          verified(result.fidelity);
          return resultDetails(result);
        });
      }

      const partial = fixtures.find(fixture => fixture.category === 'partial-alpha')!;
      await check('Embedded partial alpha: exact original PNG bytes and zero rendered differences', async () => {
        const result = await convertPng(pngFile(partial), { mode: 'embedded' });
        assert(result.mode === 'embedded' && result.rectangleCount === null, 'Embedded mode incorrectly advertises pixel geometry.');
        const document = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        const href = document.querySelector('image')?.getAttribute('href');
        assert(typeof href === 'string' && href.startsWith('data:image/png;base64,'), 'Embedded SVG is missing its original PNG data URL.');
        const binary = atob(href.slice('data:image/png;base64,'.length));
        assert(binary.length === partial.bytes.length, 'The original PNG byte count changed.');
        for (let i = 0; i < binary.length; i++) assert(binary.charCodeAt(i) === partial.bytes[i], `Original PNG byte ${i} changed.`);
        verified(result.fidelity);
        return { ...(resultDetails(result) as object), originalBytesIdentical: true };
      });

      await check('Negative fidelity control: exactly one visible pixel differs', async () => {
        const fixture = fixtures.find(item => item.category === 'opaque')!;
        const source = await decodePngPixels(pngFile(fixture));
        const result = converted.get('opaque') ?? await convertPng(pngFile(fixture), { mode: 'pixels' });
        // The top-left source pixel is opaque white. Draw opaque black after all existing shapes.
        const altered = result.svg.replace('</svg>', '<rect x="0" y="0" width="1" height="1" fill="#000000"/></svg>');
        assert(altered !== result.svg, 'The deliberate SVG alteration was not applied.');
        const fidelity = await verifySvgPixels(altered, source.pixels, fixture.width, fixture.height);
        assert(fidelity.status === 'different' && fidelity.differingPixels === 1,
          `The negative control must report exactly one differing pixel: ${JSON.stringify(fidelity)}.`);
        return fidelity;
      });

      await check('Hidden RGB under alpha zero does not create a visible mismatch', async () => {
        const fixture = fixtures.find(item => item.category === 'transparent')!;
        const source = await decodePngPixels(pngFile(fixture));
        const hiddenRgb = source.pixels.slice();
        for (let offset = 0; offset < hiddenRgb.length; offset += 4) {
          hiddenRgb[offset] = 213; hiddenRgb[offset + 1] = 71; hiddenRgb[offset + 2] = 149;
          assert(hiddenRgb[offset + 3] === 0, 'The transparent fixture contains a visible pixel.');
        }
        const svg = converted.get('transparent')?.svg ?? `<svg xmlns="http://www.w3.org/2000/svg" width="${fixture.width}" height="${fixture.height}"/>`;
        const fidelity = await verifySvgPixels(svg, hiddenRgb, fixture.width, fixture.height);
        verified(fidelity);
        return { hiddenRgbChangedAtPixels: fixture.width * fixture.height, fidelity };
      });

      await check('Malformed SVG reports verification unavailable', async () => {
        const fidelity = await verifySvgPixels('<svg xmlns="http://www.w3.org/2000/svg"><broken', new Uint8ClampedArray(4), 1, 1);
        assert(fidelity.status === 'unavailable' && fidelity.differingPixels === null && !!fidelity.reason,
          `An unrenderable SVG must not receive a match badge: ${JSON.stringify(fidelity)}.`);
        return fidelity;
      });

      await check('Invalid PNG bytes are rejected before decoding', () => rejectsWithCode(
        () => convertPng(new File(['not a PNG'], 'invalid.png', { type: 'image/png' }), { mode: 'pixels' }), 'invalid-png'));

      await check('Oversized PNG dimensions are rejected before allocation', async () => {
        const bytes = concatenateBytes([PNG_SIGNATURE, pngHeader(PNG_SVG_LIMITS.maxSide + 1, 1), pngChunk('IDAT'), pngChunk('IEND')]);
        return rejectsWithCode(() => convertPng(new File([bytes], 'oversized-dimensions.png', { type: 'image/png' }), { mode: 'pixels' }), 'image-limit');
      });

      await check('PNG exceeding the 20 MiB input limit is rejected before reading', async () => {
        const file = new File([new Uint8Array(PNG_SVG_LIMITS.maxInputBytes + 1)], 'oversized-file.png', { type: 'image/png' });
        return { fileBytes: file.size, rejection: await rejectsWithCode(() => convertPng(file, { mode: 'pixels' }), 'image-limit') };
      });

      await check('Animated PNG control chunk is rejected', async () => {
        const animation = new Uint8Array(8);
        new DataView(animation.buffer).setUint32(0, 1);
        const bytes = concatenateBytes([partial.bytes.subarray(0, 33), pngChunk('acTL', animation), partial.bytes.subarray(33)]);
        return rejectsWithCode(() => convertPng(new File([bytes], 'animated.png', { type: 'image/png' }), { mode: 'pixels' }), 'animated-png');
      });

      await check('Pre-aborted conversion stops before work or progress', async () => {
        const controller = new AbortController();
        controller.abort();
        let progressEvents = 0;
        const rejection = await rejectsAsAbort(() => convertPng(pngFile(partial), {
          mode: 'pixels', signal: controller.signal, onProgress: () => { progressEvents++; },
        }));
        assert(progressEvents === 0, 'An already-cancelled conversion emitted progress.');
        return { rejection, progressEvents };
      });

      await check('Cancellation after a real worker progress event rejects as AbortError', async () => {
        const controller = new AbortController();
        let sawWorkerProgress = false;
        const rejection = await rejectsAsAbort(() => convertPng(pngFile(fixtures.find(item => item.category === 'alpha-sweep')!), {
          mode: 'pixels', signal: controller.signal,
          onProgress: progress => {
            if (progress.stage === 'converting' && progress.percent !== undefined) {
              sawWorkerProgress = true;
              controller.abort();
            }
          },
        }));
        assert(sawWorkerProgress, 'Cancellation did not reach the worker progress boundary.');
        return { rejection, sawWorkerProgress };
      });

      await check('Complex image hits the shape limit and succeeds through explicit embedded fallback', async () => {
        const width = 400;
        const height = 400;
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) rgba.set([i & 255, (i >>> 8) & 255, (i >>> 16) & 255, 255], i * 4);
        const file = new File([encodeRgbaPng(rgba, width, height)], 'complex-pixels.png', { type: 'image/png' });
        const rejection = await rejectsWithCode(() => convertPng(file, { mode: 'pixels' }), 'vector-limit');
        const embedded = await convertPng(file, { mode: 'embedded' });
        verified(embedded.fidelity);
        return { rejection, embedded: resultDetails(embedded) };
      });

      await check('Collision-safe names and ZIP contents round-trip without overwriting', async () => {
        const source = converted.get('opaque') ?? await convertPng(pngFile(fixtures[0]), { mode: 'pixels' });
        const used = new Set<string>();
        const names = ['icon.png', 'ICON.PNG', 'icon (2).png'].map(name => allocateSvgFilename(name, used));
        assert(new Set(names.map(name => name.normalize('NFC').toLowerCase())).size === 3, 'Case-insensitive filename collision.');
        const entries = names.map(filename => ({ filename, svg: source.svg }));
        const blob = await buildSvgZip(entries);
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        assert(Object.keys(zip.files).length === entries.length, 'ZIP entry count changed.');
        for (const entry of entries) {
          assert(await zip.file(entry.filename)?.async('string') === entry.svg, `ZIP entry ${entry.filename} changed or disappeared.`);
        }
        return { names, zipBytes: blob.size, entriesPreserved: true };
      });

      await check('Smooth silhouette: improve independent 4× contour reference while preserving hole, island and thin stroke', async () => {
        const fixture = createCurveReferenceFixture();
        const file = new File([fixture.bytes], fixture.name, { type: 'image/png' });
        const pixelResult = await convertPng(file, { mode: 'pixels' });
        verified(pixelResult.fidelity);
        const smoothResult = await convertPng(file, { mode: 'smooth' });
        assert(smoothResult.engine.id === 'silhouette', `Expected the conservative silhouette route; got ${JSON.stringify(smoothResult.engine)}.`);
        assert((smoothResult.pathCount ?? 0) > 0 && !smoothResult.svg.includes('<image'), 'Smooth output must contain editable geometry.');
        const size = 96 * fixture.referenceScale;
        const pixelRender = await rasterSvgAtSize(pixelResult.svg, size, size);
        const smoothRender = await rasterSvgAtSize(smoothResult.svg, size, size);
        const pixelError = meanAbsoluteAlphaError(pixelRender, fixture.reference);
        const smoothError = meanAbsoluteAlphaError(smoothRender, fixture.reference);
        const expectedTopology = alphaTopology(fixture.reference, size, size);
        const actualTopology = alphaTopology(smoothRender, size, size);
        const evidence = {
          metric: 'Mean absolute alpha-channel error at 4×, in 0–255 alpha units; independent analytic shape sampling',
          pixelError, smoothError, improvementPercent: (pixelError - smoothError) / pixelError * 100,
          expectedTopology, actualTopology, result: resultDetails(smoothResult),
        };

        const title = document.createElement('h2'); title.textContent = 'Actual 400% geometry and independent target';
        const panels = document.createElement('div'); panels.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap';
        for (const [label, blob] of [
          ['Pixel SVG · actual geometry', new Blob([pixelResult.svg], { type: 'image/svg+xml' })],
          ['Smooth SVG · actual geometry', new Blob([smoothResult.svg], { type: 'image/svg+xml' })],
          ['Independent 4× analytic reference', new Blob([encodeRgbaPng(fixture.reference, size, size)], { type: 'image/png' })],
        ] as const) {
          const panel = document.createElement('figure'); panel.style.cssText = 'margin:0;max-width:100%';
          const caption = document.createElement('figcaption'); caption.textContent = label;
          const image = document.createElement('img'); image.alt = label;
          const url = URL.createObjectURL(blob); previewUrls.push(url); image.src = url;
          image.width = size; image.height = size; image.style.cssText = 'display:block;max-width:100%;height:auto;background:white;border:1px solid #ccd4c9';
          panel.append(caption, image); panels.append(panel);
        }
        curvePreviews.append(title, panels);
        assert(smoothError < pixelError, `Smooth contour must improve the independent oracle: ${JSON.stringify(evidence)}.`);
        assert(actualTopology.components === expectedTopology.components && actualTopology.holes === expectedTopology.holes,
          `Smooth contour lost topology/details: ${JSON.stringify(evidence)}.`);
        assert(smoothRender[(79 * 4 * size + 81 * 4) * 4 + 3] >= 128, 'The thin stroke endpoint was lost.');
        assert(smoothResult.verification.browser === navigator.userAgent && Number.isFinite(Date.parse(smoothResult.verification.checkedAt)), 'Verification provenance is missing.');
        assert(smoothResult.outputBytes === new Blob([smoothResult.svg]).size, 'SVG byte accounting differs from the saved payload.');
        return evidence;
      });

      await check('Opaque smooth route executes VTracer and keeps distinct color fills', async () => {
        const fixture = fixtures.find(item => item.category === 'opaque')!;
        const result = await convertPng(pngFile(fixture), { mode: 'smooth' });
        assert(result.engine.id === 'vtracer', `The retained VTracer engine must actually execute: ${JSON.stringify(resultDetails(result))}.`);
        const svg = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        const fills = new Set(Array.from(svg.querySelectorAll('[fill]')).map(node => node.getAttribute('fill')));
        assert(fills.size >= 3, `Distinct colors were flattened: ${[...fills].join(', ')}.`);
        assert((result.pathCount ?? 0) > 0 && !result.svg.includes('<image'), 'VTracer output is not editable geometry.');
        return { ...(resultDetails(result) as object), distinctFills: [...fills] };
      });

      await check('Forced VTracer startup failure: opaque ImageTracer fallback runs and reports actual native differences', async () => {
        const fixture = fixtures.find(item => item.category === 'opaque')!;
        const originalWorker = window.Worker;
        const { result, failedStarts } = await convertWithVTracerStartupFailure(pngFile(fixture));
        assert(window.Worker === originalWorker, 'The Worker constructor was not restored after the failure injection.');
        assert(result.engine.id === 'imagetracer', 'Opaque fallback reported the wrong route.');
        const svg = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        const fills = new Set(Array.from(svg.querySelectorAll('[fill]')).map(node => node.getAttribute('fill')));
        assert(fills.size >= 3, `Opaque fallback flattened distinct colors: ${[...fills].join(', ')}.`);
        return { failedStarts, workerRestored: true, distinctFills: [...fills], result: resultDetails(result) };
      });

      await check('Forced VTracer startup failure: silhouette fallback improves the independent 4× reference and preserves details', async () => {
        const fixture = createCurveReferenceFixture();
        const file = new File([fixture.bytes], fixture.name, { type: 'image/png' });
        const originalWorker = window.Worker;
        const { result, failedStarts } = await convertWithVTracerStartupFailure(file);
        assert(window.Worker === originalWorker, 'The Worker constructor was not restored after the failure injection.');
        assert(result.engine.id === 'silhouette', 'Silhouette fallback reported the wrong route.');
        const pixelResult = await convertPng(file, { mode: 'pixels' });
        verified(pixelResult.fidelity);
        const size = fixture.width * fixture.referenceScale;
        const smoothRender = await rasterSvgAtSize(result.svg, size, size);
        const pixelRender = await rasterSvgAtSize(pixelResult.svg, size, size);
        const smoothError = meanAbsoluteAlphaError(smoothRender, fixture.reference);
        const pixelError = meanAbsoluteAlphaError(pixelRender, fixture.reference);
        const expectedTopology = alphaTopology(fixture.reference, size, size);
        const actualTopology = alphaTopology(smoothRender, size, size);
        const evidence = { failedStarts, workerRestored: true, pixelError, smoothError, expectedTopology, actualTopology, result: resultDetails(result) };
        assert(smoothError < pixelError, `Fallback contour must improve the independent oracle: ${JSON.stringify(evidence)}.`);
        assert(actualTopology.components === expectedTopology.components && actualTopology.holes === expectedTopology.holes,
          `Fallback contour lost topology/details: ${JSON.stringify(evidence)}.`);
        assert(smoothRender[(79 * 4 * size + 81 * 4) * 4 + 3] >= 128, 'The fallback lost the thin stroke endpoint.');
        return evidence;
      });

      await check('RGBA smooth route keeps a partially transparent interior and transparent exterior', async () => {
        const pixels = new Uint8ClampedArray(16 * 16 * 4);
        for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) pixels.set([31, 117, 203, 127], (y * 16 + x) * 4);
        const file = new File([encodeRgbaPng(pixels, 16, 16)], 'synthetic-translucent.png', { type: 'image/png' });
        const result = await convertPng(file, { mode: 'smooth' });
        assert(result.engine.id === 'imagetracer', `A translucent field must not enter binary silhouette tracing: ${result.engine.id}.`);
        const rendered = await rasterSvgAtSize(result.svg, 16, 16);
        assert(rendered[(8 * 16 + 8) * 4 + 3] === 127, 'The translucent interior was flattened or thresholded.');
        assert(rendered[3] === 0, 'The transparent background was filled.');
        return resultDetails(result);
      });

      await check('Indexed transparency and soft alpha fields use measured RGBA smooth output', async () => {
        const results: unknown[] = [];
        for (const category of ['palette', 'partial-alpha'] as const) {
          const fixture = fixtures.find(item => item.category === category)!;
          const result = await convertPng(pngFile(fixture), { mode: 'smooth' });
          const source = await decodePngPixels(pngFile(fixture));
          const independent = await verifySvgPixels(result.svg, source.pixels, fixture.width, fixture.height);
          assert(result.engine.id === 'imagetracer', `${category} must use the alpha-aware route.`);
          assert(result.fidelity.status !== 'unavailable', 'The actual smooth SVG must render.');
          assert(result.fidelity.status === independent.status && result.fidelity.differingPixels === independent.differingPixels, 'Reported fidelity differs from a fresh check of the downloadable SVG.');
          results.push({ category, result: resultDetails(result) });
        }
        return results;
      });

      await check('Fully transparent smooth input has no visible paths and verifies zero', async () => {
        const fixture = fixtures.find(item => item.category === 'transparent')!;
        const result = await convertPng(pngFile(fixture), { mode: 'smooth' });
        verified(result.fidelity);
        assert(result.pathCount === 0 && !result.svg.includes('<image'), 'Invisible input created visible geometry or a bitmap.');
        return resultDetails(result);
      });

      await check('Smooth SVG allowlist rejects executable, external, bitmap and invalid geometry output', async () => {
        const prefix = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1">';
        const rejected = [
          '<script>alert(1)</script>', '<image href="data:image/png;base64,AA=="/>',
          '<path d="M0 0L1 1Z" onload="alert(1)"/>', '<path d="M0 0L1 1Z" fill="url(#paint)"/>',
          '<path d="M0 0L1e99 1Z"/>', '<foreignObject/>',
        ];
        for (const content of rejected) {
          let failed = false;
          try { normalizeTracedSvg(prefix + content + '</svg>', 1, 1); }
          catch (error) { failed = error instanceof PngSvgError; }
          assert(failed, `Unsafe tracer output was accepted: ${content}`);
        }
        return { rejectedCases: rejected.length };
      });

      await check('Smooth cancellation at a real RGBA worker progress event rejects as AbortError', async () => {
        const controller = new AbortController();
        let progressSeen = false;
        const rejection = await rejectsAsAbort(() => convertPng(pngFile(partial), {
          mode: 'smooth', signal: controller.signal,
          onProgress: progress => {
            if (progress.stage === 'converting' && progress.percent !== undefined) { progressSeen = true; controller.abort(); }
          },
        }));
        assert(progressSeen, 'Cancellation never reached the active tracing worker.');
        return { rejection, progressSeen };
      });
    } finally {
      report.completedAt = new Date().toISOString();
      update();
      runButton.disabled = false;
      downloadButton.disabled = false;
    }
  });
}

async function waitUntil<T>(read: () => T | undefined, timeoutMs = 30_000): Promise<T> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        const value = read();
        if (value !== undefined) { resolve(value); return; }
        if (performance.now() - start >= timeoutMs) { reject(new Error('Timed out waiting for the app to become ready.')); return; }
        window.setTimeout(poll, 50);
      } catch (error) { reject(error); }
    };
    poll();
  });
}

function setupResponsiveChecks(content: HTMLElement): void {
  content.innerHTML = `
    <p>The frame below runs the actual app. Its viewport starts at 390 × 844 CSS pixels.
    Drop controls create synthetic local files in memory and dispatch normal file drag events to the converter.
    Downloads and detailed visual review remain available inside the app.</p>
    <div class="controls">
      <button id="mobile-width" type="button">390px mobile viewport</button>
      <button id="desktop-width" type="button">1360px desktop viewport</button>
      <button id="drop-fixtures" type="button">Drop seven PNG fixtures</button>
      <button id="drop-duplicates" type="button">Drop duplicate filenames</button>
      <button id="drop-cancellation" type="button">Drop long cancellation batch</button>
      <button id="drop-invalid" type="button">Drop invalid PNG</button>
      <button id="drop-oversized" type="button">Drop oversized PNG header</button>
      <button id="check-layout" type="button">Inspect layout and conversion badges</button>
      <button id="observe-download" type="button">Arm next app download observation</button>
      <button id="download-ui-report" type="button" disabled>Download UI observations</button>
    </div>
    <p id="ui-status" role="status" aria-live="polite">Loading the real app at 390px…</p>
    <div class="frame-wrap"><iframe id="app-frame" title="Actual Folio app at selected viewport" src="/#png-to-svg" width="390" height="844"></iframe></div>
    <h2>Observed app state</h2><pre id="ui-report">No observations yet.</pre>`;
  const frame = content.querySelector<HTMLIFrameElement>('#app-frame')!;
  const status = content.querySelector<HTMLElement>('#ui-status')!;
  const reportElement = content.querySelector<HTMLElement>('#ui-report')!;
  const downloadButton = content.querySelector<HTMLButtonElement>('#download-ui-report')!;
  const observations: unknown[] = [];
  let busy = false;
  let restoreDownloadObservation: (() => void) | undefined;

  const observe = (value: unknown) => {
    observations.push({ observedAt: new Date().toISOString(), value });
    reportElement.textContent = JSON.stringify({ browser: navigator.userAgent, observations }, null, 2);
    downloadButton.disabled = false;
  };
  const appDocument = async () => waitUntil(() => {
    const document = frame.contentDocument;
    return document?.querySelector('.png-workspace') ? document : undefined;
  });
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    try { await operation(); } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      observe({ error: status.textContent });
    } finally { busy = false; }
  };
  const drop = async (files: File[]) => {
    const document = await appDocument();
    const converterButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-navigation button'))
      .find(button => button.textContent?.trim() === 'PNG to SVG');
    converterButton?.click();
    const target = document.querySelector<HTMLElement>('.png-workspace')!;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }
    status.textContent = `Dropped ${files.length} synthetic file${files.length === 1 ? '' : 's'} into the app. The converter owns progress and results.`;
    observe({ action: 'synthetic file drop', files: files.map(file => ({ name: file.name, bytes: file.size })) });
  };

  const setWidth = (width: number) => {
    frame.style.width = `${width}px`;
    frame.width = String(width);
    status.textContent = `App viewport set to ${width} × 844 CSS pixels.`;
    observe({ action: 'viewport', width, height: 844 });
  };
  content.querySelector('#mobile-width')!.addEventListener('click', () => setWidth(390));
  content.querySelector('#desktop-width')!.addEventListener('click', () => setWidth(1360));
  content.querySelector('#drop-fixtures')!.addEventListener('click', () => void run(() => drop(fixtures.map(fixture => pngFile(fixture)))));
  content.querySelector('#drop-duplicates')!.addEventListener('click', () => void run(() => drop(
    ['icon.png', 'ICON.PNG', 'icon (2).png'].map(name => pngFile(fixtures[0], name)),
  )));
  content.querySelector('#drop-cancellation')!.addEventListener('click', () => void run(() => {
    const fixture = fixtures.find(item => item.category === 'alpha-sweep')!;
    return drop(Array.from({ length: 30 }, (_, index) => pngFile(fixture, `cancel-${String(index + 1).padStart(2, '0')}.png`)));
  }));
  content.querySelector('#drop-invalid')!.addEventListener('click', () => void run(() => drop(
    [new File(['This is a deliberately invalid PNG.'], 'invalid.png', { type: 'image/png' })],
  )));
  content.querySelector('#drop-oversized')!.addEventListener('click', () => void run(() => {
    const bytes = concatenateBytes([PNG_SIGNATURE, pngHeader(PNG_SVG_LIMITS.maxSide + 1, 1), pngChunk('IDAT'), pngChunk('IEND')]);
    return drop([new File([bytes], 'oversized-4097x1.png', { type: 'image/png' })]);
  }));
  downloadButton.addEventListener('click', () => downloadJson({ browser: navigator.userAgent, observations }, 'folio-png-svg-ui-observations.json'));
  content.querySelector('#observe-download')!.addEventListener('click', () => void run(async () => {
    restoreDownloadObservation?.();
    const document = await appDocument();
    const selected = document.querySelector<HTMLButtonElement>('.png-file-select[aria-pressed="true"]');
    const expected = new Map<string, string>();
    const settleSelection = () => new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    const localBlob = async (url: string) => {
      assert(url.startsWith('blob:') && new URL(url).origin === window.location.origin,
        'Download observation can read only an app-created same-origin blob URL.');
      const response = await fetch(url);
      assert(response.ok, `The local blob could not be read (${response.status}).`);
      return response;
    };
    status.textContent = 'Recording ready preview payloads before observing the next app download…';
    try {
      for (const row of document.querySelectorAll<HTMLElement>('.png-file-row')) {
        const download = row.querySelector<HTMLButtonElement>('button[aria-label^="Download "]');
        if (!download) continue;
        const filename = download.getAttribute('aria-label')!.slice('Download '.length);
        row.querySelector<HTMLButtonElement>('.png-file-select')!.click();
        await settleSelection();
        const preview = document.querySelector<HTMLImageElement>('section[aria-label="SVG output preview"] img');
        assert(preview?.src, `No downloadable preview was found for ${filename}.`);
        expected.set(filename, await (await localBlob(preview.src)).text());
      }
    } finally {
      selected?.click();
      await settleSelection();
    }
    assert(expected.size > 0, 'Convert at least one file before arming a download observation.');

    // This one-shot, dev-only observer still invokes the actual app anchor click.
    // It records the exact local payload; it cannot prove the OS received a file.
    const prototype = Object.getPrototypeOf(document.createElement('a')) as HTMLAnchorElement;
    const originalClick = prototype.click;
    const restore = () => {
      if (prototype.click === observedClick) prototype.click = originalClick;
      window.clearTimeout(timeout);
      window.removeEventListener('pagehide', restore);
      restoreDownloadObservation = undefined;
    };
    const inspectDownload = async (url: string, filename: string) => {
      try {
        const response = await localBlob(url);
        const bytes = await response.arrayBuffer();
        if (filename.endsWith('.zip')) {
          assert(filename === 'folio-svg-icons.zip', `Unexpected ZIP filename ${filename}.`);
          const zip = await JSZip.loadAsync(bytes);
          const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
          assert(names.length === expected.size, `Expected ${expected.size} ZIP entries, received ${names.length}.`);
          for (const [name, svg] of expected) {
            assert(await zip.file(name)?.async('string') === svg, `ZIP entry ${name} does not match the app's generated preview payload.`);
          }
          observe({ action: 'app ZIP download observation', filename, bytes: bytes.byteLength, entries: names,
            generatedPayloadMatchesEveryPreview: true, originalAnchorClickInvoked: true, browserOrOsFileDelivery: 'not observed' });
        } else {
          assert(expected.has(filename), `Download filename ${filename} was not allocated to a ready result.`);
          assert(new TextDecoder().decode(bytes) === expected.get(filename), 'SVG download bytes do not match its generated preview payload.');
          observe({ action: 'app SVG download observation', filename, bytes: bytes.byteLength,
            generatedPayloadMatchesPreview: true, originalAnchorClickInvoked: true, browserOrOsFileDelivery: 'not observed' });
        }
        status.textContent = `Observed ${filename}: its actual generated payload and filename passed. Browser/OS file delivery remains unobserved. Observer restored.`;
      } catch (error) {
        status.textContent = `Download observation failed: ${error instanceof Error ? error.message : String(error)}`;
        observe({ action: 'app download observation', filename, error: status.textContent, browserOrOsFileDelivery: 'not observed' });
      }
    };
    function observedClick(this: HTMLAnchorElement): void {
      const url = this.href;
      const filename = this.download;
      restore();
      // Start reading the blob before the app's normal URL cleanup can revoke it.
      void inspectDownload(url, filename);
      originalClick.call(this);
    }
    const timeout = window.setTimeout(() => {
      restore();
      status.textContent = 'Download observation expired after 60 seconds and restored the original anchor behavior. Arm it again to retry.';
    }, 60_000);
    prototype.click = observedClick;
    restoreDownloadObservation = restore;
    window.addEventListener('pagehide', restore, { once: true });
    status.textContent = `Armed for one app download (${expected.size} ready files). Click Download SVG or Download ZIP inside the app within 60 seconds. The original click will still run.`;
  }));
  content.querySelector('#check-layout')!.addEventListener('click', () => void run(async () => {
    const document = await appDocument();
    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('.png-file-select'));
    const selected = rows.find(row => row.getAttribute('aria-pressed') === 'true');
    const badges: Array<{ name: string; text: string | null }> = [];
    for (const row of rows) {
      row.click();
      await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      badges.push({ name: row.querySelector('strong')?.textContent ?? row.title, text: document.querySelector('.png-result-top strong')?.textContent ?? null });
    }
    selected?.click();
    const html = document.documentElement;
    const viewportWidth = frame.contentWindow!.innerWidth;
    const visibleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(button => {
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(button).visibility !== 'hidden';
    });
    const outsideButtons = visibleButtons.filter(button => {
      const box = button.getBoundingClientRect();
      return box.left < -1 || box.right > viewportWidth + 1;
    }).map(button => button.getAttribute('aria-label') ?? button.textContent?.trim());
    const result = {
      action: 'layout and badge inspection', viewportWidth, viewportHeight: frame.contentWindow!.innerHeight,
      documentClientWidth: html.clientWidth, documentScrollWidth: html.scrollWidth,
      horizontalOverflow: html.scrollWidth > html.clientWidth,
      visibleButtonsOutsideHorizontalViewport: outsideButtons,
      rowCount: rows.length, badges,
      batchStatus: document.querySelector('.png-batch-toolbar')?.textContent?.trim(),
    };
    observe(result);
    status.textContent = `Observed ${rows.length} file rows at ${viewportWidth}px. Horizontal overflow: ${result.horizontalOverflow ? 'YES' : 'none'}; buttons outside width: ${outsideButtons.length}.`;
  }));
  void appDocument().then(() => { status.textContent = 'The real app is ready at 390px. Use a drop button or interact with the app below.'; }).catch(error => {
    status.textContent = error instanceof Error ? error.message : String(error);
  });
}

const content = root.querySelector<HTMLElement>('#check-content')!;
if (document.body.dataset.checkView === 'responsive') setupResponsiveChecks(content);
else setupPixelChecks(content);
