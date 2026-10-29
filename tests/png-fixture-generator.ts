/** Procedural, synthetic fixtures shared by Node tests and the development browser harness. */
export interface PngFixture {
  name: string;
  category: 'opaque' | 'transparent' | 'partial-alpha' | 'antialiased' | 'palette' | 'multicolor' | 'alpha-sweep';
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  bytes: Uint8Array;
  colorType: 3 | 6;
  bitDepth: 2 | 8;
}

export const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export function concatenateBytes(parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function pngChunk(type: string, data = new Uint8Array()): Uint8Array {
  if (!/^[A-Za-z]{4}$/.test(type)) throw new Error('PNG chunk type must be four ASCII letters.');
  const output = new Uint8Array(data.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(Array.from(type, character => character.charCodeAt(0)), 4);
  output.set(data, 8);
  view.setUint32(data.length + 8, crc32(output.subarray(4, data.length + 8)));
  return output;
}

/** Standard zlib wrapper containing DEFLATE stored blocks; no Node/runtime dependency. */
export function storedZlib(bytes: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < bytes.length || offset === 0; offset += 65535) {
    const length = Math.min(65535, bytes.length - offset);
    const block = new Uint8Array(length + 5);
    const view = new DataView(block.buffer);
    block[0] = offset + length >= bytes.length ? 1 : 0;
    view.setUint16(1, length, true);
    view.setUint16(3, (~length) & 0xffff, true);
    block.set(bytes.subarray(offset, offset + length), 5);
    blocks.push(block);
  }
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const checksum = new Uint8Array(4);
  new DataView(checksum.buffer).setUint32(0, ((b << 16) | a) >>> 0);
  blocks.push(checksum);
  return concatenateBytes(blocks);
}

export function pngHeader(width: number, height: number, colorType = 6, bitDepth = 8): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = bitDepth;
  header[9] = colorType;
  return pngChunk('IHDR', header);
}

export function encodeRgbaPng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) {
    throw new Error('Fixture dimensions must match its RGBA bytes.');
  }
  const stride = width * 4;
  const scanlines = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) scanlines.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return concatenateBytes([PNG_SIGNATURE, pngHeader(width, height), pngChunk('IDAT', storedZlib(scanlines)), pngChunk('IEND')]);
}

export function encodeIndexedPng(
  indices: Uint8Array,
  width: number,
  height: number,
  palette: readonly (readonly [number, number, number, number])[],
): Uint8Array {
  if (palette.length < 1 || palette.length > 4 || indices.length !== width * height || indices.some(index => index >= palette.length)) {
    throw new Error('The two-bit indexed fixture needs 1–4 colors and a valid index per pixel.');
  }
  const rowBytes = Math.ceil(width / 4);
  const scanlines = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) scanlines[y * (rowBytes + 1) + 1 + Math.floor(x / 4)] |= indices[y * width + x] << (6 - (x % 4) * 2);
  }
  return concatenateBytes([
    PNG_SIGNATURE,
    pngHeader(width, height, 3, 2),
    pngChunk('PLTE', new Uint8Array(palette.flatMap(color => color.slice(0, 3)))),
    pngChunk('tRNS', new Uint8Array(palette.map(color => color[3]))),
    pngChunk('IDAT', storedZlib(scanlines)),
    pngChunk('IEND'),
  ]);
}

function rgbaFixture(
  category: Exclude<PngFixture['category'], 'palette'>,
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): PngFixture {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rgba.set(pixel(x, y), (y * width + x) * 4);
  }
  return { name: `fixture-${category}.png`, category, width, height, rgba, bytes: encodeRgbaPng(rgba, width, height), colorType: 6, bitDepth: 8 };
}

/** Six required PNG classes and an additional exhaustive eight-bit alpha sweep. */
export function createPngFixtures(): PngFixture[] {
  const opaque = rgbaFixture('opaque', 16, 12, (x, y) => {
    if (x < 2 || y < 2 || x >= 14 || y >= 10) return [255, 255, 255, 255];
    return x < 8 ? [31, 94, 204, 255] : [185, 76, 45, 255];
  });
  // Nonzero RGB under alpha zero checks that invisible channels do not create a false mismatch.
  const transparent = rgbaFixture('transparent', 7, 5, (x, y) => [(x * 37 + 13) % 256, (y * 47 + 21) % 256, 199, 0]);
  const alphas = [0, 1, 2, 17, 64, 127, 128, 191, 254, 255];
  const partial = rgbaFixture('partial-alpha', 10, 6, (x, y) => [43 + y * 29, 151 - y * 17, 219 - y * 23, alphas[x]]);
  const antialiased = rgbaFixture('antialiased', 15, 13, (x, y) => {
    // Analytic supersampling produces a genuine antialiased silhouette without canvas dependence.
    let inside = 0;
    const samples = 8;
    for (let sy = 0; sy < samples; sy++) {
      for (let sx = 0; sx < samples; sx++) {
        const dx = x + (sx + 0.5) / samples - 7.1;
        const dy = y + (sy + 0.5) / samples - 6.3;
        if (dx * dx + dy * dy <= 4.65 * 4.65) inside++;
      }
    }
    return [230, 95, 55, Math.round(inside * 255 / (samples * samples))];
  });
  const palette = [[19, 43, 241, 0], [34, 193, 122, 85], [213, 41, 77, 173], [249, 204, 41, 255]] as const;
  const paletteWidth = 11;
  const paletteHeight = 7;
  const indices = new Uint8Array(paletteWidth * paletteHeight);
  const paletteRgba = new Uint8ClampedArray(indices.length * 4);
  for (let y = 0; y < paletteHeight; y++) {
    for (let x = 0; x < paletteWidth; x++) {
      const offset = y * paletteWidth + x;
      indices[offset] = (Math.floor(x / 2) + y) % palette.length;
      paletteRgba.set(palette[indices[offset]], offset * 4);
    }
  }
  const indexed: PngFixture = {
    name: 'fixture-palette.png', category: 'palette', width: paletteWidth, height: paletteHeight,
    rgba: paletteRgba, bytes: encodeIndexedPng(indices, paletteWidth, paletteHeight, palette), colorType: 3, bitDepth: 2,
  };
  const multicolor = rgbaFixture('multicolor', 19, 11, (x, y) => [(x * 47 + y * 17) % 256, (x * 13 + y * 61) % 256, (x * 83 + y * 7) % 256, 255]);
  const sweepColors = [[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [127, 128, 129], [1, 2, 3], [37, 149, 213], [185, 76, 45], [254, 253, 252]] as const;
  const alphaSweep = rgbaFixture('alpha-sweep', 256, sweepColors.length, (x, y) => [...sweepColors[y], x] as const);
  return [opaque, transparent, partial, antialiased, indexed, multicolor, alphaSweep];
}

export interface CurveReferenceFixture {
  name: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  bytes: Uint8Array;
  referenceScale: number;
  reference: Uint8ClampedArray;
}

function silhouetteContains(x: number, y: number): boolean {
  const outer = ((x - 42.25) / 28.3) ** 2 + ((y - 44.1) / 31.2) ** 2 <= 1;
  const hole = ((x - 41.7) / 13.4) ** 2 + ((y - 43.65) / 16.1) ** 2 < 1;
  const island = (x - 13.25) ** 2 + (y - 12.75) ** 2 <= 2.3 ** 2;
  const dx = 82.5 - 63, dy = 80 - 63;
  const t = Math.max(0, Math.min(1, ((x - 63) * dx + (y - 63) * dy) / (dx * dx + dy * dy)));
  const thinStroke = (x - 63 - t * dx) ** 2 + (y - 63 - t * dy) ** 2 <= 1.55 ** 2;
  return (outer && !hole) || island || thinStroke;
}

function sampleKnownSilhouette(scale: number, samples: number): Uint8ClampedArray {
  const width = 96 * scale;
  const height = 96 * scale;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (silhouetteContains((x + (sx + 0.5) / samples) / scale, (y + (sy + 0.5) / samples) / scale)) covered++;
        }
      }
      pixels[(y * width + x) * 4 + 3] = Math.round(covered * 255 / (samples * samples));
    }
  }
  return pixels;
}

/** A known continuous shape, independently sampled at native and 4× resolutions. */
export function createCurveReferenceFixture(): CurveReferenceFixture {
  const rgba = sampleKnownSilhouette(1, 8);
  return {
    name: 'synthetic-silhouette-96.png', width: 96, height: 96, rgba,
    bytes: encodeRgbaPng(rgba, 96, 96), referenceScale: 4,
    // This is sampled from analytic geometry, never a resized source PNG.
    reference: sampleKnownSilhouette(4, 4),
  };
}

/** Independent line art: two rings, an angled stroke and a separate small island. */
function resampledLineContains(x: number, y: number): boolean {
  const ringA = (x - 28.4) ** 2 + (y - 29.2) ** 2;
  const ringB = (x - 68.25) ** 2 + (y - 26.75) ** 2;
  const inStroke = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= 2.1 ** 2;
  };
  return (ringA <= 18 ** 2 && ringA >= 13.5 ** 2) ||
    (ringB <= 12 ** 2 && ringB >= 8 ** 2) ||
    inStroke(16.2, 75.6, 48.3, 58.4) || inStroke(48.3, 58.4, 78.1, 80.2) ||
    (x - 86.1) ** 2 + (y - 55.2) ** 2 <= 2.4 ** 2;
}

function sampleLineReference(): Uint8ClampedArray {
  const scale = 4, samples = 4, width = 96 * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    let covered = 0;
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      if (resampledLineContains((x + (sx + 0.5) / samples) / scale, (y + (sy + 0.5) / samples) / scale)) covered++;
    }
    pixels[(y * width + x) * 4 + 3] = Math.round(covered * 255 / (samples * samples));
  }
  return pixels;
}

/**
 * Fixed resampling recipe, separate from the independent 4× reference above.
 * An 8× point-sampled source passes through a separable tent of radius 1.25
 * native pixels, creating a wider antialias fringe without changing geometry.
 * No canvas, tracing output or user-provided artwork enters either sampler.
 */
export function createResampledLineIconFixture(): CurveReferenceFixture {
  const width = 96, scale = 8, sourceWidth = width * scale, radius = 1.25;
  const source = new Uint8Array(sourceWidth * sourceWidth);
  for (let y = 0; y < sourceWidth; y++) for (let x = 0; x < sourceWidth; x++) {
    source[y * sourceWidth + x] = Number(resampledLineContains((x + 0.5) / scale, (y + 0.5) / scale));
  }
  const taps = Array.from({length: width}, (_, target) => {
    const center = target + 0.5;
    const weights: {index: number; weight: number}[] = [];
    let total = 0;
    for (let index = Math.floor((center - radius) * scale); index <= Math.ceil((center + radius) * scale); index++) {
      const weight = Math.max(0, 1 - Math.abs((index + 0.5) / scale - center) / radius);
      if (weight) {weights.push({index, weight}); total += weight;}
    }
    return weights.map(tap => ({index: tap.index, weight: tap.weight / total}));
  });
  const horizontal = new Float64Array(sourceWidth * width);
  for (let y = 0; y < sourceWidth; y++) for (let x = 0; x < width; x++) {
    for (const tap of taps[x]) if (tap.index >= 0 && tap.index < sourceWidth) {
      horizontal[y * width + x] += source[y * sourceWidth + tap.index] * tap.weight;
    }
  }
  const rgba = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    let alpha = 0;
    for (const tap of taps[y]) if (tap.index >= 0 && tap.index < sourceWidth) alpha += horizontal[tap.index * width + x] * tap.weight;
    rgba[(y * width + x) * 4 + 3] = Math.round(alpha * 255);
  }
  return {
    name: 'synthetic-resampled-line-icon-96.png', width, height: width, rgba,
    bytes: encodeRgbaPng(rgba, width, width), referenceScale: 4,
    reference: sampleLineReference(),
  };
}

export function meanAbsoluteAlphaError(actual: Uint8Array | Uint8ClampedArray, expected: Uint8Array | Uint8ClampedArray): number {
  if (actual.length !== expected.length || actual.length % 4 !== 0) throw new Error('Comparison dimensions differ.');
  let error = 0;
  for (let offset = 3; offset < actual.length; offset += 4) error += Math.abs(actual[offset] - expected[offset]);
  return error / (actual.length / 4);
}

/** Eight-connected foreground / four-connected background avoid diagonal ambiguity. */
export function alphaTopology(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number): { components: number; holes: number } {
  if (pixels.length !== width * height * 4) throw new Error('Topology dimensions differ.');
  const seen = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let components = 0;
  let holes = 0;
  for (let origin = 0; origin < seen.length; origin++) {
    if (seen[origin]) continue;
    const visible = pixels[origin * 4 + 3] >= 128;
    let head = 0, tail = 1;
    let touchesBorder = false;
    queue[0] = origin;
    seen[origin] = 1;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width, y = Math.floor(pixel / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!visible && dx !== 0 && dy !== 0)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (!seen[neighbor] && (pixels[neighbor * 4 + 3] >= 128) === visible) {
            seen[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    if (visible) components++;
    else if (!touchesBorder) holes++;
  }
  return { components, holes };
}
