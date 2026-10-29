/** Pure, dependency-free PNG/SVG operations. Imported by the local worker and tests. */
export type ConversionMode = 'pixels' | 'embedded';

export const PNG_SVG_LIMITS = Object.freeze({
  maxInputBytes: 20 * 1024 * 1024,
  maxSide: 4096,
  maxPixels: 4_194_304,
  maxRectangles: 150_000,
  maxSvgBytes: 24 * 1024 * 1024,
});

export type PngSvgErrorCode = 'invalid-png' | 'animated-png' | 'image-limit' | 'vector-limit' | 'svg-limit';

export class PngSvgError extends Error {
  constructor(message: string, public readonly code: PngSvgErrorCode) {
    super(message);
    this.name = 'PngSvgError';
  }
}

export interface PngMetadata {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  hasColorProfile: boolean;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const VALID_DEPTHS: Record<number, readonly number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new PngSvgError('The PNG must have positive whole-pixel dimensions.', 'invalid-png');
  }
  if (width > PNG_SVG_LIMITS.maxSide || height > PNG_SVG_LIMITS.maxSide || width * height > PNG_SVG_LIMITS.maxPixels) {
    throw new PngSvgError('This image exceeds the local limit of 4,194,304 pixels or 4,096 pixels per side. Use a smaller source; no resizing has been applied.', 'image-limit');
  }
}

/** Inspect structure and allocation bounds before asking the browser to decode image data. */
export function inspectPng(bytes: Uint8Array): PngMetadata {
  if (bytes.byteLength > PNG_SVG_LIMITS.maxInputBytes) {
    throw new PngSvgError('This PNG exceeds the 20 MiB per-file limit.', 'image-limit');
  }
  if (bytes.byteLength < 45 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new PngSvgError('This file is not a complete PNG. Choose an original .png image.', 'invalid-png');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let metadata: PngMetadata | undefined;
  let sawImageData = false;
  let sawPalette = false;
  let imageDataEnded = false;
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 12) {
      throw new PngSvgError('The PNG contains a truncated chunk.', 'invalid-png');
    }
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (length > 0x7fffffff || end > bytes.byteLength) {
      throw new PngSvgError('The PNG contains an invalid or truncated chunk.', 'invalid-png');
    }
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (!/^[A-Za-z]{4}$/.test(type)) {
      throw new PngSvgError('The PNG contains an invalid chunk name.', 'invalid-png');
    }
    if (!metadata && type !== 'IHDR') {
      throw new PngSvgError('The PNG is missing its initial image header.', 'invalid-png');
    }
    if (type === 'IHDR') {
      if (metadata || length !== 13) throw new PngSvgError('The PNG image header is invalid.', 'invalid-png');
      const width = view.getUint32(offset + 8);
      const height = view.getUint32(offset + 12);
      validateDimensions(width, height);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      if (!VALID_DEPTHS[colorType]?.includes(bitDepth) || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] > 1) {
        throw new PngSvgError('The PNG uses an invalid image format.', 'invalid-png');
      }
      metadata = { width, height, bitDepth, colorType, interlaced: bytes[offset + 20] === 1, hasColorProfile: false };
    } else if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
      throw new PngSvgError('Animated PNGs are not supported by this static converter. Export a single PNG frame first.', 'animated-png');
    } else if (type === 'PLTE') {
      if (sawPalette || sawImageData || length === 0 || length > 768 || length % 3 !== 0) {
        throw new PngSvgError('The PNG palette is invalid.', 'invalid-png');
      }
      sawPalette = true;
    } else if (type === 'IDAT') {
      if (imageDataEnded || (metadata!.colorType === 3 && !sawPalette)) {
        throw new PngSvgError('The PNG image data or palette order is invalid.', 'invalid-png');
      }
      sawImageData = true;
    } else if (type === 'IEND') {
      if (length !== 0 || !sawImageData || end !== bytes.byteLength) {
        throw new PngSvgError('The PNG is incomplete or contains data after its end marker.', 'invalid-png');
      }
      return metadata!;
    } else {
      if (sawImageData) imageDataEnded = true;
      if (type === 'iCCP' || type === 'cICP' || type === 'sRGB' || type === 'gAMA' || type === 'cHRM') {
        metadata!.hasColorProfile = true;
      }
      // Unknown critical chunks cannot be interpreted safely as a standard PNG.
      if (type[0] === type[0].toUpperCase()) {
        throw new PngSvgError('The PNG contains an unsupported critical chunk.', 'invalid-png');
      }
    }
    offset = end;
  }
  throw new PngSvgError('The PNG is missing its end marker.', 'invalid-png');
}

export interface PixelRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PixelSvgOptions {
  maxRectangles?: number;
  maxSvgBytes?: number;
  onProgress?: (completedRows: number, totalRows: number) => void;
}

export interface PixelSvgOutput {
  svg: string;
  rectangleCount: number;
  outputBytes: number;
}

type RgbaBytes = Uint8Array | Uint8ClampedArray;

function pixelKey(rgba: RgbaBytes, offset: number): number {
  return rgba[offset] * 0x1000000 + rgba[offset + 1] * 0x10000 + rgba[offset + 2] * 0x100 + rgba[offset + 3];
}

/** Merge identical horizontal runs and identical spans on successive rows, with no overlaps. */
export function mergePixelRectangles(rgba: RgbaBytes, width: number, height: number, options: PixelSvgOptions = {}): PixelRectangle[] {
  validateDimensions(width, height);
  if (rgba.length !== width * height * 4) throw new PngSvgError('Decoded RGBA dimensions do not match the PNG.', 'invalid-png');
  const maxRectangles = Math.min(options.maxRectangles ?? PNG_SVG_LIMITS.maxRectangles, PNG_SVG_LIMITS.maxRectangles);
  if (!Number.isInteger(maxRectangles) || maxRectangles < 0) throw new RangeError('Invalid rectangle limit.');
  const rectangles: PixelRectangle[] = [];
  let previous = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    const current = new Map<string, number>();
    let x = 0;
    while (x < width) {
      const offset = (y * width + x) * 4;
      if (rgba[offset + 3] === 0) {
        x++;
        continue;
      }
      const key = pixelKey(rgba, offset);
      const start = x++;
      while (x < width && pixelKey(rgba, (y * width + x) * 4) === key) x++;
      const runWidth = x - start;
      const span = `${start}:${runWidth}:${key}`;
      const existing = previous.get(span);
      if (existing !== undefined) {
        // This local builder is deliberately mutated to avoid copying large pixel arrays.
        rectangles[existing].height++;
        current.set(span, existing);
      } else {
        if (rectangles.length >= maxRectangles) {
          throw new PngSvgError('This PNG needs too many pixel shapes for a practical SVG. Choose Embedded PNG to keep its original bitmap inside an SVG.', 'vector-limit');
        }
        current.set(span, rectangles.length);
        rectangles.push({ x: start, y, width: runWidth, height: 1, r: rgba[offset], g: rgba[offset + 1], b: rgba[offset + 2], a: rgba[offset + 3] });
      }
    }
    previous = current;
    if (y % 32 === 0 || y === height - 1) options.onProgress?.(y + 1, height);
  }
  return rectangles;
}

const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));
const svgStart = (width: number, height: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" color-interpolation="sRGB">`;

/** SVG geometry retains the source pixel grid; no tracing, quantization or alpha thresholding. */
export function createPixelSvg(rgba: RgbaBytes, width: number, height: number, options: PixelSvgOptions = {}): PixelSvgOutput {
  const rectangles = mergePixelRectangles(rgba, width, height, options);
  const maxBytes = Math.min(options.maxSvgBytes ?? PNG_SVG_LIMITS.maxSvgBytes, PNG_SVG_LIMITS.maxSvgBytes);
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new RangeError('Invalid SVG byte limit.');
  const opening = svgStart(width, height) + '<g shape-rendering="crispEdges">';
  const closing = '</g></svg>';
  const parts = [opening];
  let outputBytes = opening.length + closing.length;
  for (const rect of rectangles) {
    const opacity = rect.a === 255 ? '' : ` fill-opacity="${rect.a / 255}"`;
    const shape = `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="#${HEX[rect.r]}${HEX[rect.g]}${HEX[rect.b]}"${opacity}/>`;
    outputBytes += shape.length;
    if (outputBytes > maxBytes) throw new PngSvgError('The pixel SVG exceeds the local output limit. Choose Embedded PNG for this image.', 'svg-limit');
    parts.push(shape);
  }
  if (outputBytes > maxBytes) throw new PngSvgError('The SVG exceeds the local output limit.', 'svg-limit');
  parts.push(closing);
  // All emitted markup is ASCII, so length is the exact UTF-8 byte size.
  return { svg: parts.join(''), rectangleCount: rectangles.length, outputBytes };
}

/** Original bytes are embedded directly; no canvas re-encoding or pixel editing is performed. */
export function createEmbeddedPngSvg(bytes: Uint8Array, width: number, height: number): string {
  const metadata = inspectPng(bytes);
  if (metadata.width !== width || metadata.height !== height) throw new PngSvgError('Embedded PNG dimensions do not match its header.', 'invalid-png');
  const opening = svgStart(width, height) + `<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" href="data:image/png;base64,`;
  const closing = '"/></svg>';
  if (opening.length + 4 * Math.ceil(bytes.length / 3) + closing.length > PNG_SVG_LIMITS.maxSvgBytes) {
    throw new PngSvgError('The embedded SVG would exceed the 24 MiB output limit. Use a smaller PNG source.', 'svg-limit');
  }
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)));
  }
  return opening + btoa(chunks.join('')) + closing;
}

export interface PixelComparison {
  differingPixels: number;
  totalPixels: number;
}

/** Compare exact RGBA bytes; only RGB hidden by zero alpha on both sides is invisible. */
export function compareVisiblePixels(source: RgbaBytes, rendered: RgbaBytes): PixelComparison {
  if (source.length !== rendered.length || source.length % 4 !== 0) throw new RangeError('RGBA pixel arrays must have the same whole-pixel length.');
  let differingPixels = 0;
  for (let offset = 0; offset < source.length; offset += 4) {
    const sourceAlpha = source[offset + 3];
    const renderedAlpha = rendered[offset + 3];
    if (sourceAlpha !== renderedAlpha || ((sourceAlpha !== 0 || renderedAlpha !== 0) &&
      (source[offset] !== rendered[offset] || source[offset + 1] !== rendered[offset + 1] || source[offset + 2] !== rendered[offset + 2]))) {
      differingPixels++;
    }
  }
  return { differingPixels, totalPixels: source.length / 4 };
}

function filenameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

/** Keep the source basename where safe and reserve names case-insensitively across a batch. */
export function allocateSvgFilename(sourceName: string, usedNames: Set<string>): string {
  const sourceBase = sourceName.replace(/\\/g, '/').split('/').at(-1) ?? '';
  let stem = sourceBase.replace(/\.png$/i, '').normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g, '_')
    .replace(/[. ]+$/g, '').trim();
  if (!stem || /^\.+$/.test(stem)) stem = 'image';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = '_' + stem;
  // Keep Unicode intact while leaving byte room for suffixes on common filesystems.
  const encoder = new TextEncoder();
  let filenameBytes = 0;
  stem = Array.from(stem).filter(character => {
    filenameBytes += encoder.encode(character).length;
    return filenameBytes <= 180;
  }).join('');
  const reserved = new Set([...usedNames].map(filenameKey));
  let filename = stem + '.svg';
  let suffix = 2;
  while (reserved.has(filenameKey(filename))) filename = `${stem} (${suffix++}).svg`;
  usedNames.add(filenameKey(filename));
  return filename;
}
