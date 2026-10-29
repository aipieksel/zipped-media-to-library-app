import test from 'node:test';
import assert from 'node:assert/strict';
import {FROZEN_RING_CIRCLES, inspectCircularContours, parseSvgMetricContours, ROUND_CONTOUR_GUARD} from './png-svg-curve-metrics';
import type {CircleReference} from './png-svg-curve-metrics';

const svgOf = (paths: readonly string[]) => `<svg xmlns="http://www.w3.org/2000/svg">${paths.map(data => `<path d="${data}"/>`).join('')}</svg>`;

function polygon(circle: CircleReference, sides: number, quadraticBow?: number, subdivisions = 1): string {
  const vertices = Array.from({length: sides}, (_, i) => ({x: circle.cx + circle.r * Math.cos(2 * Math.PI * i / sides), y: circle.cy + circle.r * Math.sin(2 * Math.PI * i / sides)}));
  let data = `M ${vertices[0].x} ${vertices[0].y}`;
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i], to = vertices[(i + 1) % vertices.length];
    if (quadraticBow !== undefined) {
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      const radial = Math.hypot(mx - circle.cx, my - circle.cy);
      data += ` Q ${mx + (mx - circle.cx) / radial * quadraticBow} ${my + (my - circle.cy) / radial * quadraticBow} ${to.x} ${to.y}`;
    } else for (let part = 1; part <= subdivisions; part++) {
      if (i === vertices.length - 1 && part === subdivisions) continue; // Exercise the actual Z closing edge.
      data += ` L ${from.x + (to.x - from.x) * part / subdivisions} ${from.y + (to.y - from.y) * part / subdivisions}`;
    }
  }
  return data + ' Z';
}

function cubicCircle({cx: x, cy: y, r}: CircleReference): string {
  const k = 4 * (Math.sqrt(2) - 1) / 3 * r;
  return `M ${x + r} ${y} C ${x + r} ${y + k} ${x + k} ${y + r} ${x} ${y + r} C ${x - k} ${y + r} ${x - r} ${y + k} ${x - r} ${y} C ${x - r} ${y - k} ${x - k} ${y - r} ${x} ${y - r} C ${x + k} ${y - r} ${x + r} ${y - k} ${x + r} ${y} Z`;
}

test('roundness thresholds retain the independently calibrated 80% / 15-degree / half-sagitta guard', () => {
  assert.deepEqual(ROUND_CONTOUR_GUARD, {minimumCurvedAngularCoverage: 0.8, maximumFlatAngularRunDegrees: 15, minimumBowFractionOfAnalyticSagitta: 0.5});
  const measured = inspectCircularContours(svgOf(FROZEN_RING_CIRCLES.map(cubicCircle)));
  assert.equal(measured.pass, true);
  assert.equal(measured.contours.length, 4);
  for (const contour of measured.contours) {
    assert.equal(contour.genuineCurveSegments, 4);
    assert.equal(contour.curvedCoverage, 1);
    assert.equal(contour.maxFlatDegrees, 0);
    assert.ok(contour.maxTangentJumpDegrees < 0.0001);
    assert.ok(Math.abs(Math.abs(contour.windingDegrees) - 360) < 1e-9);
  }
});

for (const sides of [8, 12]) test(`${sides}-sided circular impostors fail independently on all four ring boundaries`, () => {
  const measured = inspectCircularContours(svgOf(FROZEN_RING_CIRCLES.map(circle => polygon(circle, sides))));
  assert.equal(measured.pass, false);
  for (const contour of measured.contours) {
    assert.equal(contour.curvedCoverage, 0);
    assert.ok(Math.abs(contour.maxFlatDegrees - 360 / sides) < 1e-8);
    assert.equal(contour.pass, false);
  }
});

test('collinear and decorative barely-bent quadratic tokens cannot pass as circular curves', () => {
  for (const bow of [0, 0.01]) {
    const measured = inspectCircularContours(svgOf(FROZEN_RING_CIRCLES.map(circle => polygon(circle, 12, bow))));
    assert.equal(measured.pass, false);
    for (const contour of measured.contours) {
      assert.equal(contour.curvedCoverage, 0);
      assert.ok(contour.maxFlatDegrees > 29.99);
    }
  }
});

test('subdividing straight polygon edges cannot hide long flat runs across segment or closing seams', () => {
  const measured = inspectCircularContours(svgOf(FROZEN_RING_CIRCLES.map(circle => polygon(circle, 12, undefined, 8))));
  for (const contour of measured.contours) {
    assert.equal(contour.curvedCoverage, 0);
    assert.ok(Math.abs(contour.maxFlatDegrees - 30) < 1e-8);
    assert.equal(contour.pass, false);
  }
});

test('circular requirements apply to matched subcontours and do not forbid separate angular artwork', () => {
  const paths = [...FROZEN_RING_CIRCLES.map(cubicCircle).reverse(), 'M 10 70 L 30 70 L 30 90 L 10 90 Z'];
  assert.equal(inspectCircularContours(svgOf(paths)).pass, true);
  // Curves on the outer rings cannot conceal all-linear holes in the same path element.
  const mixed = svgOf(FROZEN_RING_CIRCLES.map((circle, index) => index % 2 === 1 ? polygon(circle, 12) : cubicCircle(circle)).reduce((paths, path, index) => {
    if (index % 2 === 0) paths.push(path); else paths[paths.length - 1] += ' ' + path;
    return paths;
  }, [] as string[]));
  const measured = inspectCircularContours(mixed);
  assert.equal(measured.pass, false);
  assert.deepEqual(measured.contours.map(contour => contour.pass), [true, false, true, false]);
});

test('missing, ambiguous, open or unsupported geometry fails instead of silently skipping a circle', () => {
  const paths = FROZEN_RING_CIRCLES.map(cubicCircle);
  assert.throws(() => inspectCircularContours(svgOf(paths.slice(0, 3))), /exactly one/);
  assert.throws(() => inspectCircularContours(svgOf([...paths, paths[0]])), /exactly one/);
  assert.throws(() => inspectCircularContours(svgOf([paths[0].replace(/ Z$/, '')])), /Unclosed/);
  assert.throws(() => inspectCircularContours(svgOf(paths).replace('<path ', '<path transform="translate(1 0)" ')), /Transforms/);
  assert.throws(() => parseSvgMetricContours(svgOf(['M 1 0 A 1 1 0 1 1 -1 0 Z'])), /Unsupported/);
});

test('relative coordinates, repeated line pairs and implicit closing edges describe the same finite contour', () => {
  const absolute = parseSvgMetricContours(svgOf(['M 2 3 L 6 3 6 7 2 7 Z']));
  const relative = parseSvgMetricContours(svgOf(['m 2 3 l 4 0 0 4 -4 0 z']));
  assert.deepEqual(relative, absolute);
  assert.equal(absolute[0].length, 4);
  assert.deepEqual(absolute[0].at(-1)?.to, absolute[0][0].from);
});
