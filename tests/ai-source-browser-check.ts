/// <reference types="vite/client" />
/** Native browser regression for F13. Synthetic images and isolated QA databases only. */
import {prepareAiImage} from '../src/ai/client';
import {normalizeValidatedAiSource} from '../src/ai/source';
import {checkArtworkPixels} from '../src/ai/fidelity';
import {openIconCollection} from '../src/icon-collection';
import type {IconCollectionStore} from '../src/icon-collection';
import {sanitizeSvg} from '../src/saved-svg';
import {inspectRaster} from '../src/raster-input';
import {uniqueId} from '../src/identity';

if (!import.meta.env.DEV) throw new Error('AI source checks are available only in the development server.');
const prefix = 'folio-ai-source-qa-';
const width = 12, height = 10;
function assert(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function databaseRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
}
async function sameBytes(left: Blob | undefined, right: Blob): Promise<boolean> {
  if (!left || left.size !== right.size) return false;
  const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  const expected = new Uint8Array(b);
  return new Uint8Array(a).every((value, index) => value === expected[index]);
}
async function syntheticWebp(): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); assert(context, 'The test browser could not create its synthetic canvas.');
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#d94025'; context.fillRect(1, 1, 5, 7);
  context.fillStyle = 'rgba(20,100,220,0.5)'; context.fillRect(6, 2, 5, 6);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Native WebP encoding failed.')), 'image/webp', 1));
  assert(blob.type === 'image/webp', 'This browser does not provide native WebP canvas encoding; this check has not passed.');
  const metadata = inspectRaster(new Uint8Array(await blob.arrayBuffer()));
  assert(metadata.mime === 'image/webp' && metadata.width === width && metadata.height === height, 'The procedural fixture is not a native-size static WebP.');
  return blob;
}

export async function runAiSourceChecks() {
  const report = {browser: navigator.userAgent, startedAt: new Date().toISOString(), completedAt: '', passed: 0, failed: 0, providerRequests: 0,
    checks: [] as {name: string; status: 'pass' | 'fail'; details?: unknown; error?: string}[]};
  const check = async (name: string, operation: () => Promise<unknown>) => {
    try {const details = await operation(); report.passed++; report.checks.push({name, status: 'pass', details});}
    catch (error) {report.failed++; report.checks.push({name, status: 'fail', error: error instanceof Error ? error.message : String(error)});}
  };

  for (const declaredType of ['image/png', '']) {
    await check(`Native WebP declared ${declaredType || 'without MIME'} survives preparation, candidate save and reload unchanged`, async () => {
      const encoded = await syntheticWebp(), original = encoded.slice(0, encoded.size, declaredType);
      const filename = declaredType ? 'renamed-icon.png' : 'untyped-icon.webp';
      assert(original.type === declaredType, 'The fixture did not retain its misleading/empty declared MIME.');
      const attachment = await prepareAiImage(original, filename);
      assert(attachment.mimeType === 'image/png' && attachment.width === width && attachment.height === height, 'The AI attachment lost its native dimensions.');
      const attachmentBytes = Uint8Array.from(atob(attachment.dataBase64), value => value.charCodeAt(0));
      assert(inspectRaster(attachmentBytes).mime === 'image/png', 'The normalized provider attachment must be PNG.');

      const candidateSource = await normalizeValidatedAiSource(original);
      assert(candidateSource.type === 'image/webp' && await sameBytes(candidateSource, encoded), 'Source normalization changed bytes or retained the wrong MIME.');
      const candidate = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="1" y="1" width="5" height="7" fill="#d94025"/><rect x="6" y="2" width="5" height="6" fill="#1464dc" fill-opacity="0.5"/></svg>`, {width, height});
      const nativeCheck = await checkArtworkPixels(candidate.svg, candidateSource, width, height);
      assert(nativeCheck.fidelity.totalPixels === width * height && nativeCheck.fidelity.status !== 'unavailable', 'The original-byte source could not receive a real native comparison.');

      const name = prefix + uniqueId(); let store: IconCollectionStore | undefined;
      try {
        store = await openIconCollection(name);
        const input = {name: filename, svg: candidate.svg, width, height,
          source: {kind: 'images' as const, id: 'synthetic-image-' + uniqueId(), name: filename, mime: 'image/webp' as const, blob: candidateSource},
          provenance: {kind: 'ai' as const, provider: 'qa-fixture', model: 'procedural-svg-no-provider-call'}, ...nativeCheck};
        let rejectedMismatch = false;
        try {await store.saveArtwork({...input, source: {...input.source, mime: 'image/png', blob: original}});}
        catch (error) {rejectedMismatch = error instanceof Error && /source format or dimensions/.test(error.message);}
        assert(rejectedMismatch, 'The strict store guard no longer rejects incorrect source MIME.');
        assert((await store.snapshot()).saved.length === 0, 'The rejected mismatched source left a saved record.');

        const saved = await store.saveArtwork(input);
        store.close(); store = await openIconCollection(name);
        const record = (await store.snapshot()).saved.find(value => value.id === saved.id);
        const retained = await store.getSavedSource(saved.id);
        assert(record?.source.mime === 'image/webp' && record.source.name === filename, 'Reload lost the detected format or original filename.');
        assert(retained?.type === 'image/webp' && await sameBytes(retained, encoded), 'Saved source bytes were re-encoded, replaced by the attachment or lost on reload.');
        assert(await (await store.getSavedOutput(saved.id))?.text() === candidate.svg, 'Reload changed the accepted SVG candidate.');
        return {declaredType, detectedType: record.source.mime, sourceBytes: retained.size, attachmentBytes: attachmentBytes.length, differingPixels: nativeCheck.fidelity.differingPixels, exactOriginalBytesAfterReload: true};
      } finally {
        store?.close();
        assert(name.startsWith(prefix), 'Refusing to delete non-QA browser storage.');
        await databaseRequest(indexedDB.deleteDatabase(name));
      }
    });
  }
  report.completedAt = new Date().toISOString();
  return report;
}
