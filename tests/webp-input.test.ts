import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbeddedRasterSvg, inspectRaster, inspectWebp, rasterMimeHint } from '../src/raster-input';
import { allocateSvgFilename, createEmbeddedPngSvg, PNG_SVG_LIMITS, PngSvgError } from '../src/png-svg';
import { createPngFixtures } from './png-fixture-generator';

// Independent header fixtures follow Google's RIFF and lossless bitstream specs:
// https://developers.google.com/speed/webp/docs/riff_container
// https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification
// These synthetic headers establish container behavior, not entropy decodability.
const ascii = (value: string) => Uint8Array.from(value, character => character.charCodeAt(0));
function join(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}
function chunk(kind: string, data: Uint8Array): Uint8Array {
  return join(ascii(kind), uint32(data.length), data, new Uint8Array(data.length & 1));
}
function riff(...chunks: Uint8Array[]): Uint8Array {
  const body = join(ascii('WEBP'), ...chunks);
  return join(ascii('RIFF'), uint32(body.length), body);
}
function vp8(width: number, height: number): Uint8Array {
  const data = Uint8Array.from([0x10, 0, 0, 0x9d, 1, 0x2a, 0, 0, 0, 0]);
  const view = new DataView(data.buffer);
  view.setUint16(6, width, true); view.setUint16(8, height, true);
  return chunk('VP8 ', data);
}
function vp8l(width: number, height: number, alpha = false): Uint8Array {
  return chunk('VP8L', join(Uint8Array.of(0x2f), uint32((width - 1) | ((height - 1) << 14) | (alpha ? 1 << 28 : 0))));
}
function vp8x(width: number, height: number, flags = 0): Uint8Array {
  const data = new Uint8Array(10);
  data[0] = flags;
  for (let index = 0; index < 3; index++) {
    data[4 + index] = ((width - 1) >>> (index * 8)) & 255;
    data[7 + index] = ((height - 1) >>> (index * 8)) & 255;
  }
  return chunk('VP8X', data);
}
function rejectsCode(operation: () => unknown, code: string): void {
  assert.throws(operation, error => error instanceof PngSvgError && error.code === code);
}
function replaceRiffLength(bytes: Uint8Array): Uint8Array {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(4, bytes.length - 8, true);
  return bytes;
}

test('simple VP8 reads native nonsquare little-endian dimensions', () => {
  assert.deepEqual(inspectWebp(riff(vp8(241, 17))), {
    format: 'webp', mime: 'image/webp', width: 241, height: 17,
    lossless: false, hasAlpha: false, hasColorProfile: false, hasExif: false,
  });
});

test('VP8L reads packed dimensions and alpha without requiring VP8X', () => {
  const metadata = inspectWebp(riff(vp8l(513, 129, true)));
  assert.equal(metadata.width, 513); assert.equal(metadata.height, 129);
  assert.equal(metadata.lossless, true); assert.equal(metadata.hasAlpha, true);
});

test('extended still VP8 accepts alpha, color profile and EXIF in their structural order', () => {
  const metadata = inspectWebp(riff(vp8x(32, 24, 0x38), chunk('ICCP', Uint8Array.of(1, 2, 3)),
    chunk('ALPH', Uint8Array.of(0)), vp8(32, 24), chunk('EXIF', Uint8Array.of(5, 6))));
  assert.equal(metadata.hasAlpha, true); assert.equal(metadata.hasColorProfile, true); assert.equal(metadata.hasExif, true);
  assert.equal(metadata.lossless, false);
});

test('extended VP8L matches its canvas and retains lossless alpha metadata', () => {
  const metadata = inspectWebp(riff(vp8x(19, 11, 0x10), vp8l(19, 11, true)));
  assert.equal(metadata.width, 19); assert.equal(metadata.height, 11);
  assert.equal(metadata.lossless, true); assert.equal(metadata.hasAlpha, true);
});

test('bounded unknown metadata and zero odd-byte padding are accepted', () => {
  assert.equal(inspectWebp(riff(vp8x(7, 9), vp8l(7, 9), chunk('JUNK', Uint8Array.of(9, 8, 7)))).width, 7);
});

test('nonzero or absent odd-byte padding is rejected', () => {
  const nonzero = riff(vp8l(7, 9)); nonzero[nonzero.length - 1] = 4;
  rejectsCode(() => inspectWebp(nonzero), 'invalid-webp');
  rejectsCode(() => inspectWebp(replaceRiffLength(nonzero.slice(0, -1))), 'invalid-webp');
});

test('RIFF signature, declared size, trailing data and truncated file fail structurally', () => {
  const valid = riff(vp8(5, 7));
  const badSignature = valid.slice(); badSignature[0] = 0;
  const badSize = valid.slice(); new DataView(badSize.buffer).setUint32(4, valid.length + 100, true);
  for (const bytes of [badSignature, badSize, join(valid, new Uint8Array(2)), valid.slice(0, -2), new Uint8Array(0)]) {
    rejectsCode(() => inspectWebp(bytes), 'invalid-webp');
  }
});

test('chunk lengths and incomplete final chunk headers cannot escape RIFF bounds', () => {
  const invalidLength = riff(vp8(5, 7)); new DataView(invalidLength.buffer).setUint32(16, 0xffffffff, true);
  rejectsCode(() => inspectWebp(invalidLength), 'invalid-webp');
  const shortHeader = replaceRiffLength(join(riff(vp8(5, 7)), ascii('JUNK')));
  rejectsCode(() => inspectWebp(shortHeader), 'invalid-webp');
});

test('missing or misplaced initial header and missing image payload fail', () => {
  for (const bytes of [riff(vp8x(5, 7)), riff(chunk('JUNK', new Uint8Array(0)), vp8(5, 7)), riff()]) {
    rejectsCode(() => inspectWebp(bytes), 'invalid-webp');
  }
});

test('duplicate image payloads and duplicate extended headers are rejected', () => {
  for (const bytes of [riff(vp8(5, 7), vp8l(5, 7)), riff(vp8x(5, 7), vp8(5, 7), vp8(5, 7)),
    riff(vp8x(5, 7), vp8x(5, 7), vp8l(5, 7))]) rejectsCode(() => inspectWebp(bytes), 'invalid-webp');
});

test('invalid VP8 keyframe signature and zero dimensions are rejected', () => {
  const interframe = vp8(5, 7); interframe[8] |= 1;
  const wrongSync = vp8(5, 7); wrongSync[11] = 0;
  for (const payload of [interframe, wrongSync, vp8(0, 7), chunk('VP8 ', new Uint8Array(9))]) {
    rejectsCode(() => inspectWebp(riff(payload)), 'invalid-webp');
  }
});

test('invalid VP8L magic, reserved version and short image header are rejected', () => {
  const wrongMagic = vp8l(5, 7); wrongMagic[8] = 0;
  const futureVersion = vp8l(5, 7); futureVersion[12] |= 0x20;
  for (const payload of [wrongMagic, futureVersion, chunk('VP8L', Uint8Array.of(0x2f, 0, 0, 0))]) {
    rejectsCode(() => inspectWebp(riff(payload)), 'invalid-webp');
  }
});

test('extended and compressed image dimensions must agree', () => {
  rejectsCode(() => inspectWebp(riff(vp8x(32, 24), vp8(31, 24))), 'invalid-webp');
  rejectsCode(() => inspectWebp(riff(vp8x(32, 24), vp8l(32, 23))), 'invalid-webp');
});

test('alpha chunks cannot be duplicated, follow the image or accompany VP8L', () => {
  const alpha = chunk('ALPH', Uint8Array.of(0));
  for (const bytes of [riff(vp8x(5, 7, 0x10), alpha, alpha, vp8(5, 7)),
    riff(vp8x(5, 7, 0x10), vp8(5, 7), alpha), riff(vp8x(5, 7, 0x10), alpha, vp8l(5, 7))]) {
    rejectsCode(() => inspectWebp(bytes), 'invalid-webp');
  }
});

test('color reconstruction chunks cannot be duplicated or placed after image data', () => {
  const profile = chunk('ICCP', Uint8Array.of(1));
  for (const bytes of [riff(vp8x(5, 7, 0x20), vp8(5, 7), profile),
    riff(vp8x(5, 7, 0x20), profile, profile, vp8(5, 7))]) rejectsCode(() => inspectWebp(bytes), 'invalid-webp');
});

test('animation flags, ANIM and ANMF are each rejected explicitly', () => {
  for (const bytes of [riff(vp8x(5, 7, 0x02), vp8(5, 7)),
    riff(vp8x(5, 7), chunk('ANIM', new Uint8Array(6)), vp8(5, 7)),
    riff(vp8x(5, 7), chunk('ANMF', new Uint8Array(16)), vp8(5, 7))]) {
    rejectsCode(() => inspectWebp(bytes), 'animated-webp');
  }
});

test('predecode byte, side and pixel bounds reject excess and accept the exact boundary', () => {
  rejectsCode(() => inspectWebp(new Uint8Array(PNG_SVG_LIMITS.maxInputBytes + 1)), 'image-limit');
  rejectsCode(() => inspectWebp(riff(vp8l(4097, 1))), 'image-limit');
  rejectsCode(() => inspectWebp(riff(vp8x(1, 4097), vp8l(1, 4097))), 'image-limit');
  rejectsCode(() => inspectWebp(riff(vp8l(2049, 2049))), 'image-limit');
  const boundary = inspectWebp(riff(vp8l(4096, 1024)));
  assert.equal(boundary.width * boundary.height, PNG_SVG_LIMITS.maxPixels);
});

test('actual byte signatures select PNG or WebP and unknown images fail', () => {
  assert.equal(inspectRaster(createPngFixtures()[0].bytes).format, 'png');
  assert.equal(inspectRaster(riff(vp8l(5, 7))).format, 'webp');
  rejectsCode(() => inspectRaster(ascii('GIF89a')), 'invalid-image');
});

test('MIME and extension hints remain convenience hints with legacy PNG fallback', () => {
  assert.equal(rasterMimeHint({name: 'ICON.WeBp', type: ''}), 'image/webp');
  assert.equal(rasterMimeHint({name: 'misnamed.png', type: 'image/webp'}), 'image/webp');
  assert.equal(rasterMimeHint({name: 'legacy.png', type: ''}), 'image/png');
  assert.equal(rasterMimeHint({name: 'unknown.bin', type: 'application/octet-stream'}), 'image/png');
});

test('mixed PNG/WebP names share safe case-insensitive SVG collision allocation', () => {
  const names = new Set<string>();
  assert.equal(allocateSvgFilename('icon.png', names), 'icon.svg');
  assert.equal(allocateSvgFilename('icon.webp', names), 'icon (2).svg');
  assert.equal(allocateSvgFilename('ICON.WEBP', names), 'ICON (3).svg');
  assert.equal(allocateSvgFilename('CON.webp', names), '_CON.svg');
  assert.equal(allocateSvgFilename('../nested/icon.webp', names), 'icon (4).svg');
});

test('embedded WebP retains all original bytes and the image/webp MIME', () => {
  const original = riff(vp8x(5, 7), vp8l(5, 7), chunk('JUNK', Uint8Array.of(71, 29, 6)));
  const svg = createEmbeddedRasterSvg(original, 5, 7);
  const encoded = /href="data:image\/webp;base64,([^"]+)"/.exec(svg)?.[1];
  assert.ok(encoded);
  assert.deepEqual(new Uint8Array(Buffer.from(encoded, 'base64')), original);
  assert.match(svg, /width="5" height="7" viewBox="0 0 5 7"/);
  rejectsCode(() => createEmbeddedRasterSvg(original, 6, 7), 'invalid-webp');
});

test('embedding output bound is checked before base64 expansion', () => {
  const large = riff(vp8x(1, 1), vp8l(1, 1), chunk('JUNK', new Uint8Array(19 * 1024 * 1024)));
  assert.ok(large.length < PNG_SVG_LIMITS.maxInputBytes);
  rejectsCode(() => createEmbeddedRasterSvg(large, 1, 1), 'svg-limit');
});

test('generic PNG embedding preserves the established PNG implementation exactly', () => {
  const fixture = createPngFixtures()[0];
  assert.equal(createEmbeddedRasterSvg(fixture.bytes, fixture.width, fixture.height),
    createEmbeddedPngSvg(fixture.bytes, fixture.width, fixture.height));
});

