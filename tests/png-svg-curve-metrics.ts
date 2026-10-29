/** Independent, fixture-scoped geometry checks. No production tracing code is reused. */
export interface MetricPoint {x: number; y: number}
export type MetricSegment =
  | {kind: 'L'; from: MetricPoint; to: MetricPoint}
  | {kind: 'Q'; from: MetricPoint; control: MetricPoint; to: MetricPoint}
  | {kind: 'C'; from: MetricPoint; c1: MetricPoint; c2: MetricPoint; to: MetricPoint};
export interface CircleReference {name: string; cx: number; cy: number; r: number}
interface ContourBounds {cx: number; cy: number; rx: number; ry: number}
export interface CircularContourMetrics {
  name: string;
  center: [number, number];
  radius: number;
  bounds: ContourBounds;
  segments: number;
  genuineCurveSegments: number;
  curvedCoverage: number;
  maxFlatDegrees: number;
  windingDegrees: number;
  maxTangentJumpDegrees: number;
  pass: boolean;
}

export const FROZEN_RING_CIRCLES: readonly CircleReference[] = Object.freeze([
  {name: 'first outer ring', cx: 28.4, cy: 29.2, r: 18},
  {name: 'first inner hole', cx: 28.4, cy: 29.2, r: 13.5},
  {name: 'second outer ring', cx: 68.25, cy: 26.75, r: 12},
  {name: 'second inner hole', cx: 68.25, cy: 26.75, r: 8},
]);
export const ROUND_CONTOUR_GUARD = Object.freeze({
  minimumCurvedAngularCoverage: 0.8,
  maximumFlatAngularRunDegrees: 15,
  minimumBowFractionOfAnalyticSagitta: 0.5,
});

const TAU = Math.PI * 2;
const degrees = (radians: number) => radians * 180 / Math.PI;
const subtract = (a: MetricPoint, b: MetricPoint): MetricPoint => ({x: a.x - b.x, y: a.y - b.y});
const length = (a: MetricPoint) => Math.hypot(a.x, a.y);
const distance = (a: MetricPoint, b: MetricPoint) => length(subtract(a, b));
const dot = (a: MetricPoint, b: MetricPoint) => a.x * b.x + a.y * b.y;
const close = (a: MetricPoint, b: MetricPoint) => distance(a, b) <= 1e-8;
const wrap = (angle: number) => angle > Math.PI ? angle - TAU : angle < -Math.PI ? angle + TAU : angle;

/** The approved curve engines serialize M/L/Q/C/Z; unsupported syntax fails visibly. */
function parseSubpaths(data: string): MetricSegment[][] {
  const tokenPattern = /[MLQCZmlqcz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  if (data.replace(tokenPattern, '').replace(/[\s,]/g, '')) throw new Error('Unsupported roundness-check path syntax.');
  const tokens = data.match(tokenPattern) ?? [];
  const paths: MetricSegment[][] = [];
  let index = 0, command: string | undefined, point: MetricPoint = {x: 0, y: 0};
  let start: MetricPoint | undefined, segments: MetricSegment[] = [], segmentCount = 0;
  const number = () => {const value = Number(tokens[index++]); if (!Number.isFinite(value)) throw new Error('Incomplete or non-finite roundness-check path.'); return value;};
  while (index < tokens.length) {
    if (++segmentCount > 2_048) throw new Error('The fixture geometry exceeds the roundness-check segment bound.');
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error('Path lacks its opening move.');
    const upper = command.toUpperCase(), relative = command !== upper;
    const readPoint = (): MetricPoint => {const x = number(), y = number(); return {x: x + (relative ? point.x : 0), y: y + (relative ? point.y : 0)};};
    if (upper === 'M') {
      if (segments.length) throw new Error('Open contours are not accepted by the roundness check.');
      point = readPoint(); start = point; command = relative ? 'l' : 'L';
    } else if (upper === 'Z') {
      if (!start) throw new Error('Closure without a contour.');
      if (!close(point, start)) segments.push({kind: 'L', from: point, to: start});
      if (segments.length) paths.push(segments);
      if (paths.length > 128) throw new Error('The fixture exceeds the roundness-check contour bound.');
      point = start; start = undefined; segments = []; command = undefined;
    } else if (!start) throw new Error('Drawing before a contour move.');
    else if (upper === 'L') {
      const to = readPoint(); segments.push({kind: 'L', from: point, to}); point = to;
    } else if (upper === 'Q') {
      const control = readPoint(), to = readPoint(); segments.push({kind: 'Q', from: point, control, to}); point = to;
    } else if (upper === 'C') {
      const c1 = readPoint(), c2 = readPoint(), to = readPoint(); segments.push({kind: 'C', from: point, c1, c2, to}); point = to;
    } else throw new Error('Unsupported roundness-check command.');
  }
  if (segments.length) throw new Error('Unclosed roundness-check path.');
  return paths;
}

/** Parse the exact serialized SVG. This test helper does not silently discard transforms. */
export function parseSvgMetricContours(svg: string): MetricSegment[][] {
  if (svg.length > 1_048_576) throw new Error('The fixture exceeds the roundness-check byte bound.');
  if (/\btransform\s*=/.test(svg)) throw new Error('Transforms are not supported by this fixture-scoped roundness check.');
  const contours = Array.from(svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)).flatMap(match => parseSubpaths(match[1]));
  if (contours.length > 128 || contours.reduce((sum, contour) => sum + contour.length, 0) > 2_048) throw new Error('The fixture exceeds the roundness-check geometry bound.');
  return contours;
}

export function sampleMetricSegment(segment: MetricSegment, t: number): MetricPoint {
  const u = 1 - t;
  const coordinate = (key: 'x' | 'y') => segment.kind === 'L' ? u * segment.from[key] + t * segment.to[key] :
    segment.kind === 'Q' ? u * u * segment.from[key] + 2 * u * t * segment.control[key] + t * t * segment.to[key] :
      u ** 3 * segment.from[key] + 3 * u * u * t * segment.c1[key] + 3 * u * t * t * segment.c2[key] + t ** 3 * segment.to[key];
  return {x: coordinate('x'), y: coordinate('y')};
}

const sample = (segment: MetricSegment) => Array.from({length: 65}, (_, i) => sampleMetricSegment(segment, i / 64));
function bounds(path: readonly MetricSegment[]): ContourBounds {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const segment of path) for (const point of sample(segment)) {
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  return {cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2};
}

function tangent(segment: MetricSegment, end: boolean): MetricPoint {
  const candidates = segment.kind === 'L' ? [subtract(segment.to, segment.from)] : segment.kind === 'Q' ?
    [end ? subtract(segment.to, segment.control) : subtract(segment.control, segment.from), subtract(segment.to, segment.from)] :
    end ? [subtract(segment.to, segment.c2), subtract(segment.to, segment.c1), subtract(segment.to, segment.from)] :
      [subtract(segment.c1, segment.from), subtract(segment.c2, segment.from), subtract(segment.to, segment.from)];
  return candidates.find(value => length(value) > 1e-8) ?? {x: 0, y: 0};
}

function contourMetrics(path: readonly MetricSegment[], circle: CircleReference): CircularContourMetrics {
  const segments = path.filter(segment => distance(segment.from, segment.to) > 1e-8).map(segment => {
    const points = sample(segment);
    let signedAngle = 0;
    for (let i = 1; i < points.length; i++) signedAngle += wrap(Math.atan2(points[i].y - circle.cy, points[i].x - circle.cx) - Math.atan2(points[i - 1].y - circle.cy, points[i - 1].x - circle.cx));
    const angularSpan = Math.abs(signedAngle);
    const chord = subtract(segment.to, segment.from), chordLength = length(chord);
    let normal = {x: -chord.y / chordLength, y: chord.x / chordLength};
    const midpoint = {x: (segment.from.x + segment.to.x) / 2 - circle.cx, y: (segment.from.y + segment.to.y) / 2 - circle.cy};
    if (dot(normal, midpoint) < 0) normal = {x: -normal.x, y: -normal.y};
    const bow = Math.max(0, ...points.map(point => dot(subtract(point, segment.from), normal)));
    const idealBow = circle.r * (1 - Math.cos(angularSpan / 2));
    const curved = segment.kind !== 'L' && bow > 1e-8 && bow >= idealBow * ROUND_CONTOUR_GUARD.minimumBowFractionOfAnalyticSagitta;
    return {...segment, angularSpan, signedAngle, chord, bow, idealBow, curved};
  });
  const totalAngle = segments.reduce((sum, segment) => sum + segment.angularSpan, 0);
  if (!totalAngle) throw new Error('The matched contour has no angular coverage.');
  const curvedAngle = segments.reduce((sum, segment) => sum + (segment.curved ? segment.angularSpan : 0), 0);
  type MeasuredSegment = (typeof segments)[number];
  const collinear = (a: MeasuredSegment, b: MeasuredSegment) => close(a.to, b.from) && dot(a.chord, b.chord) > 0 && Math.abs(a.chord.x * b.chord.y - a.chord.y * b.chord.x) <= 1e-7 * length(a.chord) * length(b.chord);
  let maxFlatAngle = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].curved) continue;
    let angle = segments[i].angularSpan;
    // Starting at each segment includes runs crossing the closing Z/M seam.
    for (let step = 1; step < segments.length; step++) {
      const previous = segments[(i + step - 1) % segments.length], current = segments[(i + step) % segments.length];
      if (current.curved || !collinear(previous, current)) break;
      angle += current.angularSpan;
    }
    maxFlatAngle = Math.max(maxFlatAngle, angle);
  }
  let maxJoin = 0;
  for (let i = 0; i < segments.length; i++) {
    const a = tangent(segments[i], true), b = tangent(segments[(i + 1) % segments.length], false);
    if (length(a) && length(b)) maxJoin = Math.max(maxJoin, Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (length(a) * length(b))))));
  }
  const curvedCoverage = curvedAngle / totalAngle, maxFlatDegrees = degrees(maxFlatAngle);
  return {name: circle.name, center: [circle.cx, circle.cy], radius: circle.r, bounds: bounds(path), segments: segments.length,
    genuineCurveSegments: segments.filter(segment => segment.curved).length, curvedCoverage, maxFlatDegrees,
    windingDegrees: degrees(segments.reduce((sum, segment) => sum + segment.signedAngle, 0)), maxTangentJumpDegrees: degrees(maxJoin),
    pass: curvedCoverage >= ROUND_CONTOUR_GUARD.minimumCurvedAngularCoverage && maxFlatDegrees <= ROUND_CONTOUR_GUARD.maximumFlatAngularRunDegrees};
}

/** Thresholds and sampling reproduce the calibrated pre-implementation guard. */
export function inspectCircularContours(svg: string, targets: readonly CircleReference[] = FROZEN_RING_CIRCLES): {pass: boolean; contours: CircularContourMetrics[]} {
  const subpaths = parseSvgMetricContours(svg), used = new Set<number>();
  const candidates = subpaths.map((path, index) => ({path, index, bounds: bounds(path)}));
  const contours = targets.map(circle => {
    const matches = candidates.filter(({index, bounds: b}) => !used.has(index) && Math.hypot(b.cx - circle.cx, b.cy - circle.cy) <= 1.5 && Math.abs(b.rx - circle.r) <= 1.5 && Math.abs(b.ry - circle.r) <= 1.5);
    if (matches.length !== 1) throw new Error(`${circle.name}: expected exactly one matching closed contour, found ${matches.length}.`);
    used.add(matches[0].index);
    return contourMetrics(matches[0].path, circle);
  });
  return {pass: contours.every(contour => contour.pass), contours};
}
