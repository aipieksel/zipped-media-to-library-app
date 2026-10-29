import test from 'node:test';
import assert from 'node:assert/strict';
import {ALPHA_CONTOUR_LIMITS, createAlphaContourSvg, extractAlphaContours} from '../src/png-svg-contours';
import type {ContourPoint} from '../src/png-svg-contours';
import {PngSvgError} from '../src/png-svg';
import {TRACE_ENGINES, validateSvgPath} from '../src/png-svg-trace';
import {createAngularIconFixture, createCurveReferenceFixture, createResampledLineIconFixture} from './png-fixture-generator';
import {inspectCircularContours, parseSvgMetricContours, sampleMetricSegment} from './png-svg-curve-metrics';

function pixels(width: number, height: number, alpha: (x: number, y: number) => number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rgba.set([17 + x % 80, 61 + y % 80, 113, alpha(x, y)], (y * width + x) * 4);
  return rgba;
}

/** Independent even-odd ray crossings; no contour extraction or fitting code is reused. */
function inside(contours: readonly (readonly ContourPoint[])[], x: number, y: number): boolean {
  let filled = false;
  for (const points of contours) for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) filled = !filled;
  }
  return filled;
}

function svgContours(svg: string): ContourPoint[][] {
  return parseSvgMetricContours(svg).map(contour => contour.flatMap(segment =>
    Array.from({length: 64}, (_, index): ContourPoint => {const point = sampleMetricSegment(segment, index / 64); return [point.x, point.y];})));
}

function simpleLoop(points: readonly ContourPoint[]): void {
  assert.ok(points.length >= 3);
  assert.notDeepEqual(points[0], points.at(-1), 'Closure is implicit; the endpoint is not duplicated.');
  assert.equal(new Set(points.map(point => point.join(','))).size, points.length, 'Shared-edge stitching must not revisit a vertex inside a loop.');
  for (const point of points) assert.ok(point.every(Number.isFinite));
  const cross = (a: ContourPoint, b: ContourPoint, c: ContourPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i++) for (let j = i + 2; j < points.length; j++) {
    if (i === 0 && j === points.length - 1) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    assert.ok(!(cross(a, b, c) * cross(a, b, d) < -1e-12 && cross(c, d, a) * cross(c, d, b) < -1e-12), 'A stitched loop must not cross itself.');
  }
}

const corners = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
function cell(values: readonly number[]): Uint8ClampedArray {
  return pixels(2, 2, (x, y) => values[corners.findIndex(([cx, cy]) => cx === x && cy === y)]);
}

test('all 16 marching-square cases preserve pixel-center membership and deterministic foreground-connected ties', () => {
  for (let mask = 0; mask < 16; mask++) {
    const values = corners.map((_, index) => mask & (1 << index) ? 255 : 0);
    const source = cell(values), original = source.slice();
    const result = extractAlphaContours(source, 2, 2);
    assert.equal(result.contours.length, mask ? 1 : 0, `Case ${mask}: exact diagonal ties connect foreground.`);
    assert.equal(result.ambiguousCells, mask === 5 || mask === 10 ? 1 : 0, `Case ${mask}: saddle count.`);
    assert.equal(result.vertexCount, result.contours.reduce((sum, contour) => sum + contour.length, 0));
    for (const contour of result.contours) {
      simpleLoop(contour);
      assert.ok(contour.every(([x, y]) => x >= 0 && x <= 2 && y >= 0 && y <= 2));
    }
    for (const [index, [x, y]] of corners.entries()) assert.equal(inside(result.contours, x + 0.5, y + 0.5), values[index] === 255, `Case ${mask}, corner ${index}.`);
    assert.deepEqual(extractAlphaContours(source, 2, 2), result, `Case ${mask}: extraction is deterministic.`);
    assert.deepEqual(source, original);
  }
});

test('bilinear saddles use connectivity rather than a misleading center-average decision', () => {
  for (const [values, expectedLoops] of [
    [[255, 68, 129, 68], 2], // Mean >127.5, but the high diagonal remains disconnected.
    [[68, 255, 68, 129], 2],
    [[188, 0, 188, 126], 1], // Mean <127.5, but the high diagonal is connected.
    [[0, 188, 126, 188], 1],
  ] as const) {
    const result = extractAlphaContours(cell(values), 2, 2);
    assert.equal(result.ambiguousCells, 1);
    assert.equal(result.contours.length, expectedLoops, values.join(','));
    result.contours.forEach(simpleLoop);
    corners.forEach(([x, y], index) => assert.equal(inside(result.contours, x + 0.5, y + 0.5), values[index] > 127.5));
  }
});

test('transparent padding closes canvas-edge samples at the correct native pixel-center coordinates', () => {
  const single = extractAlphaContours(pixels(1, 1, () => 255), 1, 1);
  assert.equal(single.contours.length, 1);
  assert.deepEqual(new Set(single.contours[0].map(point => point.join(','))), new Set(['0.5,0', '1,0.5', '0.5,1', '0,0.5']));
  const translated = extractAlphaContours(pixels(3, 2, (x, y) => x === 2 && y === 0 ? 255 : 0), 3, 2);
  assert.deepEqual(new Set(translated.contours[0].map(([x, y]) => [x - 2, y].join(','))), new Set(single.contours[0].map(point => point.join(','))));
  const filled = extractAlphaContours(pixels(3, 2, () => 255), 3, 2);
  const xs = filled.contours[0].map(point => point[0]), ys = filled.contours[0].map(point => point[1]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 3, 0, 2]);
  simpleLoop(filled.contours[0]);
});

test('crossings interpolate actual alpha instead of converting source pixels to a binary grid', () => {
  for (const alpha of [128, 160, 200, 255]) {
    const result = extractAlphaContours(pixels(1, 1, () => alpha), 1, 1);
    assert.equal(result.contours.length, 1);
    const expectedMin = -0.5 + 127.5 / alpha, expectedMax = 1.5 - 127.5 / alpha;
    const xs = result.contours[0].map(point => point[0]), ys = result.contours[0].map(point => point[1]);
    assert.ok(Math.abs(Math.min(...xs) - expectedMin) < 1e-12);
    assert.ok(Math.abs(Math.max(...xs) - expectedMax) < 1e-12);
    assert.ok(Math.abs(Math.min(...ys) - expectedMin) < 1e-12);
    assert.ok(Math.abs(Math.max(...ys) - expectedMax) < 1e-12);
  }
  assert.equal(extractAlphaContours(pixels(1, 1, () => 127), 1, 1).contours.length, 0);
});

test('frozen ring holes, separate island and narrow stroke survive extraction and even-odd cubic serialization', () => {
  const fixture = createResampledLineIconFixture(), original = fixture.rgba.slice();
  const extracted = extractAlphaContours(fixture.rgba, fixture.width, fixture.height);
  assert.equal(extracted.contours.length, 6);
  assert.equal(extracted.vertexCount, extracted.contours.reduce((sum, contour) => sum + contour.length, 0));
  const generated = createAlphaContourSvg(fixture.rgba, fixture.width, fixture.height);
  assert.equal(generated.contourCount, 6);
  assert.equal(generated.pathCount, 1);
  assert.match(generated.svg, /fill-rule="evenodd"/);
  assert.doesNotMatch(generated.svg, /<image\b|NaN|Infinity/);
  const data = generated.svg.match(/\bd="([^"]+)"/)?.[1];
  assert.ok(data);
  assert.equal(validateSvgPath(data), generated.curveCount + generated.contourCount * 2);
  assert.equal(parseSvgMetricContours(generated.svg).length, 6);
  const polygons = svgContours(generated.svg);
  for (const [x, y, filled] of [[28.4, 29.2, false], [68.25, 26.75, false], [45, 29.2, true], [78.5, 26.75, true], [16.25, 75.5, true], [48.25, 58.5, true], [78, 80, true], [86, 55, true], [51, 28, false]] as const) {
    assert.equal(inside(extracted.contours, x, y), filled, `Extracted feature ${x},${y}.`);
    assert.equal(inside(polygons, x, y), filled, `Cubic feature ${x},${y}.`);
  }
  const roundness = inspectCircularContours(generated.svg);
  assert.equal(roundness.pass, true, JSON.stringify(roundness));
  for (const contour of roundness.contours) assert.ok(contour.maxTangentJumpDegrees < 0.1, `Ordinary quarter/closure seams must share their tangent: ${JSON.stringify(contour)}.`);
  assert.deepEqual(fixture.rgba, original);
});

test('the original narrow-fringe fixture keeps every loop and the exact profile 3 identity', () => {
  const fixture = createCurveReferenceFixture();
  const generated = createAlphaContourSvg(fixture.rgba, fixture.width, fixture.height);
  assert.equal(generated.contourCount, 3);
  assert.equal(parseSvgMetricContours(generated.svg).length, 3);
  assert.deepEqual(TRACE_ENGINES.silhouette, {id: 'silhouette', name: 'Native alpha contours', version: 'marching squares 1 / fit-curve 0.2.0 / silhouette profile 3'});
});

test('supported right-angle and 45-degree features survive the cubic fitter without applying ring-only metrics', () => {
  const fixture = createAngularIconFixture();
  const generated = createAlphaContourSvg(fixture.rgba, fixture.width, fixture.height);
  assert.equal(generated.contourCount, 2);
  const polygons = svgContours(generated.svg);
  for (const [x, y, filled] of [[11, 17, true], [12.5, 17, false], [12.5, 19, true], [23, 9.75, true], [23, 8.25, false], [18.75, 13.75, true]] as const) assert.equal(inside(polygons, x, y), filled, `Angular feature ${x},${y}.`);
});

test('empty alpha yields a native-size empty SVG and a tiny above-threshold island is never omitted', () => {
  const empty = createAlphaContourSvg(pixels(7, 5, () => 0), 7, 5);
  assert.equal(empty.contourCount, 0); assert.equal(empty.curveCount, 0); assert.equal(empty.pathCount, 0);
  assert.match(empty.svg, /width="7" height="5" viewBox="0 0 7 5"/);
  assert.doesNotMatch(empty.svg, /<path/);
  const tiny = createAlphaContourSvg(pixels(1, 1, () => 128), 1, 1);
  assert.equal(tiny.contourCount, 1); assert.equal(tiny.pathCount, 1);
  assert.ok(tiny.curveCount > 0);
  assert.equal(parseSvgMetricContours(tiny.svg).length, 1);
});

test('long accepted loops are split into bounded fitting spans and progress remains finite and monotone', () => {
  const source = pixels(1024, 2, () => 255), progress: number[] = [];
  const raw = extractAlphaContours(source, 1024, 2);
  assert.ok(raw.contours[0].length > ALPHA_CONTOUR_LIMITS.maxFitPoints);
  const result = createAlphaContourSvg(source, 1024, 2, {onProgress: percent => progress.push(percent)});
  assert.equal(result.contourCount, 1);
  assert.ok(result.curveCount > 0);
  assert.equal(progress[0], 0); assert.equal(progress.at(-1), 100);
  assert.ok(progress.every((value, index) => Number.isFinite(value) && value >= 0 && value <= 100 && (index === 0 || value >= progress[index - 1])));
  assert.equal(inside(svgContours(result.svg), 512, 1), true);
});

test('invalid allocation dimensions and each contour complexity limit fail explicitly with retry guidance', () => {
  const code = (expected: PngSvgError['code']) => (error: unknown) => error instanceof PngSvgError && error.code === expected;
  assert.throws(() => extractAlphaContours(new Uint8Array(3), 1, 1), code('invalid-png'));
  assert.throws(() => extractAlphaContours(new Uint8Array(), 0, 0), code('invalid-png'));
  assert.throws(() => extractAlphaContours(new Uint8Array(1025 * 4), 1025, 1), code('trace-limit'));
  assert.throws(() => extractAlphaContours(new Uint8Array(513 * 513 * 4), 513, 513), code('trace-limit'));
  const bounded = (reason: RegExp) => (error: unknown) => error instanceof PngSvgError && error.code === 'trace-limit' && reason.test(error.message) && /Pixel vectors.*Embedded/.test(error.message);
  assert.throws(() => extractAlphaContours(pixels(512, 512, (x, y) => (x + y) % 2 ? 255 : 0), 512, 512), bounded(/vertices/));
  assert.throws(() => extractAlphaContours(pixels(512, 21, (x, y) => x >= 1 && x < 511 && y >= 1 && y < 20 && (x === 1 || y % 2 === 1) ? 255 : 0), 512, 21), bounded(/per-loop/));
  assert.throws(() => extractAlphaContours(pixels(512, 512, (x, y) => x % 3 === 1 && y % 3 === 1 ? 255 : 0), 512, 512), bounded(/too many alpha contours/));
});
