import ImageTracer from 'imagetracerjs';
import { createSilhouetteMask, createTracePalette, imageTracerOptions, normalizeTransparentPixels, PNG_SVG_TRACE_LIMITS, validateTraceInput } from './png-svg-trace';
import { PNG_SVG_LIMITS, PngSvgError } from './png-svg';

interface TraceRequest { pixels: ArrayBuffer; width: number; height: number; silhouette: boolean }
const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TraceRequest>) => void) | null;
  postMessage(message: unknown): void;
};

worker.onmessage = event => {
  try {
    const { pixels: buffer, width, height, silhouette } = event.data;
    if (!(buffer instanceof ArrayBuffer)) throw new Error('The tracing worker received invalid pixels.');
    const original = new Uint8ClampedArray(buffer);
    validateTraceInput(original, width, height);
    const pixels = silhouette ? createSilhouetteMask(original, false) : normalizeTransparentPixels(original);
    const palette = silhouette ? [{ r: 0, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 0, a: 255 }] : createTracePalette(pixels);
    const options = imageTracerOptions(palette, silhouette);
    worker.postMessage({ type: 'progress', percent: 15 });
    const traced = ImageTracer.imagedataToTracedata({ width, height, data: pixels }, options);
    let paths = 0;
    let commands = 0;
    for (let layer = 0; layer < traced.layers.length; layer++) {
      if (traced.palette[layer].a === 0) { traced.layers[layer] = []; continue; }
      for (const path of traced.layers[layer]) { paths++; commands += path.segments.length; }
      if (paths > PNG_SVG_TRACE_LIMITS.maxPaths || commands > PNG_SVG_TRACE_LIMITS.maxPathCommands) {
        throw new PngSvgError('This smooth trace contains too many paths. Use Pixel vectors or Embedded PNG.', 'trace-limit');
      }
    }
    worker.postMessage({ type: 'progress', percent: 90 });
    const svg = ImageTracer.getsvgstring(traced, options);
    if (svg.length > PNG_SVG_LIMITS.maxSvgBytes) throw new PngSvgError('The smooth SVG exceeds the output size limit.', 'svg-limit');
    worker.postMessage({ type: 'result', svg });
  } catch (error) {
    worker.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Local tracing failed.', code: error instanceof PngSvgError ? error.code : undefined });
  }
};
