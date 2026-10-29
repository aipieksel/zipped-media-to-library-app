import { createPixelSvg, PngSvgError } from './png-svg';

interface PixelWorkerRequest {
  pixels: ArrayBuffer;
  width: number;
  height: number;
}

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PixelWorkerRequest>) => void) | null;
  postMessage(message: unknown): void;
};

worker.onmessage = event => {
  try {
    const { pixels, width, height } = event.data;
    if (!(pixels instanceof ArrayBuffer)) throw new Error('The conversion worker received invalid pixels.');
    let lastProgress = 0;
    const result = createPixelSvg(new Uint8ClampedArray(pixels), width, height, {
      onProgress(completedRows, totalRows) {
        const now = Date.now();
        if (now - lastProgress >= 60 || completedRows === totalRows) {
          lastProgress = now;
          worker.postMessage({ type: 'progress', percent: Math.round(completedRows / totalRows * 100) });
        }
      },
    });
    worker.postMessage({ type: 'result', ...result });
  } catch (error) {
    worker.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Could not generate SVG pixel geometry.',
      code: error instanceof PngSvgError ? error.code : undefined,
    });
  }
};
