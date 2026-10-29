import { fitCubic } from 'fit-curve';
import { PNG_SVG_LIMITS, PngSvgError } from './png-svg';
import { PNG_SVG_TRACE_LIMITS, validateTraceInput } from './png-svg-trace';

export type ContourPoint = [number, number];
type CubicCurve = [ContourPoint, ContourPoint, ContourPoint, ContourPoint];
type EdgePair = readonly [number, number];

export interface AlphaContourOptions {
  onProgress?: (percent: number) => void;
}

export interface AlphaContours {
  /** Closed loops without a repeated final vertex, in native pixel coordinates. */
  contours: ContourPoint[][];
  vertexCount: number;
  ambiguousCells: number;
}

export interface AlphaContourSvg {
  svg: string;
  pathCount: number;
  contourCount: number;
  curveCount: number;
  vertexCount: number;
}

export const ALPHA_CONTOUR_LIMITS = Object.freeze({
  maxVertices: 200_000,
  maxVerticesPerContour: 8192,
  maxContours: 20_000,
  maxFitPoints: 512,
  maxFitCallbacks: 100_000,
  maxFitPointVisits: 10_000_000,
  fitErrorSquared: 0.0625,
});

const ISO_ALPHA = 127.5;
const RETRY_GUIDANCE = ' Use Pixel vectors or Embedded bitmap for this original.';
const CELL_EDGES: ReadonlyArray<readonly EdgePair[] | null> = [
  [], [[0, 3]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[2, 3]],
  [[2, 3]], [[0, 2]], null, [[1, 2]], [[3, 1]], [[0, 1]], [[0, 3]], [],
];

function contourLimit(message: string): never {
  throw new PngSvgError(message + RETRY_GUIDANCE, 'trace-limit');
}

function invalidContour(message: string): never {
  throw new PngSvgError(message + RETRY_GUIDANCE, 'invalid-svg');
}

/**
 * Interpolate the half-alpha contour between native pixel centers. A ring of
 * transparent samples closes image-edge contours without resizing the source.
 * Shared grid edges have one canonical vertex, so no coordinate rounding is
 * needed to stitch neighboring cells.
 */
export function extractAlphaContours(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: AlphaContourOptions = {},
): AlphaContours {
  validateTraceInput(pixels, width, height);
  const gridWidth = width + 2;
  const gridHeight = height + 2;
  const horizontalCount = (gridWidth - 1) * gridHeight;
  const vertices: ContourPoint[] = [];
  const neighbors: number[][] = [];
  const vertexByEdge = new Map<number, number>();
  let ambiguousCells = 0;

  const alpha = (x: number, y: number): number => {
    if (x === 0 || y === 0 || x === gridWidth - 1 || y === gridHeight - 1) return 0;
    return pixels[((y - 1) * width + x - 1) * 4 + 3];
  };
  const crossing = (x: number, y: number, vertical: boolean): number => {
    const key = vertical ? horizontalCount + y * gridWidth + x : y * (gridWidth - 1) + x;
    const existing = vertexByEdge.get(key);
    if (existing !== undefined) return existing;
    if (vertices.length >= ALPHA_CONTOUR_LIMITS.maxVertices) {
      contourLimit('This image has too many alpha-contour vertices.');
    }
    const first = alpha(x, y);
    const second = alpha(x + (vertical ? 0 : 1), y + (vertical ? 1 : 0));
    const fraction = (ISO_ALPHA - first) / (second - first);
    if (!(fraction > 0 && fraction < 1)) invalidContour('The alpha contour contains an invalid crossing.');
    const index = vertices.length;
    vertices.push([x - 0.5 + (vertical ? 0 : fraction), y - 0.5 + (vertical ? fraction : 0)]);
    neighbors.push([]);
    vertexByEdge.set(key, index);
    return index;
  };

  options.onProgress?.(0);
  for (let y = 0; y < gridHeight - 1; y++) {
    for (let x = 0; x < gridWidth - 1; x++) {
      const a = alpha(x, y);
      const b = alpha(x + 1, y);
      const c = alpha(x + 1, y + 1);
      const d = alpha(x, y + 1);
      const mask = (a > ISO_ALPHA ? 1 : 0) | (b > ISO_ALPHA ? 2 : 0) |
        (c > ISO_ALPHA ? 4 : 0) | (d > ISO_ALPHA ? 8 : 0);
      let pairs = CELL_EDGES[mask];
      if (pairs === null) {
        ambiguousCells++;
        // Bilinear asymptotic decider. An exact saddle tie connects foreground
        // diagonals (eight-connected foreground, four-connected background).
        const determinant = (a - ISO_ALPHA) * (c - ISO_ALPHA) - (b - ISO_ALPHA) * (d - ISO_ALPHA);
        pairs = determinant > 0 || (determinant === 0 && mask === 5)
          ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
      }
      const edge = (index: number): number => {
        if (index === 0) return crossing(x, y, false);
        if (index === 1) return crossing(x + 1, y, true);
        if (index === 2) return crossing(x, y + 1, false);
        return crossing(x, y, true);
      };
      for (const [firstEdge, secondEdge] of pairs) {
        const first = edge(firstEdge);
        const second = edge(secondEdge);
        neighbors[first].push(second);
        neighbors[second].push(first);
      }
    }
    if (y % 16 === 0) options.onProgress?.(90 * (y + 1) / (gridHeight - 1));
  }

  if (neighbors.some(list => list.length !== 2)) invalidContour('The alpha contour is open or branched.');
  const visited = new Uint8Array(vertices.length);
  const contours: ContourPoint[][] = [];
  for (let origin = 0; origin < vertices.length; origin++) {
    if (visited[origin]) continue;
    const contour: ContourPoint[] = [];
    let previous = -1;
    let current = origin;
    do {
      if (visited[current]) invalidContour('The alpha contour contains an unexpected join.');
      visited[current] = 1;
      contour.push(vertices[current]);
      const next = neighbors[current][0] === previous ? neighbors[current][1] : neighbors[current][0];
      previous = current;
      current = next;
      if (contour.length > ALPHA_CONTOUR_LIMITS.maxVerticesPerContour) {
        contourLimit('An alpha contour exceeds the per-loop vertex limit.');
      }
    } while (current !== origin);
    if (contour.length < 3) invalidContour('The alpha contour is degenerate.');
    contours.push(contour);
    if (contours.length > ALPHA_CONTOUR_LIMITS.maxContours) contourLimit('This image has too many alpha contours.');
  }
  options.onProgress?.(100);
  return { contours, vertexCount: vertices.length, ambiguousCells };
}

function subtract(first: ContourPoint, second: ContourPoint): ContourPoint {
  return [first[0] - second[0], first[1] - second[1]];
}

function unitVector(vector: ContourPoint): ContourPoint {
  const length = Math.hypot(vector[0], vector[1]);
  if (!Number.isFinite(length) || length === 0) invalidContour('The alpha contour has a degenerate tangent.');
  return [vector[0] / length, vector[1] / length];
}

function lineDistance(point: ContourPoint, first: ContourPoint, second: ContourPoint): number {
  const direction = subtract(second, first);
  const length = Math.hypot(direction[0], direction[1]);
  if (length === 0) invalidContour('The alpha contour has a degenerate corner.');
  return Math.abs(direction[0] * (point[1] - first[1]) - direction[1] * (point[0] - first[0])) / length;
}

interface FitBudget { callbacks: number; pointVisits: number; commands: number }

// fit-curve 0.2.0's inspected runtime accepts a fifth progress callback; its
// published declaration omits that argument. Keep the adapter local and typed.
const fitCubicWithProgress = fitCubic as (
  points: ContourPoint[],
  leftTangent: ContourPoint,
  rightTangent: ContourPoint,
  squaredError: number,
  onProgress: (info: { points: ContourPoint[] }) => void,
) => CubicCurve[];

function fitContour(points: ContourPoint[], budget: FitBudget): CubicCurve[] {
  const count = points.length;
  const cumulative = [0];
  for (let index = 0; index < count; index++) {
    const first = points[index];
    const second = points[(index + 1) % count];
    const length = Math.hypot(first[0] - second[0], first[1] - second[1]);
    if (!Number.isFinite(length) || length === 0) invalidContour('The alpha contour contains a degenerate edge.');
    cumulative.push(cumulative[index] + length);
  }
  const perimeter = cumulative[count];
  const sample = (distance: number): ContourPoint => {
    const arc = ((distance % perimeter) + perimeter) % perimeter;
    let low = 0;
    let high = count;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (cumulative[middle] <= arc) low = middle;
      else high = middle;
    }
    const first = points[low];
    const second = points[(low + 1) % count];
    const fraction = (arc - cumulative[low]) / (cumulative[low + 1] - cumulative[low]);
    return [first[0] + fraction * (second[0] - first[0]), first[1] + fraction * (second[1] - first[1])];
  };
  const tangent = (index: number): ContourPoint => {
    const window = Math.min(0.75, perimeter / 8);
    return unitVector(subtract(sample(cumulative[index] + window), sample(cumulative[index] - window)));
  };

  // Sharp turns count as corners only when both short arms are nearly straight.
  // Curved small islands therefore keep smooth tangents instead of gaining
  // corners merely because their curvature is high at this pixel scale.
  const candidates: Array<{ index: number; angle: number }> = [];
  if (perimeter >= 6) {
    for (let index = 0; index < count; index++) {
      const arc = cumulative[index];
      const point = points[index];
      const first = sample(arc - 1.5);
      const second = sample(arc + 1.5);
      const incoming = unitVector(subtract(point, first));
      const outgoing = unitVector(subtract(second, point));
      const angle = Math.acos(Math.max(-1, Math.min(1, incoming[0] * outgoing[0] + incoming[1] * outgoing[1])));
      if (angle < 50 * Math.PI / 180) continue;
      let deviation = 0;
      for (const offset of [0.25, 0.5, 0.75, 1, 1.25]) {
        deviation = Math.max(deviation, lineDistance(sample(arc - offset), first, point), lineDistance(sample(arc + offset), point, second));
      }
      if (deviation <= 0.08) candidates.push({ index, angle });
    }
  }
  const hardCorners = new Set<number>();
  for (const candidate of candidates.sort((first, second) => second.angle - first.angle)) {
    const tooClose = [...hardCorners].some(index => {
      const distance = Math.abs(cumulative[index] - cumulative[candidate.index]);
      return Math.min(distance, perimeter - distance) < 1;
    });
    if (!tooClose) hardCorners.add(candidate.index);
  }

  const breaks = new Set([0, ...hardCorners]);
  for (let quarter = 1; quarter < 4; quarter++) {
    const target = perimeter * quarter / 4;
    let closest = 0;
    for (let index = 1; index < count; index++) {
      if (Math.abs(cumulative[index] - target) < Math.abs(cumulative[closest] - target)) closest = index;
    }
    breaks.add(closest);
  }
  // Endpoint-inclusive spans never contain more than maxFitPoints samples.
  for (let index = 0; index < count; index += ALPHA_CONTOUR_LIMITS.maxFitPoints - 1) breaks.add(index);
  const indices = [...breaks].sort((first, second) => first - second);
  const curves: CubicCurve[] = [];
  budget.commands += 2; // Every closed subcontour also emits M and Z.
  if (budget.commands > PNG_SVG_TRACE_LIMITS.maxPathCommands) contourLimit('The alpha contours need too many SVG commands.');
  for (let span = 0; span < indices.length; span++) {
    const first = indices[span];
    const last = span + 1 < indices.length ? indices[span + 1] : count;
    const input = points.slice(first, last + 1);
    if (last === count) input.push(points[0]);
    if (input.length < 2 || input.length > ALPHA_CONTOUR_LIMITS.maxFitPoints) {
      contourLimit('An alpha-contour fitting span exceeds its input limit.');
    }
    const left = hardCorners.has(first)
      ? unitVector(subtract(sample(cumulative[first] + 1.5), points[first])) : tangent(first);
    const end = last % count;
    let right: ContourPoint;
    if (hardCorners.has(end)) right = unitVector(subtract(sample(cumulative[end] - 1.5), points[end]));
    else {
      const endTangent = tangent(end);
      right = [-endTangent[0], -endTangent[1]];
    }
    const fitted = fitCubicWithProgress(input, left, right, ALPHA_CONTOUR_LIMITS.fitErrorSquared, info => {
      budget.callbacks++;
      budget.pointVisits += info.points.length;
      if (budget.callbacks > ALPHA_CONTOUR_LIMITS.maxFitCallbacks || budget.pointVisits > ALPHA_CONTOUR_LIMITS.maxFitPointVisits) {
        contourLimit('The alpha-contour fitter reached its work limit.');
      }
    });
    if (!Array.isArray(fitted) || fitted.length === 0) invalidContour('The alpha-contour fitter returned no curves.');
    for (const curve of fitted) {
      if (!Array.isArray(curve) || curve.length !== 4 || curve.some(point =>
        !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value) || Math.abs(value) > 32768))) {
        invalidContour('The alpha-contour fitter returned invalid coordinates.');
      }
      if (++budget.commands > PNG_SVG_TRACE_LIMITS.maxPathCommands) contourLimit('The alpha contours need too many SVG commands.');
      curves.push(curve);
    }
  }
  return curves;
}

/**
 * Return editable cubic geometry for the supplied alpha field. Eligibility and
 * foreground-color restoration belong to the caller. Every retained contour,
 * including holes and small islands, shares one evenodd path. Native SVG
 * rasterization remains the separate fidelity check; fitting is approximate.
 */
export function createAlphaContourSvg(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: AlphaContourOptions = {},
): AlphaContourSvg {
  let lastProgress = -1;
  const reportProgress = (percent: number): void => {
    const wholePercent = Math.floor(percent);
    if (wholePercent <= lastProgress) return;
    lastProgress = wholePercent;
    options.onProgress?.(wholePercent);
  };
  const extracted = extractAlphaContours(pixels, width, height, {
    onProgress: percent => reportProgress(percent * 0.45),
  });
  const budget: FitBudget = { callbacks: 0, pointVisits: 0, commands: 0 };
  const opening = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  const pathOpening = '<path fill="#000000" fill-rule="evenodd" d="';
  const closing = '"/></svg>';
  const paths: string[] = [];
  let outputBytes = opening.length + pathOpening.length + closing.length;
  let curveCount = 0;
  const coordinate = (point: ContourPoint): string => point.map(value => String(Math.round(value * 100_000) / 100_000)).join(' ');
  for (const [index, contour] of extracted.contours.entries()) {
    const curves = fitContour(contour, budget);
    const path = `M ${coordinate(curves[0][0])} ${curves.map(curve =>
      `C ${coordinate(curve[1])} ${coordinate(curve[2])} ${coordinate(curve[3])}`).join(' ')} Z`;
    // Serialization uses ASCII only, so string length equals UTF-8 byte length.
    outputBytes += path.length + (index > 0 ? 1 : 0);
    if (outputBytes > PNG_SVG_LIMITS.maxSvgBytes) {
      throw new PngSvgError('The alpha-contour SVG exceeds the 24 MiB output limit.' + RETRY_GUIDANCE, 'svg-limit');
    }
    paths.push(path);
    curveCount += curves.length;
    reportProgress(45 + 50 * (index + 1) / extracted.contours.length);
  }
  const svg = paths.length ? opening + pathOpening + paths.join(' ') + closing : opening + '</svg>';
  reportProgress(100);
  return { svg, pathCount: paths.length ? 1 : 0, contourCount: paths.length, curveCount, vertexCount: extracted.vertexCount };
}
