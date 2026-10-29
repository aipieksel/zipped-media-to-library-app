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
