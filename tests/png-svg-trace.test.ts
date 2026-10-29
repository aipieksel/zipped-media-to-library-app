import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ImageTracer from 'imagetracerjs';
import { PngSvgError } from '../src/png-svg';
import {
  analyzeSilhouette, createSilhouetteMask, createTracePalette, detectSilhouette, imageTracerOptions,
  isFullyOpaque, normalizeTransparentPixels, PNG_SVG_TRACE_LIMITS, validateSvgPath, validateTraceInput,
} from '../src/png-svg-trace';
import { alphaTopology, createAngularIconFixture, createCurveReferenceFixture, createPngFixtures, createResampledLineIconFixture, createSilhouetteRejectionFixtures, meanAbsoluteAlphaError } from './png-fixture-generator';

const curve = createCurveReferenceFixture();
const resampledLine = createResampledLineIconFixture();

test('resampled 96px line fixture retains independent rings, angled stroke and island with a wider AA fringe', () => {
  assert.equal(createHash('sha256').update(resampledLine.rgba).digest('hex'), 'e9ddccbdc4720ebcfa31732ec5fc5fc994331e6fd0afc31bc325afe2c05b826a', 'Native fixture changed after the pre-fix RED receipt.');
  assert.equal(createHash('sha256').update(resampledLine.reference).digest('hex'), 'aba5ae34163f0ed3a97b1c4507edabd68e5138a375bed6f60169949bbb951aee', 'Independent oracle changed after the pre-fix RED receipt.');
  assert.deepEqual(alphaTopology(resampledLine.rgba, 96, 96), {components: 4, holes: 2});
  assert.deepEqual(alphaTopology(resampledLine.reference, 384, 384), {components: 4, holes: 2});
  let opaque = 0, transparent = 0, widerFringe = 0;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const alpha = resampledLine.rgba[(y * 96 + x) * 4 + 3];
    if (alpha === 255) {opaque++; continue;}
    if (alpha === 0) {transparent++; continue;}
    let touchesOpaque = false, touchesTransparent = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      const neighbor = nx < 0 || ny < 0 || nx >= 96 || ny >= 96 ? 0 : resampledLine.rgba[(ny * 96 + nx) * 4 + 3];
      touchesOpaque ||= neighbor === 255;
      touchesTransparent ||= neighbor === 0;
    }
    if (!touchesOpaque || !touchesTransparent) widerFringe++;
  }
  assert.ok(opaque >= 4 && transparent > 0, 'The input has real opaque and transparent anchors.');
  assert.ok(widerFringe > 100, 'The fixture must exercise antialias pixels beyond the former immediate-neighbor rule.');
  const enlarged = new Uint8ClampedArray(resampledLine.reference.length);
  for (let y = 0; y < 384; y++) for (let x = 0; x < 384; x++) {
    const source = (Math.floor(y / 4) * 96 + Math.floor(x / 4)) * 4;
    enlarged.set(resampledLine.rgba.subarray(source, source + 4), (y * 384 + x) * 4);
  }
  assert.ok(meanAbsoluteAlphaError(enlarged, resampledLine.reference) > 0.5, 'The analytic target is not an enlarged copy of the filtered source.');
});

test('silhouette routing accepts the fixed resampled line fixture without changing source pixels', () => {
  const original = resampledLine.rgba.slice();
  const result = detectSilhouette(resampledLine.rgba, 96, 96);
  assert.ok(result, 'A monochrome opaque line icon with a bounded wider antialias fringe must use silhouette contours.');
  assert.deepEqual(result.color, {r: 0, g: 0, b: 0, a: 255});
  assert.deepEqual(resampledLine.rgba, original);
  assert.equal(analyzeSilhouette(resampledLine.rgba, 96, 96).reason, null);
});

const rejectionFixtures = createSilhouetteRejectionFixtures();
for (const [name, reason] of [
  ['broadFade', 'opaque-support-too-distant'],
  ['interiorPocket', 'transparent-support-too-distant'],
  ['detachedPatch', 'opaque-support-too-distant'],
] as const) {
  test(`silhouette rejection preserves ${name} and explains its unsupported alpha region`, () => {
    const fixture = rejectionFixtures[name], original = fixture.rgba.slice();
    const result = analyzeSilhouette(fixture.rgba, fixture.width, fixture.height);
    assert.equal(result.silhouette, null);
    assert.equal(result.reason, reason);
    assert.equal(detectSilhouette(fixture.rgba, fixture.width, fixture.height), null);
    assert.deepEqual(fixture.rgba, original);
    assert.ok(original.some((value, index) => index % 4 === 3 && value === 255), 'This rejection must have a real opaque anchor, not merely fail the no-opaque guard.');
    const {x, y, alpha} = fixture.alphaProbe;
    assert.ok(alpha > 0 && alpha < 255);
    assert.equal(original[(y * fixture.width + x) * 4 + 3], alpha);
  });
}

test('silhouette diagnostics distinguish missing anchors, binary art and visible color variation', () => {
  const translucent = resampledLine.rgba.slice();
  for (let offset = 3; offset < translucent.length; offset += 4) translucent[offset] = Math.round(translucent[offset] * 0.5);
  assert.equal(analyzeSilhouette(translucent, 96, 96).reason, 'insufficient-opaque-core');
  const opaque = new Uint8ClampedArray(4 * 4 * 4);
  for (let offset = 3; offset < opaque.length; offset += 4) opaque[offset] = 255;
  assert.equal(analyzeSilhouette(opaque, 4, 4).reason, 'no-transparent-background');
  const binary = opaque.slice(); binary[3] = 0;
  assert.equal(analyzeSilhouette(binary, 4, 4).reason, 'no-antialiased-edge');
  const distinctColor = resampledLine.rgba.slice();
  const offset = distinctColor.findIndex((value, index) => index % 4 === 3 && value === 255);
  distinctColor[offset - 3] = 255;
  assert.equal(analyzeSilhouette(distinctColor, 96, 96).reason, 'foreground-color-mismatch');
});

test('sharp right-angle and 45-degree fixture retains independent corner and line probes', () => {
  const fixture = createAngularIconFixture();
  assert.deepEqual(alphaTopology(fixture.rgba, 32, 32), {components: 2, holes: 0});
  assert.deepEqual(alphaTopology(fixture.reference, 128, 128), {components: 2, holes: 0});
  assert.ok(detectSilhouette(fixture.rgba, 32, 32));
  for (const [x, y, inside] of [[11, 17, true], [12.5, 17, false], [12.5, 19, true], [23, 9.75, true], [23, 8.25, false], [18.75, 13.75, true]] as const) {
    const alpha = fixture.reference[(Math.floor(y * 4) * 128 + Math.floor(x * 4)) * 4 + 3];
    assert.equal(alpha >= 128, inside, `Independent angular probe ${x},${y}`);
  }
});

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
