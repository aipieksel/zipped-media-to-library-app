import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {sanitizeSvg, recolorSvg, SAVED_SVG_LIMITS} from '../src/saved-svg';
import {createPixelSvg} from '../src/png-svg';
import {normalizeIconPreferences, emptyIconSnapshot, projectSavedIconCollection, UNCATEGORIZED_ICON_FOLDER_ID} from '../src/icon-collection';
import type {SavedIconRecord} from '../src/icon-types';

const dimensions = {width: 24, height: 16};
const svg = (body: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16" ${attrs}>${body}</svg>`;
const parse = (input: string) => new DOMParser({onError() {throw new Error('Invalid test XML');}}).parseFromString(input, 'image/svg+xml');

test('shared validator preserves shapes, strokes, local gradients, clips, alpha and native dimensions', () => {
  const input = svg('<defs><linearGradient id="ink" x1="0%" x2="100%" gradientTransform="rotate(12)"><stop offset="0" stop-color="#1234"/><stop offset="100%" stop-color="rgba(0,0,0,.5)" stop-opacity=".4"/></linearGradient><clipPath id="crop"><rect width="20" height="16"/></clipPath></defs><g transform="translate(1 2) scale(.9)" clip-path="url(#crop)" opacity=".8"><path d="M0 0C1 2 3 4 5 6A2 3 45 0 1 10 8Z" fill="url(#ink)" fill-rule="evenodd" stroke="#abc" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="8" r="3" fill="none" stroke="currentColor"/><ellipse cx="6" cy="8" rx="2" ry="3"/><line x1="0" y1="1" x2="5" y2="1" stroke="#000"/><polygon points="0 0,3 2,0 4"/><polyline points="1 1 2 2"/></g>');
  const result = sanitizeSvg(input, dimensions);
  assert.equal(result.width, 24); assert.equal(result.height, 16); assert.equal(result.pathCount, 1); assert.equal(result.recolorable, true);
  assert.equal(result.outputBytes, new TextEncoder().encode(result.svg).length);
  assert.equal(sanitizeSvg(result.svg, dimensions).svg, result.svg, 'canonical results must be idempotent before browser verification and save');
  assert.match(result.svg, /fill-rule="evenodd"/); assert.match(result.svg, /fill="none"/); assert.match(result.svg, /offset="1"/);
  assert.match(result.svg, /stroke-width="1.5"/); assert.match(result.svg, /gradientTransform="rotate\(12\)"/);
});

test('active markup, external resources, styles, rasters and ambiguous XML fail closed', () => {
  const payloads = [
    '<script>alert(1)</script>', '<foreignObject><div/></foreignObject>', '<image href="data:image/png;base64,AA=="/>',
    '<rect width="2" height="2" onload="alert(1)"/>', '<rect width="2" height="2" style="fill:red"/>',
    '<style>@import url(https://example.test/)</style>', '<use href="#shape"/>', '<animate attributeName="fill"/>',
    '<rect width="2" height="2" fill="url(https://example.test/paint)"/>', '<rect width="2" height="2" fill="url(data:text/html,x)"/>',
    '<rect width="2" height="2" fill="var(--paint)"/>', '<rect width="2" height="2" filter="url(#f)"/>',
    '<g xmlns="http://www.w3.org/1999/xhtml"><path d="M0 0Z"/></g>', '<g xmlns:q="http://www.w3.org/2000/svg"><q:path d="M0 0Z"/></g>',
    '<rect width="2" height="2" fill="red" fill="blue"/>', '<rect width="2" height="2"></rect bad>',
    '<g><path d="M0 0Z"/></svg>', '<g><![CDATA[<script/>]]></g>', '<path d="M0 0Z"/><?task execute?>',
  ];
  for (const payload of payloads) assert.throws(() => sanitizeSvg(svg(payload), dimensions), undefined, payload);
  assert.throws(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY payload SYSTEM "file:///private">]>' + svg('<desc>&payload;</desc>'), dimensions));
  assert.throws(() => sanitizeSvg(svg('<path d="M0 0Z"/>') + svg(''), dimensions));
  assert.throws(() => sanitizeSvg(svg('<desc>&unbound;</desc>'), dimensions));
});

test('geometry rejects changed viewports, nonfinite numbers, malformed paths, arcs and local reference cycles', () => {
  for (const body of ['<rect width="-1" height="2"/>', '<circle r="NaN"/>', '<circle r="1e999"/>', '<rect width="2" height="2" x="999999"/>', '<path d="L0 0"/>', '<path d="M0 0A1 1 0 2 0 3 3"/>', '<path d="M0 0C2 3"/>', '<path d="M0 0X2 3"/>', '<g transform="translate(1) garbage"><path d="M0 0Z"/></g>', '<polygon points="0 0 1"/>', '<rect width="2" height="2" fill="url(#missing)"/>', '<defs><linearGradient id="x"><stop offset="0"/></linearGradient></defs><rect width="2" height="2" clip-path="url(#x)"/>', '<defs><clipPath id="x" clip-path="url(#x)"><rect width="1" height="1"/></clipPath></defs>', '<defs><linearGradient id="x" href="#x"><stop offset="0"/></linearGradient></defs>', '<g id="a"/><g id="a"/>']) assert.throws(() => sanitizeSvg(svg(body), dimensions), undefined, body);
  assert.throws(() => sanitizeSvg(svg('').replace('width="24"', 'width="25"'), dimensions));
  assert.throws(() => sanitizeSvg(svg('').replace('0 0 24 16', '1 0 24 16'), dimensions));
  assert.throws(() => sanitizeSvg(svg(''), {...dimensions, width: 1.5}));
  assert.throws(() => sanitizeSvg(svg(''), {...dimensions, profile: 'unbounded' as 'ai'}));
});

test('allocation bounds distinguish AI artwork from existing local pixel-vector output', () => {
  assert.throws(() => sanitizeSvg(svg('<g>'.repeat(33) + '</g>'.repeat(33)), dimensions), /nesting/);
  const large = svg('<rect width="1" height="1" fill="#000"/>'.repeat(20_001));
  assert.throws(() => sanitizeSvg(large, dimensions), /elements/);
  assert.equal(sanitizeSvg(large, {...dimensions, profile: 'local-vector'}).elementCount, 20_002);
  const overBytes = svg(`<!--${'a'.repeat(SAVED_SVG_LIMITS.aiBytes)}-->`);
  assert.throws(() => sanitizeSvg(overBytes, dimensions), /2 MiB/);
  const pixels = createPixelSvg(new Uint8ClampedArray([10, 20, 30, 128, 0, 0, 0, 0]), 2, 1);
  const local = sanitizeSvg(pixels.svg, {width: 2, height: 1, profile: 'local-vector'});
  assert.match(local.svg, /shape-rendering="crispEdges"/); assert.match(local.svg, /fill-opacity="0.5019607843137255"/);
  assert.throws(() => sanitizeSvg(svg('<g'.concat(' '.repeat(10), Array.from({length: 40}, (_, i) => ` x${i}="1"`).join(''), '/>')), dimensions));
});

test('recoloring retains none, implicit fill, inherited currentColor alpha, explicit alpha and gradient opacity', () => {
  const input = svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#0008" stop-opacity=".3"/><stop offset="1"/></linearGradient></defs><path id="implicit" d="M0 0H4V4Z"/><path id="hole" d="M0 0H4V4Z" fill="none" stroke="currentColor"/><rect id="alpha" width="3" height="2" fill="rgba(1,2,3,0.2)" fill-opacity=".4"/><rect id="gradient" width="2" height="2" fill="url(#g)"/><circle id="transparent" r="1" fill="transparent"/>', 'color="rgba(0,0,0,.25)"');
  const result = recolorSvg(input, '#ff8000', dimensions), document = parse(result.svg);
  const root = document.documentElement!;
  assert.equal(root.getAttribute('fill'), '#ff8000');
  assert.equal(root.getAttribute('color'), 'rgba(255,128,0,0.25)');
  assert.equal(document.getElementById('hole')?.getAttribute('fill'), 'none');
  assert.equal(document.getElementById('hole')?.getAttribute('stroke'), 'currentColor');
  assert.equal(document.getElementById('alpha')?.getAttribute('fill'), 'rgba(255,128,0,0.2)');
  assert.equal(document.getElementById('alpha')?.getAttribute('fill-opacity'), '0.4');
  assert.equal(document.getElementById('gradient')?.getAttribute('fill'), 'url(#g)');
  assert.equal(document.getElementById('transparent')?.getAttribute('fill'), 'rgba(255,128,0,0)');
  const stops = document.getElementsByTagName('stop');
  assert.equal(stops.item(0)?.getAttribute('stop-opacity'), '0.3');
  assert.equal(stops.item(0)?.getAttribute('stop-color'), `rgba(255,128,0,${136 / 255})`);
  assert.equal(stops.item(1)?.getAttribute('stop-color'), '#ff8000');
  assert.equal(sanitizeSvg(result.svg, dimensions).svg, result.svg);
  assert.throws(() => recolorSvg(input, 'url(https://example.test)', dimensions));
  assert.throws(() => recolorSvg(input, '#12345678', dimensions));
});

test('saved preference defaults and tree projection retain separate selection and shared folder identities', () => {
  const prefs = normalizeIconPreferences({selectedId: 'conversion-1', savedSelectedId: 'saved-1', view: 'saved'});
  assert.equal(prefs.selectedId, 'conversion-1'); assert.equal(prefs.savedSelectedId, 'saved-1'); assert.equal(prefs.view, 'saved');
  assert.equal(normalizeIconPreferences().view, 'convert');
  const snapshot = emptyIconSnapshot();
  snapshot.folders = [{id: UNCATEGORIZED_ICON_FOLDER_ID, parentId: null, name: 'Uncategorized', createdAt: 1, favorite: false}, {id: 'shared', parentId: null, name: 'Shared folder', createdAt: 2, favorite: true}];
  snapshot.saved = [{id: 'saved-1', folderId: 'shared', name: 'mark.svg', filename: 'mark.svg', outputBytes: 200, createdAt: 3, favorite: false} as SavedIconRecord];
  const projected = projectSavedIconCollection(snapshot, true);
  assert.equal(projected.pages[0].mime, 'image/svg+xml'); assert.equal(projected.pages[0].id, 'saved-1');
  assert.equal(projected.tree[0].id, 'shared'); assert.equal(projected.tree[0].children[0].pageId, 'saved-1');
  assert.equal(projected.organization.get('saved-1')?.folderId, 'shared'); assert.equal(projected.favoriteFolders.has('shared'), true);
});
