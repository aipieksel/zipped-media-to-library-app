import { PNG_SVG_LIMITS, PngSvgError } from './png-svg';

export const PNG_SVG_TRACE_LIMITS = Object.freeze({
  maxPixels: 262_144,
  maxSide: 1024,
  maxPaths: 20_000,
  maxPathCommands: 200_000,
  maxPaletteColors: 64,
  timeoutMs: 45_000,
});

export interface TraceColor { r: number; g: number; b: number; a: number }
export interface SilhouetteInfo { color: TraceColor; opaquePixels: number; edgePixels: number }
export type SilhouetteRejectionReason =
  | 'insufficient-opaque-core'
  | 'no-transparent-background'
  | 'no-antialiased-edge'
  | 'foreground-color-mismatch'
  | 'opaque-support-too-distant'
  | 'transparent-support-too-distant';
export type SilhouetteAnalysis =
  | { silhouette: SilhouetteInfo; reason: null }
  | { silhouette: null; reason: SilhouetteRejectionReason };
export interface PngSvgEngine {
  id: 'pixel-rectangles' | 'original-png' | 'vtracer' | 'imagetracer' | 'silhouette';
  name: string;
  version: string;
}

export const TRACE_ENGINES = Object.freeze({
  vtracer: { id: 'vtracer', name: 'VTracer', version: '1.0.0-alpha.4 / browser 0.0.3 / profile 1' },
  imagetracer: { id: 'imagetracer', name: 'ImageTracer', version: '1.2.6 / RGBA profile 1' },
  silhouette: { id: 'silhouette', name: 'ImageTracer · silhouette contours', version: '1.2.6 / silhouette profile 2' },
} satisfies Record<string, PngSvgEngine>);

const SILHOUETTE_SUPPORT_RADIUS = 3;
const SILHOUETTE_REJECTION_MESSAGES: Record<SilhouetteRejectionReason, string> = {
  'insufficient-opaque-core': 'Fewer than four fully opaque pixels were found.',
  'no-transparent-background': 'No fully transparent background pixels were found.',
  'no-antialiased-edge': 'No partially transparent edge pixels were found.',
  'foreground-color-mismatch': 'Visible colors exceed the single-foreground color tolerance.',
  'opaque-support-too-distant': 'Some partial-alpha pixels cannot reach opaque pixels within 3 pixels without decreasing opacity.',
  'transparent-support-too-distant': 'Some partial-alpha pixels cannot reach transparency within 3 pixels without increasing opacity.',
};

export function silhouetteRejectionMessage(reason: SilhouetteRejectionReason): string {
  return SILHOUETTE_REJECTION_MESSAGES[reason];
}

export function validateTraceInput(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4) {
    throw new PngSvgError('The decoded pixels do not match the tracing dimensions.', 'invalid-png');
  }
  if (width > PNG_SVG_TRACE_LIMITS.maxSide || height > PNG_SVG_TRACE_LIMITS.maxSide || width * height > PNG_SVG_TRACE_LIMITS.maxPixels) {
    throw new PngSvgError('Smooth curves supports up to 262,144 pixels and 1,024 pixels per side. Use Pixel vectors or Embedded PNG for this original; no resizing has been applied.', 'trace-limit');
  }
}

export function isFullyOpaque(pixels: Uint8Array | Uint8ClampedArray): boolean {
  for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] !== 255) return false;
  return true;
}

/**
 * Shortest eight-neighbor paths, capped at the narrow-fringe radius. Propagate
 * outward from the target in reverse alpha order so a valid path back to the
 * target never turns away from its opacity. Every pixel enters the BFS once.
 */
function alphaSupportDistances(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, opaque: boolean): Uint8Array {
  const count = width * height;
  const unreached = SILHOUETTE_SUPPORT_RADIUS + 1;
  const distances = new Uint8Array(count).fill(unreached);
  const queue = new Uint32Array(count);
  let head = 0;
  let tail = 0;
  const targetAlpha = opaque ? 255 : 0;
  for (let pixel = 0; pixel < count; pixel++) {
    if (pixels[pixel * 4 + 3] === targetAlpha) {
      distances[pixel] = 0;
      queue[tail++] = pixel;
    }
  }
  if (!opaque) {
    // The transparent exterior is one step from a border pixel. Seed these
    // after all distance-zero pixels to retain breadth-first ordering.
    const seedBorder = (pixel: number) => {
      if (distances[pixel] === unreached) {
        distances[pixel] = 1;
        queue[tail++] = pixel;
      }
    };
    for (let x = 0; x < width; x++) { seedBorder(x); seedBorder((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { seedBorder(y * width); seedBorder(y * width + width - 1); }
  }
  while (head < tail) {
    const pixel = queue[head++];
    const distance = distances[pixel];
    if (distance === SILHOUETTE_SUPPORT_RADIUS) continue;
    const alpha = pixels[pixel * 4 + 3];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (distances[neighbor] !== unreached) continue;
        const neighborAlpha = pixels[neighbor * 4 + 3];
        if (opaque ? neighborAlpha > alpha : neighborAlpha < alpha) continue;
        distances[neighbor] = distance + 1;
        queue[tail++] = neighbor;
      }
    }
  }
  return distances;
}

/**
 * One opaque foreground color, transparent background and a narrow monotone
 * antialias fringe. Broader alpha fields remain on RGBA tracing. Report the
 * actual failed guard without interpreting the image's subject or intent.
 */
export function analyzeSilhouette(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): SilhouetteAnalysis {
  validateTraceInput(pixels, width, height);
  let color: TraceColor | undefined;
  let opaquePixels = 0;
  let transparentPixels = 0;
  let edgePixels = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3];
    if (alpha === 255) {
      opaquePixels++;
      if (!color) color = { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2], a: 255 };
    } else if (alpha === 0) transparentPixels++;
    else edgePixels++;
  }
  if (!color || opaquePixels < 4) return { silhouette: null, reason: 'insufficient-opaque-core' };
  if (!transparentPixels) return { silhouette: null, reason: 'no-transparent-background' };
  if (!edgePixels) return { silhouette: null, reason: 'no-antialiased-edge' };
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3];
    if (!alpha) continue;
    // Compare premultiplied channels to tolerate only canvas readback rounding.
    if (Math.abs(pixels[offset] - color.r) * alpha > 384 ||
        Math.abs(pixels[offset + 1] - color.g) * alpha > 384 ||
        Math.abs(pixels[offset + 2] - color.b) * alpha > 384) {
      return { silhouette: null, reason: 'foreground-color-mismatch' };
    }
  }
  const opaqueSupport = alphaSupportDistances(pixels, width, height, true);
  for (let pixel = 0; pixel < opaqueSupport.length; pixel++) {
    const alpha = pixels[pixel * 4 + 3];
    if (alpha > 0 && alpha < 255 && opaqueSupport[pixel] > SILHOUETTE_SUPPORT_RADIUS) {
      return { silhouette: null, reason: 'opaque-support-too-distant' };
    }
  }
  const transparentSupport = alphaSupportDistances(pixels, width, height, false);
  for (let pixel = 0; pixel < transparentSupport.length; pixel++) {
    const alpha = pixels[pixel * 4 + 3];
    if (alpha > 0 && alpha < 255 && transparentSupport[pixel] > SILHOUETTE_SUPPORT_RADIUS) {
      return { silhouette: null, reason: 'transparent-support-too-distant' };
    }
  }
  return { silhouette: { color, opaquePixels, edgePixels }, reason: null };
}

/** Compatibility API for callers interested only in conservative eligibility. */
export function detectSilhouette(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): SilhouetteInfo | null {
  return analyzeSilhouette(pixels, width, height).silhouette;
}

export function createSilhouetteMask(pixels: Uint8Array | Uint8ClampedArray, opaqueBackground: boolean): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(pixels.length);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const foreground = pixels[offset + 3] >= 128;
    const color = foreground || !opaqueBackground ? 0 : 255;
    mask[offset] = mask[offset + 1] = mask[offset + 2] = color;
    mask[offset + 3] = foreground || opaqueBackground ? 255 : 0;
  }
  return mask;
}

/** Canonical hidden RGB prevents invisible source colors from consuming the palette. */
export function normalizeTransparentPixels(pixels: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
  const normalized = new Uint8ClampedArray(pixels);
  for (let offset = 0; offset < normalized.length; offset += 4) {
    if (normalized[offset + 3] === 0) normalized[offset] = normalized[offset + 1] = normalized[offset + 2] = 0;
  }
  return normalized;
}

const rgbaKey = (r: number, g: number, b: number, a: number) => r * 0x1000000 + g * 0x10000 + b * 0x100 + a;

/** Deterministic, bounded palette; retain every exact color when there are <=64. */
export function createTracePalette(pixels: Uint8Array | Uint8ClampedArray): TraceColor[] {
  const exact = new Map<number, TraceColor>();
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const a = pixels[offset + 3];
    const [r, g, b] = a === 0 ? [0, 0, 0] : [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    exact.set(rgbaKey(r, g, b, a), { r, g, b, a });
    if (exact.size > PNG_SVG_TRACE_LIMITS.maxPaletteColors) break;
  }
  if (exact.size <= PNG_SVG_TRACE_LIMITS.maxPaletteColors) return [...exact.values()];

  // 8×8×8 RGB bins and 16 alpha bands cap the histogram at 8,192 entries.
  const bins = new Map<number, { r: number; g: number; b: number; a: number; count: number }>();
  let hasTransparent = false;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const a = pixels[offset + 3];
    if (!a) { hasTransparent = true; continue; }
    const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
    const key = (r >>> 5) * 1024 + (g >>> 5) * 128 + (b >>> 5) * 16 + (a >>> 4);
    const bin = bins.get(key);
    if (bin) { bin.r += r; bin.g += g; bin.b += b; bin.a += a; bin.count++; }
    else bins.set(key, { r, g, b, a, count: 1 });
  }
  const candidates = [...bins.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0]).map(([, bin]) => ({
    color: { r: Math.round(bin.r / bin.count), g: Math.round(bin.g / bin.count), b: Math.round(bin.b / bin.count), a: Math.round(bin.a / bin.count) },
    distance: Infinity,
  }));
  const palette: TraceColor[] = hasTransparent ? [{ r: 0, g: 0, b: 0, a: 0 }] : [];
  // Farthest-first selection covers small contrasting features without randomness.
  let next = candidates.shift();
  while (next && palette.length < PNG_SVG_TRACE_LIMITS.maxPaletteColors) {
    palette.push(next.color);
    let best = -1;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const distance = Math.abs(c.color.r - next.color.r) + Math.abs(c.color.g - next.color.g) + Math.abs(c.color.b - next.color.b) + 2 * Math.abs(c.color.a - next.color.a);
      c.distance = Math.min(c.distance, distance);
      if (best < 0 || c.distance > candidates[best].distance) best = i;
    }
    next = best < 0 ? undefined : candidates.splice(best, 1)[0];
  }
  return palette;
}

export function imageTracerOptions(palette: TraceColor[], silhouette = false) {
  return {
    ltres: silhouette ? 0.5 : 0.35, qtres: silhouette ? 0.5 : 0.35,
    pathomit: 0, rightangleenhance: !silhouette,
    colorsampling: 0, numberofcolors: palette.length, mincolorratio: 0, colorquantcycles: 1,
    layering: 0, strokewidth: 0, linefilter: false, scale: 1, roundcoords: -1,
    viewbox: true, desc: false, lcpr: 0, qcpr: 0, blurradius: 0, blurdelta: 20,
    pal: palette.map(color => ({ ...color })),
  };
}

const COMMAND_PARAMETERS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const TOKEN = /[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/** Validate the complete path token stream and return its bounded segment count. */
export function validateSvgPath(data: string): number {
  if (!data || data.length > PNG_SVG_LIMITS.maxSvgBytes) throw new PngSvgError('The tracer returned an empty or oversized path.', 'invalid-svg');
  const tokens = data.match(TOKEN) ?? [];
  if (data.replace(TOKEN, '').replace(/[\s,]/g, '') || !/^[Mm]$/.test(tokens[0] ?? '')) {
    throw new PngSvgError('The tracer returned invalid SVG path data.', 'invalid-svg');
  }
  let position = 0;
  let commands = 0;
  while (position < tokens.length) {
    const command = tokens[position++].toUpperCase();
    const required = COMMAND_PARAMETERS[command];
    if (required === undefined) throw new PngSvgError('The tracer returned an unsupported path command.', 'invalid-svg');
    if (!required) {
      if (++commands > PNG_SVG_TRACE_LIMITS.maxPathCommands) throw new PngSvgError('The smooth SVG contains too many path segments.', 'trace-limit');
      continue;
    }
    const start = position;
    while (position < tokens.length && !/^[A-Za-z]$/.test(tokens[position])) {
      const value = Number(tokens[position]);
      if (!Number.isFinite(value) || Math.abs(value) > 32768) throw new PngSvgError('The tracer returned an invalid path coordinate.', 'invalid-svg');
      position++;
    }
    const count = position - start;
    if (!count || count % required !== 0) throw new PngSvgError('The tracer returned an incomplete path command.', 'invalid-svg');
    if (command === 'A') {
      for (let i = start; i < position; i += 7) {
        if (Number(tokens[i]) < 0 || Number(tokens[i + 1]) < 0 || !/^[01]$/.test(tokens[i + 3]) || !/^[01]$/.test(tokens[i + 4])) {
          throw new PngSvgError('The tracer returned an invalid elliptical arc.', 'invalid-svg');
        }
      }
    }
    commands += count / required;
    if (commands > PNG_SVG_TRACE_LIMITS.maxPathCommands) throw new PngSvgError('The smooth SVG contains too many path segments. Use Pixel vectors or Embedded PNG.', 'trace-limit');
  }
  return commands;
}

function validColor(value: string): boolean {
  if (value === 'none' || /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return true;
  const channels = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(value);
  return !!channels && channels.slice(1).every(channel => Number(channel) <= 255);
}

/**
 * Accept only numeric geometry and local fills, then serialize a small safe SVG.
 * This function runs in the browser; traced markup is never inserted into the UI DOM.
 */
export function normalizeTracedSvg(raw: string, width: number, height: number, foreground?: TraceColor): { svg: string; pathCount: number } {
  if (raw.length > PNG_SVG_LIMITS.maxSvgBytes) throw new PngSvgError('The smooth SVG exceeds the 24 MiB output limit.', 'svg-limit');
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new PngSvgError('The tracer returned unsupported document declarations.', 'invalid-svg');
  const document = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const root = document.documentElement;
  if (document.querySelector('parsererror') || root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') {
    throw new PngSvgError('The tracer returned malformed SVG.', 'invalid-svg');
  }
  const widthValue = root.getAttribute('width');
  const heightValue = root.getAttribute('height');
  const viewBox = root.getAttribute('viewBox');
  const dimension = (value: string | null, expected: number) => value === null || (/^\d+(?:\.0+)?(?:px)?$/.test(value) && Number(value.replace(/px$/, '')) === expected);
  if (!dimension(widthValue, width) || !dimension(heightValue, height) ||
      (viewBox !== null && viewBox.trim().split(/[\s,]+/).map(Number).join(' ') !== `0 0 ${width} ${height}`)) {
    throw new PngSvgError('The tracer changed the original dimensions.', 'invalid-svg');
  }
  const rootAllowed = new Set(['width', 'height', 'viewBox', 'xmlns', 'version', 'desc', 'color-interpolation']);
  for (const attribute of root.attributes) if (!rootAllowed.has(attribute.name)) throw new PngSvgError('The tracer returned an unsupported SVG root attribute.', 'invalid-svg');
  let pathCount = 0;
  let totalCommands = 0;
  const serialize = (node: Element, depth: number): string => {
    if (depth > 32) throw new PngSvgError('The tracer returned excessively nested geometry.', 'invalid-svg');
    if (node.namespaceURI !== root.namespaceURI || (node.localName !== 'path' && node.localName !== 'g')) {
      throw new PngSvgError('The tracer returned non-vector or unsupported SVG content.', 'invalid-svg');
    }
    const attributes: string[] = [];
    const allowed = new Set(['d', 'fill', 'fill-rule', 'opacity', 'fill-opacity', 'transform', 'stroke', 'stroke-width']);
    for (const attribute of node.attributes) {
      const { name, value } = attribute;
      if (!allowed.has(name) || (name === 'd' && node.localName !== 'path')) throw new PngSvgError('The tracer returned an unsafe SVG attribute.', 'invalid-svg');
      if (name === 'd') {
        totalCommands += validateSvgPath(value);
        attributes.push(`d="${value.replace(/\s+/g, ' ').trim()}"`);
      } else if (name === 'fill' || name === 'stroke') {
        if (!validColor(value)) throw new PngSvgError('The tracer returned an unsupported paint reference.', 'invalid-svg');
        if (name === 'fill' && !foreground) attributes.push(`fill="${value}"`);
      } else if (name === 'stroke-width') {
        if (Number(value) !== 0) throw new PngSvgError('The tracer returned an unexpected outline stroke.', 'invalid-svg');
      } else if (name === 'opacity' || name === 'fill-opacity') {
        if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value)) throw new PngSvgError('The tracer returned an invalid opacity.', 'invalid-svg');
        attributes.push(`${name}="${value}"`);
      } else if (name === 'fill-rule') {
        if (value !== 'evenodd' && value !== 'nonzero') throw new PngSvgError('The tracer returned an invalid fill rule.', 'invalid-svg');
        attributes.push(`fill-rule="${value}"`);
      } else if (name === 'transform') {
        const match = /^translate\(\s*([-+\d.eE]+)(?:[\s,]+([-+\d.eE]+))?\s*\)$/.exec(value);
        if (!match || !match.slice(1).filter(Boolean).every(number => Number.isFinite(Number(number)) && Math.abs(Number(number)) <= 32768)) {
          throw new PngSvgError('The tracer returned an unsupported transform.', 'invalid-svg');
        }
        attributes.push(`transform="translate(${Number(match[1])} ${Number(match[2] ?? 0)})"`);
      }
    }
    if (node.localName === 'path') {
      if (!node.hasAttribute('d') || node.children.length) throw new PngSvgError('The tracer returned an invalid path element.', 'invalid-svg');
      pathCount++;
      if (pathCount > PNG_SVG_TRACE_LIMITS.maxPaths || totalCommands > PNG_SVG_TRACE_LIMITS.maxPathCommands) {
        throw new PngSvgError('The smooth SVG is too complex. Use Pixel vectors or Embedded PNG.', 'trace-limit');
      }
      if (foreground) attributes.push(`fill="rgb(${foreground.r},${foreground.g},${foreground.b})"`);
      return `<path ${attributes.join(' ')}/>`;
    }
    return `<g ${attributes.join(' ')}>${children(node, depth + 1)}</g>`;
  };
  const children = (parent: Element, depth = 0): string => {
    const parts: string[] = [];
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) parts.push(serialize(child as Element, depth));
      else if (child.nodeType !== Node.COMMENT_NODE && (child.textContent ?? '').trim()) {
        throw new PngSvgError('The tracer returned unexpected SVG text.', 'invalid-svg');
      }
    }
    return parts.join('');
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" color-interpolation="sRGB">${children(root)}</svg>`;
  if (svg.length > PNG_SVG_LIMITS.maxSvgBytes) throw new PngSvgError('The smooth SVG exceeds the 24 MiB output limit.', 'svg-limit');
  return { svg, pathCount };
}
