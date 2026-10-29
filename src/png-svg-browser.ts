import { compareVisiblePixels, createEmbeddedPngSvg, inspectPng, PNG_SVG_LIMITS, PngSvgError } from './png-svg';
import type { ConversionMode, PixelSvgOutput, PngMetadata, PngSvgErrorCode } from './png-svg';

export type { ConversionMode } from './png-svg';

export interface PngSvgProgress {
  stage: 'decoding' | 'converting' | 'verifying';
  message: string;
  percent?: number;
}

export interface PngSvgFidelity {
  status: 'verified' | 'different' | 'unavailable';
  differingPixels: number | null;
  totalPixels: number;
  reason?: string;
}

export interface PngSvgResult {
  svg: string;
  mode: ConversionMode;
  width: number;
  height: number;
  rectangleCount: number | null;
  sourceBytes: number;
  outputBytes: number;
  fidelity: PngSvgFidelity;
  warnings: string[];
}

export interface ConvertPngOptions {
  mode: ConversionMode;
  signal?: AbortSignal;
  onProgress?: (progress: PngSvgProgress) => void;
}

export interface DecodedPng {
  metadata: PngMetadata;
  bytes: Uint8Array;
  pixels: Uint8ClampedArray;
}

const IMAGE_TIMEOUT_MS = 30_000;
const WORKER_TIMEOUT_MS = 60_000;

function abortError(): DOMException {
  return new DOMException('Conversion cancelled.', 'AbortError');
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function readFileBytes(file: File, signal?: AbortSignal): Promise<Uint8Array> {
  checkAbort(signal);
  if (file.size > PNG_SVG_LIMITS.maxInputBytes) {
    return Promise.reject(new PngSvgError('This PNG exceeds the 20 MiB per-file limit.', 'image-limit'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (reader.readyState === FileReader.LOADING) reader.abort();
      reject(error);
    };
    const onAbort = () => fail(abortError());
    const timeout = window.setTimeout(() => fail(new Error('Reading this PNG took too long. Try importing it again.')), IMAGE_TIMEOUT_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
    reader.onerror = () => fail(new Error('This PNG could not be read from your device. Try importing it again.'));
    reader.onabort = onAbort;
    reader.onload = () => {
      if (settled) return;
      if (signal?.aborted) { onAbort(); return; }
      if (!(reader.result instanceof ArrayBuffer)) { fail(new Error('This PNG did not produce readable image bytes.')); return; }
      settled = true;
      cleanup();
      resolve(new Uint8Array(reader.result));
    };
    try {
      reader.readAsArrayBuffer(file);
    } catch (error) {
      fail(error instanceof Error ? error : new Error('The PNG could not be read.'));
    }
  });
}

/** Own the object URL and image for only the duration of a decode/draw operation. */
async function withImage<T>(blob: Blob, signal: AbortSignal | undefined, draw: (image: HTMLImageElement) => T): Promise<T> {
  checkAbort(signal);
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        window.clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        image.onload = null;
        image.onerror = null;
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          image.removeAttribute('src');
          reject(error);
        } else resolve();
      };
      const onAbort = () => finish(abortError());
      const timeout = window.setTimeout(() => finish(new Error('This browser took too long to render the image.')), IMAGE_TIMEOUT_MS);
      signal?.addEventListener('abort', onAbort, { once: true });
      image.onload = () => finish();
      image.onerror = () => finish(new Error('This browser could not decode or render the image. The PNG may be damaged or unsupported.'));
      image.src = url;
    });
    checkAbort(signal);
    return draw(image);
  } finally {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  }
}

function readNativePixels(image: HTMLImageElement, width: number, height: number): Uint8ClampedArray {
  if (image.naturalWidth !== width || image.naturalHeight !== height) {
    throw new Error('The browser decoded different dimensions from the PNG header. No resizing or orientation correction has been applied.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true });
    if (!context) throw new Error('This browser could not allocate a native-size 2D canvas.');
    context.imageSmoothingEnabled = false;
    // Native pixels only: CSS size, zoom, DPR and preview backgrounds never enter this path.
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, width, height, { colorSpace: 'srgb' });
    if (imageData.colorSpace && imageData.colorSpace !== 'srgb') {
      throw new Error('This browser did not return the requested sRGB pixel data.');
    }
    return imageData.data;
  } finally {
    // Release backing-store memory immediately; the returned ImageData has its own buffer.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Decode the original file without re-encoding it, after validating all allocation bounds. */
export async function decodePngPixels(file: File, signal?: AbortSignal): Promise<DecodedPng> {
  const bytes = await readFileBytes(file, signal);
  checkAbort(signal);
  const metadata = inspectPng(bytes);
  const pixels = await withImage(file.slice(0, file.size, 'image/png'), signal,
    image => readNativePixels(image, metadata.width, metadata.height));
  checkAbort(signal);
  return { metadata, bytes, pixels };
}

function generatePixelSvg(pixels: Uint8ClampedArray, width: number, height: number, options: ConvertPngOptions): Promise<PixelSvgOutput> {
  checkAbort(options.signal);
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./png-svg.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      reject(new Error('This browser could not start the local pixel converter. Try Embedded PNG mode.'));
      return;
    }
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => fail(abortError());
    const timeout = window.setTimeout(() => fail(new Error('Pixel conversion took too long. Try Embedded PNG mode for this image.')), WORKER_TIMEOUT_MS);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    worker.onerror = () => fail(new Error('The local pixel converter stopped unexpectedly. Try this file again or use Embedded PNG mode.'));
    worker.onmessageerror = () => fail(new Error('The local pixel converter returned an unreadable result.'));
    worker.onmessage = (event: MessageEvent) => {
      if (settled) return;
      if (options.signal?.aborted) { onAbort(); return; }
      const message = event.data;
      if (message?.type === 'progress') {
        options.onProgress?.({ stage: 'converting', message: 'Merging identical pixels…', percent: message.percent });
      } else if (message?.type === 'error') {
        fail(message.code ? new PngSvgError(message.message, message.code as PngSvgErrorCode) : new Error(message.message || 'Pixel conversion failed.'));
      } else if (message?.type === 'result') {
        if (typeof message.svg !== 'string' || !Number.isInteger(message.rectangleCount) || !Number.isInteger(message.outputBytes)) {
          fail(new Error('The local pixel converter returned an invalid SVG result.'));
          return;
        }
        settled = true;
        cleanup();
        resolve({ svg: message.svg, rectangleCount: message.rectangleCount, outputBytes: message.outputBytes });
      }
    };
    try {
      // Preserve the reference for the independent comparison; transfer only the worker copy.
      const workerPixels = pixels.slice();
      worker.postMessage({ pixels: workerPixels.buffer, width, height }, [workerPixels.buffer]);
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Pixel data could not reach the local worker.'));
    }
  });
}

/** Verify the exact downloadable SVG string, never a reconstruction of its geometry. */
export async function verifySvgPixels(svg: string, source: Uint8ClampedArray, width: number, height: number, signal?: AbortSignal): Promise<PngSvgFidelity> {
  checkAbort(signal);
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const rendered = await withImage(blob, signal, image => readNativePixels(image, width, height));
    checkAbort(signal);
    const comparison = compareVisiblePixels(source, rendered);
    return { status: comparison.differingPixels === 0 ? 'verified' : 'different', ...comparison };
  } catch (error) {
    checkAbort(signal);
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { status: 'unavailable', differingPixels: null, totalPixels: width * height, reason: error instanceof Error ? error.message : 'This browser could not complete the native-size pixel check.' };
  }
}

/** Convert one local PNG. The caller owns serial batching and retained preview/download URLs. */
export async function convertPng(file: File, options: ConvertPngOptions): Promise<PngSvgResult> {
  if (options.mode !== 'pixels' && options.mode !== 'embedded') throw new Error('Choose Pixel vectors or Embedded PNG conversion.');
  checkAbort(options.signal);
  options.onProgress?.({ stage: 'decoding', message: 'Decoding the original PNG…' });
  const { metadata, bytes, pixels } = await decodePngPixels(file, options.signal);
  checkAbort(options.signal);
  const { width, height } = metadata;
  options.onProgress?.({ stage: 'converting', message: options.mode === 'pixels' ? 'Merging identical pixels…' : 'Embedding the original PNG bytes…' });
  const generated = options.mode === 'pixels'
    ? await generatePixelSvg(pixels, width, height, options)
    : { svg: createEmbeddedPngSvg(bytes, width, height), rectangleCount: null };
  checkAbort(options.signal);
  options.onProgress?.({ stage: 'verifying', message: 'Comparing the SVG at native dimensions…' });
  const fidelity = await verifySvgPixels(generated.svg, pixels, width, height, options.signal);
  checkAbort(options.signal);
  const warnings: string[] = [];
  if (metadata.hasColorProfile) warnings.push('PNG color metadata was decoded into sRGB by this browser. Other browsers or color profiles may render differently.');
  if (metadata.bitDepth === 16) warnings.push('The pixel check uses the browser’s 8-bit RGBA sRGB reference. Embedded PNG mode retains the original 16-bit file bytes.');
  return {
    svg: generated.svg,
    mode: options.mode,
    width,
    height,
    rectangleCount: generated.rectangleCount,
    sourceBytes: file.size,
    outputBytes: generated.svg.length,
    fidelity,
    warnings,
  };
}
