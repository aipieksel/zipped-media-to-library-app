import {createEmbeddedPngSvg, inspectPng, PNG_SVG_LIMITS, PngSvgError} from './png-svg';
import type {PngMetadata} from './png-svg';

export type RasterFormat = 'png' | 'webp';
export type RasterMime = 'image/png' | 'image/webp';
export interface WebpMetadata {
  format: 'webp';
  mime: 'image/webp';
  width: number;
  height: number;
  lossless: boolean;
  hasAlpha: boolean;
  hasColorProfile: boolean;
  hasExif: boolean;
}
export type RasterMetadata = (PngMetadata & {format: 'png'; mime: 'image/png'}) | WebpMetadata;

const fourCC = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
const uint24 = (bytes: Uint8Array, offset: number) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
const invalid = (message: string): never => {throw new PngSvgError(message, 'invalid-webp');};

function dimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) invalid('The WebP has invalid native dimensions.');
  if (width > PNG_SVG_LIMITS.maxSide || height > PNG_SVG_LIMITS.maxSide || width * height > PNG_SVG_LIMITS.maxPixels) {
    throw new PngSvgError('This image exceeds the local limit of 4,194,304 pixels or 4,096 pixels per side. Use a smaller source; no resizing has been applied.', 'image-limit');
  }
}

/** Container/header inspection only; the browser validates the compressed image stream. */
export function inspectWebp(bytes: Uint8Array): WebpMetadata {
  if (bytes.length > PNG_SVG_LIMITS.maxInputBytes) throw new PngSvgError('This WebP exceeds the 20 MiB per-file limit.', 'image-limit');
  if (bytes.length < 20 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WEBP') invalid('This file is not a complete WebP image.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredSize = view.getUint32(4, true) + 8;
  if (declaredSize !== bytes.length || declaredSize % 2 !== 0) invalid('The WebP RIFF length is truncated or contains trailing data.');
  let width = 0, height = 0, canvasWidth = 0, canvasHeight = 0;
  let extended = false, sawImage = false, sawAlpha = false, hasColorProfile = false, hasExif = false, lossless = false, hasAlpha = false;
  let count = 0;
  for (let offset = 12; offset < bytes.length;) {
    if (++count > 20_000) throw new PngSvgError('This WebP contains too many metadata chunks. Use a simpler source image.', 'image-limit');
    if (bytes.length - offset < 8) invalid('The WebP contains a truncated chunk header.');
    const type = fourCC(bytes, offset), length = view.getUint32(offset + 4, true), start = offset + 8;
    const end = start + length, next = end + (length & 1);
    if (next > bytes.length || (length % 2 === 1 && bytes[end] !== 0)) invalid('The WebP contains a truncated chunk or invalid RIFF padding.');
    if (type === 'ANIM' || type === 'ANMF') throw new PngSvgError('Animated WebP is not supported by this static converter. Export a single PNG or WebP frame first.', 'animated-webp');
    if (offset === 12 && type !== 'VP8X' && type !== 'VP8 ' && type !== 'VP8L') invalid('The WebP is missing its initial image header.');
    if (type === 'VP8X') {
      if (offset !== 12 || extended || length < 10) invalid('The extended WebP header is invalid or duplicated.');
      extended = true;
      const flags = bytes[start];
      if (flags & 0x02) throw new PngSvgError('Animated WebP is not supported by this static converter. Export a single PNG or WebP frame first.', 'animated-webp');
      hasAlpha = Boolean(flags & 0x10);
      canvasWidth = uint24(bytes, start + 4) + 1;
      canvasHeight = uint24(bytes, start + 7) + 1;
      dimensions(canvasWidth, canvasHeight);
    } else if (type === 'VP8 ' || type === 'VP8L') {
      if (sawImage) invalid('The WebP contains more than one still-image payload.');
      sawImage = true; lossless = type === 'VP8L';
      if (lossless) {
        if (length < 5 || bytes[start] !== 0x2f || bytes[start + 4] >>> 5 !== 0 || sawAlpha) invalid('The WebP lossless image header is invalid.');
        const bits = view.getUint32(start + 1, true);
        width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
        hasAlpha ||= Boolean(bits & 0x10000000);
      } else {
        if (length < 10 || (bytes[start] & 1) !== 0 || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) invalid('The WebP lossy image header is invalid.');
        width = view.getUint16(start + 6, true) & 0x3fff;
        height = view.getUint16(start + 8, true) & 0x3fff;
      }
      dimensions(width, height);
      if (extended && (width !== canvasWidth || height !== canvasHeight)) invalid('The WebP image dimensions do not match its canvas header.');
    } else if (type === 'ALPH') {
      if (!extended || sawAlpha || sawImage || length < 1) invalid('The WebP alpha chunk is invalid or out of order.');
      sawAlpha = true; hasAlpha = true;
    } else if (type === 'ICCP') {
      if (!extended || sawImage || hasColorProfile || !length) invalid('The WebP color profile is invalid or out of order.');
      hasColorProfile = true;
    } else if (type === 'EXIF') {
      hasExif = true;
    }
    offset = next;
  }
  if (!sawImage) invalid('The WebP is missing its still-image data.');
  return {format: 'webp', mime: 'image/webp', width, height, lossless, hasAlpha, hasColorProfile, hasExif};
}

/** Byte signatures are authoritative; intake names and MIME types are only hints. */
export function inspectRaster(bytes: Uint8Array): RasterMetadata {
  if (bytes[0] === 137 && fourCC(bytes, 1) === 'PNG\r') return {...inspectPng(bytes), format: 'png', mime: 'image/png'};
  if (fourCC(bytes, 0) === 'RIFF' && fourCC(bytes, 8) === 'WEBP') return inspectWebp(bytes);
  throw new PngSvgError('This file is not a supported PNG or WebP image. Choose an original .png or .webp file.', 'invalid-image');
}

/** Preserve bytes without canvas encoding; PNG retains its established implementation. */
export function createEmbeddedRasterSvg(bytes: Uint8Array, width: number, height: number): string {
  const metadata = inspectRaster(bytes);
  if (metadata.format === 'png') return createEmbeddedPngSvg(bytes, width, height);
  if (metadata.width !== width || metadata.height !== height) invalid('Embedded WebP dimensions do not match its header.');
  const opening = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" color-interpolation="sRGB"><image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" href="data:image/webp;base64,`;
  const closing = '"/></svg>';
  if (opening.length + 4 * Math.ceil(bytes.length / 3) + closing.length > PNG_SVG_LIMITS.maxSvgBytes) throw new PngSvgError('The embedded SVG would exceed the 24 MiB output limit. Use a smaller source image.', 'svg-limit');
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  return opening + btoa(parts.join('')) + closing;
}

/** For pre-validation storage/queue reconstruction; conversion rechecks the actual bytes. */
export function rasterMimeHint(file: Pick<File, 'name' | 'type'>): RasterMime {
  return file.type === 'image/webp' || /\.webp$/i.test(file.name) ? 'image/webp' : 'image/png';
}
