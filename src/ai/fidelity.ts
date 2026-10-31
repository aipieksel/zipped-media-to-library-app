import {verifySvgPixels} from '../png-svg-browser';
import type {PngSvgFidelity, PngSvgResult} from '../png-svg-browser';

export const describeFidelity = (value?: PngSvgFidelity): string => value?.status === 'verified' && value.differingPixels === 0
  ? 'Pixel match verified'
  : value?.status === 'different' && value.differingPixels !== null
    ? `${value.differingPixels.toLocaleString()} differing pixels`
    : 'Pixel check unavailable';

/** Compare against the actual original Blob, never a thumbnail or normalized re-encode. */
export async function checkArtworkPixels(svg: string, source: Blob, width: number, height: number, signal?: AbortSignal): Promise<{fidelity: PngSvgFidelity; verification: PngSvgResult['verification']}> {
  if (signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
  const url = URL.createObjectURL(source);
  const image = new Image(); image.decoding = 'async';
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null; error ? reject(error) : resolve();};
      const abort = () => finish(new DOMException('Cancelled.', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('The source preview took too long to decode.')), 30_000);
      signal?.addEventListener('abort', abort, {once: true});
      image.onload = () => finish(); image.onerror = () => finish(new Error('The original image could not be decoded for its pixel check.')); image.src = url;
    });
    if (signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error('The original image and SVG have different native dimensions.');
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', {colorSpace: 'srgb', willReadFrequently: true});
    if (!context) throw new Error('This browser cannot create a canvas for the pixel check.');
    context.drawImage(image, 0, 0);
    const reference = context.getImageData(0, 0, width, height).data;
    const fidelity = await verifySvgPixels(svg, reference, width, height, signal);
    return {fidelity, verification: {checkedAt: new Date().toISOString(), browser: navigator.userAgent, colorSpace: 'srgb', pixelFormat: 'rgba8'}};
  } finally {image.removeAttribute('src'); URL.revokeObjectURL(url);}
}
