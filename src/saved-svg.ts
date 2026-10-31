import {DOMParser} from '@xmldom/xmldom';
import type {Element as XmlElement, Node as XmlNode} from '@xmldom/xmldom';
import {PNG_SVG_LIMITS} from './png-svg';
import {validateSvgPath} from './png-svg-trace';

export interface SvgValidationOptions {
  width: number;
  height: number;
  /** Only the local converter owner may opt into the larger existing geometry budget. */
  profile?: 'ai' | 'local-vector';
}
export interface ValidatedSvg {
  svg: string;
  width: number;
  height: number;
  outputBytes: number;
  elementCount: number;
  pathCount: number;
  recolorable: true;
}
export const SAVED_SVG_LIMITS = Object.freeze({aiBytes: 2 * 1024 * 1024, aiElements: 20_000, localElements: 150_010, depth: 32, pathCommands: 200_000, attributes: 32});
const namespace = 'http://www.w3.org/2000/svg';
const numberPattern = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
const numberExpression = new RegExp(`^${numberPattern}$`);
const numberTokens = new RegExp(numberPattern, 'g');
const identifier = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
const shapes = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const elements = new Set(['svg', 'g', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'title', 'desc', ...shapes]);
const common = new Set(['id', 'fill', 'stroke', 'color', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'transform', 'clip-path', 'shape-rendering', 'color-interpolation', 'vector-effect']);
const specific: Record<string, Set<string>> = {
  svg: new Set(['xmlns', 'width', 'height', 'viewBox', 'version', 'preserveAspectRatio']),
  g: new Set(), defs: new Set(), title: new Set(), desc: new Set(),
  path: new Set(['d']), rect: new Set(['x', 'y', 'width', 'height', 'rx', 'ry']),
  circle: new Set(['cx', 'cy', 'r']), ellipse: new Set(['cx', 'cy', 'rx', 'ry']),
  line: new Set(['x1', 'y1', 'x2', 'y2']), polyline: new Set(['points']), polygon: new Set(['points']),
  linearGradient: new Set(['x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform', 'spreadMethod']),
  radialGradient: new Set(['cx', 'cy', 'r', 'fx', 'fy', 'fr', 'gradientUnits', 'gradientTransform', 'spreadMethod']),
  stop: new Set(['offset', 'stop-color', 'stop-opacity']), clipPath: new Set(['clipPathUnits']),
};
const namedColors = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
const encoder = new TextEncoder();
function invalid(message: string): never {throw new Error(message);}
function numeric(value: string, minimum = -32768, maximum = 32768): number {
  if (value.length > 64 || !numberExpression.test(value) || !Number.isFinite(Number(value)) || Number(value) < minimum || Number(value) > maximum) invalid('The SVG contains an invalid or out-of-range number.');
  return Number(value);
}
function numbers(value: string, limit: number): number[] {
  const tokens = value.match(numberTokens) ?? [];
  if (!tokens.length || tokens.length > limit || value.replace(numberTokens, '').replace(/[\s,]/g, '')) invalid('The SVG contains invalid numeric geometry.');
  return tokens.map(token => numeric(token));
}
function escaped(value: string): string {return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');}
function checkDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > PNG_SVG_LIMITS.maxSide || height > PNG_SVG_LIMITS.maxSide || width * height > PNG_SVG_LIMITS.maxPixels) invalid('The SVG must retain supported native image dimensions.');
}

/** Bound XML allocation before the maintained parser builds its tree. This is not the XML parser. */
function preflight(input: string, maxElements: number): void {
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?/i.test(input)) invalid('SVG document declarations, entities, CDATA and processing instructions are unsupported.');
  let depth = 0, count = 0, at = 0;
  while ((at = input.indexOf('<', at)) !== -1) {
    if (input.startsWith('<!--', at)) {
      const end = input.indexOf('-->', at + 4); if (end === -1) invalid('The SVG contains an unfinished comment.');
      at = end + 3; continue;
    }
    let end = at + 1, quote = '';
    for (; end < input.length; end++) {
      const character = input[end];
      if (quote) {if (character === quote) quote = '';}
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
      else if (character === '<') invalid('The SVG contains malformed XML markup.');
    }
    if (end === input.length) invalid('The SVG contains an unfinished element.');
    const tag = input.slice(at + 1, end);
    if (tag.startsWith('!')) invalid('The SVG contains an unsupported XML declaration.');
    if (tag.startsWith('/')) {if (--depth < 0) invalid('The SVG contains malformed nesting.');}
    else {
      if (++count > maxElements) invalid('The SVG contains too many elements.');
      if (depth + 1 > SAVED_SVG_LIMITS.depth) invalid('The SVG contains excessive nesting.');
      if (!/\/\s*$/.test(tag)) depth++;
    }
    at = end + 1;
  }
  if (depth !== 0) invalid('The SVG contains incomplete nesting.');
}

interface Paint {value: string; alpha: number; reference?: string}
function paint(value: string, allowReference = true, allowNone = true): Paint {
  if (allowNone && value === 'none') return {value, alpha: 1};
  if (value.toLowerCase() === 'currentcolor') return {value: 'currentColor', alpha: 1};
  if (value === 'transparent') return {value, alpha: 0};
  if (namedColors.has(value.toLowerCase())) return {value: value.toLowerCase(), alpha: 1};
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    const alpha = value.length === 5 ? parseInt(value[4].repeat(2), 16) / 255 : value.length === 9 ? parseInt(value.slice(7), 16) / 255 : 1;
    return {value: value.toLowerCase(), alpha};
  }
  const rgb = /^(rgb|rgba)\(\s*([^()]*)\s*\)$/i.exec(value);
  if (rgb) {
    const tokens = rgb[2].split(',').map(token => token.trim());
    if (tokens.length !== (rgb[1].toLowerCase() === 'rgba' ? 4 : 3)) invalid('The SVG contains an unsupported paint value. Use hex or rgb colors.');
    const channels = tokens.slice(0, 3).map(token => token.endsWith('%') ? numeric(token.slice(0, -1), 0, 100) * 2.55 : numeric(token, 0, 255));
    const alpha = tokens.length === 4 ? numeric(tokens[3], 0, 1) : 1;
    return {value: `${alpha === 1 ? 'rgb' : 'rgba'}(${channels.join(',')}${alpha === 1 ? '' : ',' + alpha})`, alpha};
  }
  const reference = /^url\(\s*['"]?#([A-Za-z_][A-Za-z0-9_.-]{0,127})['"]?\s*\)$/.exec(value);
  if (allowReference && reference) return {value: `url(#${reference[1]})`, alpha: 1, reference: reference[1]};
  return invalid('The SVG contains an unsupported paint or external resource. Use local gradients and explicit colors.');
}

function transform(value: string): string {
  const pattern = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/g;
  let match: RegExpExecArray | null, last = 0, count = 0;
  const output: string[] = [];
  while ((match = pattern.exec(value))) {
    if (value.slice(last, match.index).replace(/[\s,]/g, '') || ++count > 32) invalid('The SVG contains an unsupported transform.');
    const args = numbers(match[2], 6), name = match[1];
    if (!(name === 'matrix' ? args.length === 6 : name === 'translate' || name === 'scale' ? args.length === 1 || args.length === 2 : name === 'rotate' ? args.length === 1 || args.length === 3 : args.length === 1)) invalid('The SVG contains an incomplete transform.');
    output.push(`${name}(${args.join(' ')})`); last = pattern.lastIndex;
  }
  if (!count || value.slice(last).replace(/[\s,]/g, '')) invalid('The SVG contains an invalid transform.');
  return output.join(' ');
}

interface SafeElement {name: string; attrs: Map<string, string>; children: SafeElement[]; text?: string}
interface ParsedSvg {root: SafeElement; elementCount: number; pathCount: number; maxBytes: number}
function parseSvg(input: string, options: SvgValidationOptions): ParsedSvg {
  checkDimensions(options.width, options.height);
  if (options.profile !== undefined && options.profile !== 'ai' && options.profile !== 'local-vector') invalid('Choose a supported SVG validation profile.');
  const local = options.profile === 'local-vector';
  const maxBytes = local ? PNG_SVG_LIMITS.maxSvgBytes : SAVED_SVG_LIMITS.aiBytes;
  const maxElements = local ? SAVED_SVG_LIMITS.localElements : SAVED_SVG_LIMITS.aiElements;
  if (typeof input !== 'string' || !input.trim() || input.length > maxBytes || encoder.encode(input).byteLength > maxBytes) invalid(`The SVG exceeds the ${local ? '24' : '2'} MiB output limit or is empty.`);
  preflight(input, maxElements);
  let document;
  try {document = new DOMParser({locator: false, onError() {throw new Error('Invalid XML.');}}).parseFromString(input, 'image/svg+xml');}
  catch {return invalid('The SVG contains malformed XML.');}
  const sourceRoot = document.documentElement;
  if (!sourceRoot || sourceRoot.nodeName !== 'svg' || sourceRoot.namespaceURI !== namespace || sourceRoot.getAttribute('xmlns') !== namespace) invalid('The result must be one SVG document with the SVG namespace.');
  for (let index = 0; index < document.childNodes.length; index++) {
    const node = document.childNodes.item(index)!;
    if (node !== sourceRoot && node.nodeType !== 8 && !(node.nodeType === 3 && !node.nodeValue?.trim())) invalid('The SVG has content outside its root element.');
  }
  const ids = new Map<string, string>();
  const references: {id: string; kind: 'paint' | 'clip'}[] = [];
  let elementCount = 0, pathCount = 0, commands = 0;
  const walk = (node: XmlElement, parent: string | null, inClip: boolean): SafeElement => {
    const name = node.nodeName;
    if (!elements.has(name) || node.namespaceURI !== namespace || name.includes(':') || (name === 'svg' && parent !== null)) invalid('The SVG contains unsupported or non-vector content.');
    if (++elementCount > maxElements || node.attributes.length > SAVED_SVG_LIMITS.attributes) invalid('The SVG contains excessive elements or attributes.');
    if ((name === 'stop' && parent !== 'linearGradient' && parent !== 'radialGradient') || ((name === 'linearGradient' || name === 'radialGradient' || name === 'clipPath') && parent !== 'defs') || (name === 'defs' && parent !== 'svg')) invalid('The SVG contains an unsupported definition structure.');
    if (parent === 'defs' && !['linearGradient', 'radialGradient', 'clipPath'].includes(name)) invalid('Only local gradients and clip paths are supported in SVG definitions.');
    if ((parent === 'linearGradient' || parent === 'radialGradient') && name !== 'stop') invalid('The SVG gradient contains unsupported content.');
    if (parent && (shapes.has(parent) || ['stop', 'title', 'desc'].includes(parent))) invalid('The SVG contains invalid nested geometry.');
    const attrs = new Map<string, string>();
    for (let index = 0; index < node.attributes.length; index++) {
      const attr = node.attributes.item(index)!, key = attr.name;
      let value = attr.value.trim();
      if ((!common.has(key) && !specific[name]?.has(key)) || key.includes(':') || (key === 'xmlns' && name !== 'svg')) invalid(`The SVG contains an unsupported attribute: ${key.slice(0, 60)}.`);
      if (key === 'xmlns') {if (value !== namespace) invalid('The SVG namespace changed.');}
      else if (key === 'id') {if (!identifier.test(value) || ids.has(value)) invalid('The SVG contains an invalid or duplicate identifier.'); ids.set(value, name);}
      else if (key === 'd') {commands += validateSvgPath(value); pathCount++; if (commands > SAVED_SVG_LIMITS.pathCommands) invalid('The SVG contains too many path segments.');}
      else if (key === 'points') {const points = numbers(value, SAVED_SVG_LIMITS.pathCommands * 2); if (points.length % 2 || points.length < (name === 'polygon' ? 6 : 4)) invalid('The SVG contains an incomplete point list.'); commands += points.length / 2; if (commands > SAVED_SVG_LIMITS.pathCommands) invalid('The SVG contains too many point segments.'); value = points.join(' ');}
      else if (key === 'fill' || key === 'stroke' || key === 'stop-color' || key === 'color') {
        const result = paint(value, key === 'fill' || key === 'stroke', key === 'fill' || key === 'stroke'); value = result.value;
        if (result.reference) references.push({id: result.reference, kind: 'paint'});
      } else if (key === 'clip-path') {
        if (inClip || name === 'clipPath') invalid('Nested clip references are unsupported.');
        if (value !== 'none') {const result = paint(value); if (!result.reference) invalid('The SVG clip must reference a local clip path.'); references.push({id: result.reference, kind: 'clip'}); value = result.value;}
      } else if (key === 'transform' || key === 'gradientTransform') value = transform(value);
      else if (key === 'width' || key === 'height') {
        const dimension = numeric(value.replace(/px$/, ''), 0); if (name === 'svg' && dimension !== options[key]) invalid('The SVG changed the native image dimensions.'); value = String(dimension);
      } else if (key === 'viewBox') {if (numbers(value, 4).join(' ') !== `0 0 ${options.width} ${options.height}`) invalid('The SVG changed the native viewBox.'); value = `0 0 ${options.width} ${options.height}`;}
      else if (key === 'version') {if (value !== '1.1' && value !== '1.0' && value !== '2.0') invalid('The SVG version is unsupported.');}
      else if (key === 'preserveAspectRatio') {if (!/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(value)) invalid('The SVG has an unsupported aspect ratio.');}
      else if (key === 'opacity' || key.endsWith('-opacity')) value = String(numeric(value, 0, 1));
      else if (key === 'fill-rule' || key === 'clip-rule') {if (value !== 'nonzero' && value !== 'evenodd') invalid('The SVG contains an unsupported fill rule.');}
      else if (key === 'stroke-linecap') {if (!['butt', 'round', 'square'].includes(value)) invalid('The SVG contains an unsupported line cap.');}
      else if (key === 'stroke-linejoin') {if (!['miter', 'round', 'bevel'].includes(value)) invalid('The SVG contains an unsupported line join.');}
      else if (key === 'stroke-dasharray') {if (value !== 'none') {const parts = numbers(value, 128); if (parts.some(part => part < 0)) invalid('The SVG contains a negative dash length.'); value = parts.join(' ');}}
      else if (key === 'shape-rendering') {if (!['auto', 'crispEdges', 'geometricPrecision', 'optimizeSpeed'].includes(value)) invalid('The SVG contains an unsupported rendering hint.');}
      else if (key === 'color-interpolation') {if (!['sRGB', 'linearRGB', 'auto'].includes(value)) invalid('The SVG contains an unsupported color space.');}
      else if (key === 'vector-effect') {if (value !== 'non-scaling-stroke' && value !== 'none') invalid('The SVG contains an unsupported vector effect.');}
      else if (key === 'gradientUnits' || key === 'clipPathUnits') {if (!['userSpaceOnUse', 'objectBoundingBox'].includes(value)) invalid('The SVG contains unsupported coordinate units.');}
      else if (key === 'spreadMethod') {if (!['pad', 'reflect', 'repeat'].includes(value)) invalid('The SVG contains an unsupported gradient spread.');}
      else if (key === 'offset') {const percent = value.endsWith('%'); const offset = numeric(percent ? value.slice(0, -1) : value, 0, percent ? 100 : 1); value = String(percent ? offset / 100 : offset);}
      else {
        const gradient = name === 'linearGradient' || name === 'radialGradient';
        const percent = gradient && value.endsWith('%');
        const minimum = ['r', 'rx', 'ry', 'fr', 'stroke-width'].includes(key) ? 0 : key === 'stroke-miterlimit' ? 1 : -32768;
        value = String(numeric(percent ? value.slice(0, -1) : value, minimum)) + (percent ? '%' : '');
      }
      attrs.set(key, value);
    }
    if (name === 'svg') {attrs.set('xmlns', namespace); attrs.set('width', String(options.width)); attrs.set('height', String(options.height)); attrs.set('viewBox', `0 0 ${options.width} ${options.height}`);}
    const required = name === 'path' ? ['d'] : name === 'rect' ? ['width', 'height'] : name === 'circle' ? ['r'] : name === 'ellipse' ? ['rx', 'ry'] : name === 'polygon' || name === 'polyline' ? ['points'] : name === 'stop' ? ['offset'] : [];
    if (required.some(key => !attrs.has(key))) invalid('The SVG contains incomplete geometry.');
    const children: SafeElement[] = []; let text = '';
    for (let index = 0; index < node.childNodes.length; index++) {
      const child: XmlNode = node.childNodes.item(index)!;
      if (child.nodeType === 1) children.push(walk(child as XmlElement, name, inClip || name === 'clipPath'));
      else if (child.nodeType === 3) {if (name === 'title' || name === 'desc') {text += child.nodeValue ?? ''; if (text.length > 1024) invalid('The SVG description is too long.');} else if (child.nodeValue?.trim()) invalid('The SVG contains unsupported text.');}
      else if (child.nodeType !== 8) invalid('The SVG contains unsupported XML nodes.');
    }
    return {name, attrs, children, ...(text ? {text} : {})};
  };
  const root = walk(sourceRoot, null, false);
  for (const reference of references) {
    const target = ids.get(reference.id);
    if (reference.kind === 'clip' ? target !== 'clipPath' : target !== 'linearGradient' && target !== 'radialGradient') invalid('The SVG references a missing or incompatible local definition.');
  }
  return {root, elementCount, pathCount, maxBytes};
}

function output(parsed: ParsedSvg, options: SvgValidationOptions): ValidatedSvg {
  const serialize = (node: SafeElement): string => {
    const attrs = [...node.attrs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => ` ${key}="${escaped(value)}"`).join('');
    return node.children.length || node.text || node.name === 'svg' ? `<${node.name}${attrs}>${node.text ? escaped(node.text) : ''}${node.children.map(serialize).join('')}</${node.name}>` : `<${node.name}${attrs}/>`;
  };
  const svg = serialize(parsed.root), outputBytes = encoder.encode(svg).byteLength;
  if (outputBytes > parsed.maxBytes) invalid('The normalized SVG exceeds its output limit.');
  return {svg, width: options.width, height: options.height, outputBytes, elementCount: parsed.elementCount, pathCount: parsed.pathCount, recolorable: true};
}

/** One safe geometry contract for the Node companion and browser. Never inserts markup into a live DOM. */
export function sanitizeSvg(input: string, options: SvgValidationOptions): ValidatedSvg {return output(parseSvg(input, options), options);}

/** Solid recoloring derives from immutable validated geometry; hidden/none paints and alpha stay intact. */
export function recolorSvg(immutableBase: string, color: string, options: SvgValidationOptions): ValidatedSvg {
  if (!/^#[\da-f]{6}$/i.test(color)) invalid('Choose a six-digit hex color.');
  const normalized = color.toLowerCase(), parsed = parseSvg(immutableBase, options);
  const channels = [1, 3, 5].map(offset => parseInt(normalized.slice(offset, offset + 2), 16));
  const walk = (node: SafeElement): void => {
    for (const key of ['fill', 'stroke', 'stop-color', 'color']) {
      const value = node.attrs.get(key); if (!value || value === 'none') continue;
      const original = paint(value, key === 'fill' || key === 'stroke', key === 'fill' || key === 'stroke');
      // currentColor must keep inheriting its color's alpha; replacing it with solid paint loses that alpha.
      if (!original.reference && original.value !== 'currentColor') node.attrs.set(key, original.alpha === 1 ? normalized : `rgba(${channels.join(',')},${original.alpha})`);
    }
    if (node.name === 'stop' && !node.attrs.has('stop-color')) node.attrs.set('stop-color', normalized);
    node.children.forEach(walk);
  };
  walk(parsed.root);
  // SVG's default fill is black. Override only that default; explicit none and gradient paints remain.
  if (!parsed.root.attrs.has('fill')) parsed.root.attrs.set('fill', normalized);
  if (!parsed.root.attrs.has('color') || parsed.root.attrs.get('color') === 'currentColor') parsed.root.attrs.set('color', normalized);
  return output(parsed, options);
}
