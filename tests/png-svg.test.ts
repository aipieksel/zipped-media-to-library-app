import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import JSZip from 'jszip';
import {
  PNG_SVG_LIMITS, PngSvgError, allocateSvgFilename, compareVisiblePixels,
  createEmbeddedPngSvg, createPixelSvg, inspectPng, mergePixelRectangles,
} from '../src/png-svg';
import type { PixelRectangle } from '../src/png-svg';
import { buildSvgZip } from '../src/png-svg-download';
import {
  PNG_SIGNATURE, concatenateBytes, crc32, createPngFixtures,
  encodeRgbaPng, pngChunk, pngHeader, storedZlib,
} from './png-fixture-generator';
import type { PngFixture } from './png-fixture-generator';

const fixtures = createPngFixtures();

function chunks(bytes: Uint8Array): { type: string; data: Uint8Array }[] {
  assert.deepEqual(bytes.slice(0, 8), PNG_SIGNATURE);
  const output: { type: string; data: Uint8Array }[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    assert.ok(offset + length + 12 <= bytes.length, 'Fixture chunk stays inside PNG bytes');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    assert.equal(crc32(bytes.subarray(offset + 4, offset + length + 8)), view.getUint32(offset + length + 8), `${type} CRC`);
    output.push({ type, data });
    offset += length + 12;
  }
  assert.equal(offset, bytes.length);
  assert.equal(output.at(-1)?.type, 'IEND');
  return output;
}

/** An independent Node/zlib readback establishes that the generator writes actual fixture pixels. */
function decodeFixture(fixture: PngFixture): Uint8ClampedArray {
  const parts = chunks(fixture.bytes);
  const header = parts[0].data;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint32(0), height = view.getUint32(4);
  assert.equal(width, fixture.width);
  assert.equal(height, fixture.height);
  assert.equal(header[8], fixture.bitDepth);
  assert.equal(header[9], fixture.colorType);
  const compressed = Buffer.concat(parts.filter(part => part.type === 'IDAT').map(part => Buffer.from(part.data)));
  const raw = inflateSync(compressed);
  const stride = fixture.colorType === 6 ? width * 4 : Math.ceil(width * fixture.bitDepth / 8);
  assert.equal(raw.length, (stride + 1) * height);
  const output = new Uint8ClampedArray(width * height * 4);
  const palette = parts.find(part => part.type === 'PLTE')?.data;
  const transparency = parts.find(part => part.type === 'tRNS')?.data;
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (stride + 1)], 0, 'Procedural fixtures use PNG filter zero');
    for (let x = 0; x < width; x++) {
      const destination = (y * width + x) * 4;
      const row = y * (stride + 1) + 1;
      if (fixture.colorType === 6) output.set(raw.subarray(row + x * 4, row + x * 4 + 4), destination);
      else {
        assert.ok(palette && transparency, 'Indexed fixture has actual PLTE and tRNS chunks');
        const index = (raw[row + Math.floor(x / 4)] >>> (6 - (x % 4) * 2)) & 3;
        output.set([palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2], transparency[index] ?? 255], destination);
      }
    }
  }
  return output;
}

/** No SVG logic is reused here: paint each half-open integer rectangle and count coverage. */
function reconstruct(rectangles: readonly PixelRectangle[], width: number, height: number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const coverage = new Uint8Array(width * height);
  for (const rectangle of rectangles) {
    const { x, y, width: span, height: rows, r, g, b, a } = rectangle;
    for (const value of [x, y, span, rows, r, g, b, a]) assert.ok(Number.isInteger(value));
    assert.ok(x >= 0 && y >= 0 && span > 0 && rows > 0 && x + span <= width && y + rows <= height);
    assert.ok(a > 0 && a <= 255, 'Invisible pixels must not produce geometry');
    for (const color of [r, g, b]) assert.ok(color >= 0 && color <= 255);
    for (let py = y; py < y + rows; py++) {
      for (let px = x; px < x + span; px++) {
        const pixel = py * width + px;
        assert.equal(coverage[pixel], 0, `Overlapping SVG geometry at (${px}, ${py})`);
        coverage[pixel]++;
        rgba.set([r, g, b, a], pixel * 4);
      }
    }
  }
  return { rgba, coverage };
}

function assertReconstruction(source: Uint8Array | Uint8ClampedArray, width: number, height: number) {
  const rectangles = mergePixelRectangles(source, width, height);
  const { rgba, coverage } = reconstruct(rectangles, width, height);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const offset = pixel * 4;
    assert.equal(coverage[pixel], source[offset + 3] === 0 ? 0 : 1);
    assert.equal(rgba[offset + 3], source[offset + 3]);
    if (source[offset + 3] > 0) assert.deepEqual(rgba.slice(offset, offset + 4), new Uint8ClampedArray(source.slice(offset, offset + 4)));
  }
  return rectangles;
}

function errorCode(code: PngSvgError['code']) {
  return (error: unknown) => error instanceof PngSvgError && error.code === code;
}

function pngWithHeader(width: number, height: number, colorType = 6, bitDepth = 8): Uint8Array {
  return concatenateBytes([PNG_SIGNATURE, pngHeader(width, height, colorType, bitDepth), pngChunk('IDAT', storedZlib(new Uint8Array([0, 0, 0, 0, 255]))), pngChunk('IEND')]);
}

test('procedural PNG fixtures contain the six required formats and a real alpha sweep', () => {
  assert.deepEqual(fixtures.map(fixture => fixture.category), ['opaque', 'transparent', 'partial-alpha', 'antialiased', 'palette', 'multicolor', 'alpha-sweep']);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'CRC32 has an independent standard check value');
  assert.equal(new DataView(pngChunk('IEND').buffer).getUint32(8), 0xae426082, 'Known IEND CRC');
  for (const fixture of fixtures) assert.deepEqual(decodeFixture(fixture), fixture.rgba, fixture.name);
  const aa = fixtures.find(fixture => fixture.category === 'antialiased')!;
  const aaAlphas = new Set(Array.from(aa.rgba).filter((_, index) => index % 4 === 3));
  assert.ok(aaAlphas.has(0) && aaAlphas.has(255) && aaAlphas.size > 12, 'AA silhouette has a range of fractional edge coverages');
  const sweep = fixtures.find(fixture => fixture.category === 'alpha-sweep')!;
  assert.equal(new Set(Array.from(sweep.rgba).filter((_, index) => index % 4 === 3)).size, 256);
});

test('stored DEFLATE fixtures work across multiple blocks and reject invalid RGBA dimensions', () => {
  const bytes = Uint8Array.from({ length: 131077 }, (_, index) => (index * 17) & 255);
  assert.deepEqual(new Uint8Array(inflateSync(storedZlib(bytes))), bytes);
  assert.deepEqual(new Uint8Array(inflateSync(storedZlib(new Uint8Array()))), new Uint8Array());
  assert.throws(() => encodeRgbaPng(new Uint8Array(3), 1, 1), /dimensions/);
});

test('PNG metadata accepts real RGBA and packed indexed PNGs without changing native dimensions', () => {
  for (const fixture of fixtures) {
    const metadata = inspectPng(fixture.bytes);
    assert.equal(metadata.width, fixture.width);
    assert.equal(metadata.height, fixture.height);
    assert.equal(metadata.colorType, fixture.colorType);
    assert.equal(metadata.bitDepth, fixture.bitDepth);
    assert.equal(metadata.interlaced, false);
    assert.equal(metadata.hasColorProfile, false);
  }
});

test('rectangle merging reconstructs every visible pixel with no overlaps in all procedural fixtures', () => {
  for (const fixture of fixtures) assertReconstruction(fixture.rgba, fixture.width, fixture.height);
});

test('solid fills collapse to one rectangle and alpha-zero pixels produce none', () => {
  const solid = new Uint8ClampedArray(12 * 5 * 4);
  for (let offset = 0; offset < solid.length; offset += 4) solid.set([19, 43, 201, 127], offset);
  assert.deepEqual(mergePixelRectangles(solid, 12, 5), [{ x: 0, y: 0, width: 12, height: 5, r: 19, g: 43, b: 201, a: 127 }]);
  const transparent = fixtures.find(fixture => fixture.category === 'transparent')!;
  assert.deepEqual(mergePixelRectangles(transparent.rgba, transparent.width, transparent.height), []);
});

test('equal horizontal spans extend across rows without combining different opacity or covering gaps', () => {
  const width = 6, height = 4;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = x < 2 ? [200, 30, 80, 255] : x > 2 ? [20, 80, 200, 127] : [20, 80, 200, y < 2 ? 0 : 128];
      rgba.set(color, (y * width + x) * 4);
    }
  }
  const rectangles = assertReconstruction(rgba, width, height);
  assert.equal(rectangles.length, 3);
  assert.ok(rectangles.some(rectangle => rectangle.x === 0 && rectangle.y === 0 && rectangle.width === 2 && rectangle.height === 4));
  assert.ok(rectangles.some(rectangle => rectangle.x === 3 && rectangle.width === 3 && rectangle.height === 4 && rectangle.a === 127));
  assert.ok(rectangles.some(rectangle => rectangle.x === 2 && rectangle.y === 2 && rectangle.width === 1 && rectangle.height === 2 && rectangle.a === 128));
});

test('ragged row endings and deterministic random RGBA inputs preserve exact coverage', () => {
  let state = 0x47c0ffee;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state >>> 24; };
  for (const [width, height] of [[1, 1], [1, 17], [31, 1], [17, 23]]) {
    const source = new Uint8Array(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) source.set([next(), next(), next(), pixel % 5 === 0 ? 0 : next()], pixel * 4);
    assertReconstruction(source, width, height);
  }
});

test('pixel SVG is real editable geometry with native dimensions and unrounded opacity', () => {
  const source = new Uint8Array([37, 149, 213, 127]);
  const result = createPixelSvg(source, 1, 1);
  assert.equal(result.rectangleCount, 1);
  assert.equal(result.outputBytes, new TextEncoder().encode(result.svg).length);
  assert.match(result.svg, /<svg\b/);
  assert.match(result.svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(result.svg, /width="1"/);
  assert.match(result.svg, /height="1"/);
  assert.match(result.svg, /viewBox="0 0 1 1"/);
  assert.match(result.svg, /<rect\b/);
  assert.doesNotMatch(result.svg, /<image\b|data:image\/png|<script\b|<foreignObject\b/i);
  const opacity = result.svg.match(/fill-opacity="([^"]+)"/);
  assert.ok(opacity, 'The partial-alpha fill exposes editable opacity');
  assert.equal(Number(opacity[1]), 127 / 255, 'Serialize the full alpha ratio without decimal truncation');
});

test('pixel SVG preserves a fully transparent canvas and enforces practical output budgets', () => {
  const fixture = fixtures.find(item => item.category === 'transparent')!;
  const result = createPixelSvg(fixture.rgba, fixture.width, fixture.height);
  assert.equal(result.rectangleCount, 0);
  assert.match(result.svg, /viewBox="0 0 7 5"/);
  assert.doesNotMatch(result.svg, /<rect\b|<image\b/);
  const fourColors = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
  assert.throws(() => createPixelSvg(fourColors, 2, 2, { maxRectangles: 2 }), errorCode('vector-limit'));
  assert.throws(() => createPixelSvg(fourColors, 2, 2, { maxSvgBytes: 20 }), errorCode('svg-limit'));
});

test('invalid raw RGBA dimensions fail before geometry generation', () => {
  assert.throws(() => mergePixelRectangles(new Uint8Array(4), 0, 1));
  assert.throws(() => mergePixelRectangles(new Uint8Array(4), -1, 1));
  assert.throws(() => mergePixelRectangles(new Uint8Array(4), 1.5, 1));
  assert.throws(() => mergePixelRectangles(new Uint8Array(4), 2, 1));
  assert.throws(() => mergePixelRectangles(new Uint8Array(4), 1, Number.POSITIVE_INFINITY));
});

test('visible pixel comparison ignores only RGB hidden under zero alpha', () => {
  assert.deepEqual(compareVisiblePixels(new Uint8Array([10, 20, 30, 0]), new Uint8Array([240, 220, 200, 0])), { differingPixels: 0, totalPixels: 1 });
  for (const changed of [[11, 20, 30, 1], [10, 21, 30, 1], [10, 20, 31, 1], [10, 20, 30, 2], [10, 20, 30, 0]]) {
    assert.equal(compareVisiblePixels(new Uint8Array([10, 20, 30, 1]), new Uint8Array(changed)).differingPixels, 1);
  }
  assert.equal(compareVisiblePixels(new Uint8Array([0, 0, 0, 0]), new Uint8Array([0, 0, 0, 1])).differingPixels, 1);
  assert.equal(compareVisiblePixels(new Uint8Array([0, 0, 0, 1]), new Uint8Array([0, 0, 0, 0])).differingPixels, 1);
});

test('comparison counts pixels rather than channels with no tolerance and rejects mismatched buffers', () => {
  const source = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 128, 7, 8, 9, 0]);
  const changed = source.slice();
  changed.set([8, 7, 6, 127], 4);
  changed.set([100, 150, 200], 8);
  assert.deepEqual(compareVisiblePixels(source, changed), { differingPixels: 1, totalPixels: 3 });
  assert.throws(() => compareVisiblePixels(source, changed.slice(0, 8)));
  assert.throws(() => compareVisiblePixels(new Uint8Array(3), new Uint8Array(3)));
});

test('embedded SVG retains the exact original PNG file bytes, including indexed alpha data', () => {
  for (const fixture of fixtures) {
    const svg = createEmbeddedPngSvg(fixture.bytes, fixture.width, fixture.height);
    assert.match(svg, /<image\b/);
    assert.match(svg, new RegExp(`viewBox="0 0 ${fixture.width} ${fixture.height}"`));
    const embedded = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    assert.ok(embedded, 'Embedded mode contains PNG data');
    assert.deepEqual(new Uint8Array(Buffer.from(embedded[1], 'base64')), fixture.bytes);
    assert.doesNotMatch(svg, /<rect\b|<script\b|<foreignObject\b/i);
  }
});

test('PNG inspection rejects wrong signatures, incomplete chunks, missing image data and truncated endings', () => {
  const valid = fixtures[0].bytes;
  for (const bytes of [new Uint8Array(), valid.slice(0, 7), valid.slice(0, 20), valid.slice(0, -1), valid.slice(0, -12)]) {
    assert.throws(() => inspectPng(bytes), errorCode('invalid-png'));
  }
  const badSignature = valid.slice(); badSignature[0] = 0;
  assert.throws(() => inspectPng(badSignature), errorCode('invalid-png'));
  const impossibleChunk = valid.slice(); new DataView(impossibleChunk.buffer).setUint32(8, 0x7fffffff);
  assert.throws(() => inspectPng(impossibleChunk), errorCode('invalid-png'));
  assert.throws(() => inspectPng(concatenateBytes([PNG_SIGNATURE, pngHeader(1, 1), pngChunk('IEND')])), errorCode('invalid-png'));
});

test('PNG inspection rejects animation, impossible pixel layouts and limits before decode allocation', () => {
  const animation = new Uint8Array(8); new DataView(animation.buffer).setUint32(0, 2);
  const sample = chunks(fixtures[0].bytes);
  const animated = concatenateBytes([PNG_SIGNATURE, pngChunk('IHDR', sample[0].data), pngChunk('acTL', animation), ...sample.slice(1).map(part => pngChunk(part.type, part.data))]);
  assert.throws(() => inspectPng(animated), errorCode('animated-png'));
  assert.throws(() => inspectPng(pngWithHeader(0, 1)), errorCode('invalid-png'));
  assert.throws(() => inspectPng(pngWithHeader(1, 1, 6, 2)), errorCode('invalid-png'));
  assert.throws(() => inspectPng(pngWithHeader(PNG_SVG_LIMITS.maxSide + 1, 1)), errorCode('image-limit'));
  assert.throws(() => inspectPng(pngWithHeader(PNG_SVG_LIMITS.maxSide, PNG_SVG_LIMITS.maxSide)), errorCode('image-limit'));
  const tooManyBytes = new Uint8Array(PNG_SVG_LIMITS.maxInputBytes + 1); tooManyBytes.set(fixtures[0].bytes);
  assert.throws(() => inspectPng(tooManyBytes), errorCode('image-limit'));
});

test('filename allocation preserves normal and Unicode names while resolving case, NFC and suffix collisions', () => {
  const used = new Set<string>();
  const first = allocateSvgFilename('my icon.PNG', used);
  assert.equal(first, 'my icon.svg');
  assert.equal(allocateSvgFilename('über-雪.png', used), 'über-雪.svg');
  const sources = ['icon.png', 'ICON.PNG', 'icon (2).png', 'icon.png', 'café.png', 'cafe\u0301.PNG'];
  const names = sources.map(source => allocateSvgFilename(source, used));
  assert.equal(new Set(names.map(name => name.normalize('NFC').toLowerCase())).size, sources.length);
  assert.equal(names[0], 'icon.svg');
  assert.equal(names[4], 'café.svg');
  const preexisting = new Set(['Already.svg', 'already (2).SVG']);
  assert.ok(!['already.svg', 'already (2).svg'].includes(allocateSvgFilename('ALREADY.png', preexisting).toLowerCase()));
});

test('untrusted source names become safe flat SVG names without reserved device basenames', () => {
  const names = ['../icon.png', 'C:\\path\\icon.png', 'folder/icon.png', 'bad\u0000\nname.png', '<script>.png', 'CON.png', 'aux.PNG', 'LPT9.png', 'COM1.png', '..', '', 'trailing. .png'];
  const used = new Set<string>();
  for (const source of names) {
    const name = allocateSvgFilename(source, used);
    assert.ok(name.length > 4 && name.endsWith('.svg'), name);
    assert.doesNotMatch(name, /[<>:"/\\|?*\u0000-\u001f\u007f]/);
    assert.doesNotMatch(name.replace(/\.svg$/i, ''), /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i);
    assert.ok(!/[. ]$/.test(name));
  }
});

test('ZIP downloads retain every collision-resolved filename and exact SVG bytes', async () => {
  const used = new Set<string>();
  const sources = ['icon.png', 'ICON.PNG', 'icon (2).png', 'café.png', 'cafe\u0301.png'];
  const entries = sources.map((source, index) => ({ filename: allocateSvgFilename(source, used), svg: createPixelSvg(fixtures[index].rgba, fixtures[index].width, fixtures[index].height).svg }));
  const blob = await buildSvgZip(entries);
  const archive = await JSZip.loadAsync(await blob.arrayBuffer());
  const names = Object.keys(archive.files);
  assert.equal(names.length, entries.length);
  assert.deepEqual(new Set(names), new Set(entries.map(entry => entry.filename)));
  for (const entry of entries) {
    assert.equal(archive.files[entry.filename].dir, false);
    assert.deepEqual(await archive.files[entry.filename].async('uint8array'), new TextEncoder().encode(entry.svg));
  }
});

test('ZIP preparation rejects empty batches, unsafe paths and duplicate output names', async () => {
  const svg = createPixelSvg(new Uint8Array([1, 2, 3, 255]), 1, 1).svg;
  await assert.rejects(buildSvgZip([]));
  await assert.rejects(buildSvgZip([{ filename: '../escape.svg', svg }]));
  await assert.rejects(buildSvgZip([{ filename: 'a/b.svg', svg }]));
  await assert.rejects(buildSvgZip([{ filename: 'icon.svg', svg }, { filename: 'ICON.SVG', svg }]));
});
