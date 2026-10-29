import test from 'node:test';
import assert from 'node:assert/strict';
import ImageTracer from 'imagetracerjs';
import { PngSvgError } from '../src/png-svg';
import {
  createSilhouetteMask, createTracePalette, detectSilhouette, imageTracerOptions,
  isFullyOpaque, normalizeTransparentPixels, PNG_SVG_TRACE_LIMITS, validateSvgPath, validateTraceInput,
} from '../src/png-svg-trace';
import { alphaTopology, createCurveReferenceFixture, createPngFixtures, meanAbsoluteAlphaError } from './png-fixture-generator';

const curve = createCurveReferenceFixture();

test('known 96px curve has independent 4x reference, curved hole, separate island and narrow connected stroke', () => {
  assert.equal(curve.bytes[0], 137);
  assert.equal(curve.reference.length, 384 * 384 * 4);
  assert.deepEqual(alphaTopology(curve.rgba, 96, 96), { components: 2, holes: 1 });
  assert.deepEqual(alphaTopology(curve.reference, 384, 384), { components: 2, holes: 1 });
  assert.equal(curve.reference[(44 * 4 * 384 + 42 * 4) * 4 + 3], 0, 'Curved hole remains empty');
  assert.equal(curve.reference[(79 * 4 * 384 + 81 * 4) * 4 + 3], 255, 'Narrow connecting stroke has a solid center');
  const enlarged = new Uint8ClampedArray(curve.reference.length);
  for (let y = 0; y < 384; y++) {
    for (let x = 0; x < 384; x++) {
      const source = (Math.floor(y / 4) * 96 + Math.floor(x / 4)) * 4;
      enlarged.set(curve.rgba.subarray(source, source + 4), (y * 384 + x) * 4);
    }
  }
  assert.ok(meanAbsoluteAlphaError(enlarged, curve.reference) > 0.5, 'Independent oracle is not a resized copy of the native pixels');
});

test('silhouette routing accepts a narrow opaque-color antialias fringe without altering its source', () => {
  const original = curve.rgba.slice();
  const result = detectSilhouette(curve.rgba, curve.width, curve.height);
  assert.ok(result);
  assert.deepEqual(result.color, { r: 0, g: 0, b: 0, a: 255 });
  assert.ok(result.opaquePixels > 100 && result.edgePixels > 100);
  assert.deepEqual(curve.rgba, original);
  const mask = createSilhouetteMask(curve.rgba, true);
  assert.ok(isFullyOpaque(mask), 'Binary VTracer input is an explicit opaque mask');
  assert.deepEqual(alphaTopology(createSilhouetteMask(curve.rgba, false), 96, 96), { components: 2, holes: 1 });
});

test('silhouette routing rejects arbitrary translucent fills, soft alpha fields and distinct foreground colors', () => {
  const translucent = curve.rgba.slice();
  for (let offset = 3; offset < translucent.length; offset += 4) translucent[offset] = Math.round(translucent[offset] * 0.5);
  assert.equal(detectSilhouette(translucent, 96, 96), null);
  const multicolor = curve.rgba.slice();
  const visible = multicolor.findIndex((value, index) => index % 4 === 3 && value === 255);
  multicolor[visible - 3] = 255;
  assert.equal(detectSilhouette(multicolor, 96, 96), null);
  const gradient = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) gradient[(y * 16 + x) * 4 + 3] = x * 17;
  assert.equal(detectSilhouette(gradient, 16, 16), null);
  const fixtures = createPngFixtures();
  assert.equal(detectSilhouette(fixtures[2].rgba, fixtures[2].width, fixtures[2].height), null);
});

test('transparent normalization preserves every visible channel and never mutates input', () => {
  const source = new Uint8ClampedArray([80, 90, 100, 0, 20, 30, 40, 1, 70, 80, 90, 127]);
  const normalized = normalizeTransparentPixels(source);
  assert.deepEqual(normalized, new Uint8ClampedArray([0, 0, 0, 0, 20, 30, 40, 1, 70, 80, 90, 127]));
  assert.equal(source[0], 80);
});

test('RGBA palette is deterministic, preserves small exact palettes and reserves full transparency', () => {
  const indexed = createPngFixtures().find(fixture => fixture.category === 'palette')!;
  const palette = createTracePalette(indexed.rgba);
  assert.equal(palette.length, 4);
  assert.deepEqual(new Set(palette.map(color => color.a)), new Set([0, 85, 173, 255]));
  const large = createPngFixtures().find(fixture => fixture.category === 'alpha-sweep')!;
  const first = createTracePalette(large.rgba);
  assert.equal(first.length, PNG_SVG_TRACE_LIMITS.maxPaletteColors);
  assert.deepEqual(first, createTracePalette(large.rgba));
  assert.ok(first.some(color => color.a === 0));
  assert.ok(first.some(color => color.a > 0 && color.a < 255));
});

test('locked ImageTracer runs with deterministic settings, native dimensions, partial opacity and no strokes', () => {
  const rgba = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) rgba.set([31, 117, 203, 127], (y * 8 + x) * 4);
  const pixels = normalizeTransparentPixels(rgba);
  const palette = createTracePalette(pixels);
  const options = imageTracerOptions(palette);
  const originalRandom = Math.random;
  let svg: string;
  try {
    Math.random = () => { throw new Error('The chosen tracing profile must not use random sampling.'); };
    const data = ImageTracer.imagedataToTracedata({ width: 8, height: 8, data: pixels }, options);
    svg = ImageTracer.getsvgstring(data, options);
  } finally { Math.random = originalRandom; }
  assert.match(svg!, /viewBox="0 0 8 8"/);
  assert.match(svg!, /opacity="0\.4980392156862745"/);
  assert.match(svg!, /stroke-width="0"/);
  assert.doesNotMatch(svg!, /<image|href=|<script/);
  assert.equal(options.pathomit, 0);
  assert.equal(options.linefilter, false);
  assert.equal(options.blurradius, 0);
});

test('SVG path validation rejects malformed commands, non-finite/extreme values, injected markup and invalid arcs', () => {
  assert.equal(validateSvgPath('M 0 0 L 4 0 4 4 Q 2 5 0 4 Z'), 5);
  assert.equal(validateSvgPath('m1e-3,-2e+1 c0 0 1 1 2 2z'), 3);
  for (const data of ['', 'L0 0', 'M 0', 'M0 0 Q1 2 3', 'M0 0 LNaN 2', 'M0 0 L1e99 2', 'M0 0 X1 2', 'M0 0" onload="alert(1)', 'M0 0 A-1 2 0 0 1 3 4', 'M0 0 A1 2 0 2 1 3 4']) {
    assert.throws(() => validateSvgPath(data), PngSvgError, data);
  }
});

test('smooth budgets reject larger inputs without resampling or weakening exact-mode limits', () => {
  validateTraceInput(new Uint8ClampedArray(4), 1, 1);
  assert.throws(() => validateTraceInput(new Uint8ClampedArray(513 * 513 * 4), 513, 513), error => error instanceof PngSvgError && error.code === 'trace-limit');
  assert.throws(() => validateTraceInput(new Uint8ClampedArray(4), 2, 1), error => error instanceof PngSvgError && error.code === 'invalid-png');
});
