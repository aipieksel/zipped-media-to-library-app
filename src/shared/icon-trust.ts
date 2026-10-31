import {createEmbeddedRasterSvg, inspectRaster} from '../raster-input';
import {sanitizeSvg} from '../saved-svg';
import {PNG_SVG_LIMITS} from '../png-svg';
import type {IconRecord, SavedIconRecord} from '../icon-types';
import {DOMParser} from '@xmldom/xmldom';
import {SHARED_BLOB_FIELDS, stableJson} from './codec';
import {SharedWorkspaceError} from './client';

/** Verification belongs to immutable bytes and dimensions, never a remote status label. */
export function sharedIconIdentity(item: IconRecord | SavedIconRecord, source: unknown, output: unknown): string {
  const refs = (record: unknown) => record && typeof record === 'object' ? (record as Record<string, unknown>)[SHARED_BLOB_FIELDS] : null;
  return stableJson({id: item.id, revision: item.revision, width: 'result' in item ? item.result?.width : (item as SavedIconRecord).width, height: 'result' in item ? item.result?.height : (item as SavedIconRecord).height, mode: 'mode' in item ? item.mode : item.provenance, source: refs(source), output: refs(output)});
}

/** Reject active/non-vector content. Preserve already safe SVG bytes without normalization. */
export async function validateSharedIconSvg(blob: Blob, source: Blob, item: IconRecord | SavedIconRecord): Promise<string> {
  const conversion = 'mode' in item;
  const width = conversion ? item.result?.width : item.width, height = conversion ? item.result?.height : item.height;
  if (!width || !height || !blob.size || blob.size > PNG_SVG_LIMITS.maxSvgBytes || !source.size || source.size > PNG_SVG_LIMITS.maxInputBytes) throw new SharedWorkspaceError('The shared artwork has invalid bytes or dimensions.', 'invalid-svg');
  const svg = await blob.text();
  const embedded = conversion ? item.mode === 'embedded' : item.provenance.kind === 'conversion' && item.provenance.mode === 'embedded';
  if (embedded) {
    const bytes = new Uint8Array(await source.arrayBuffer()), raster = inspectRaster(bytes);
    if (raster.width !== width || raster.height !== height || svg !== createEmbeddedRasterSvg(bytes, width, height)) throw new SharedWorkspaceError('The shared bitmap wrapper does not contain the exact original image.', 'invalid-svg');
  } else {
    sanitizeSvg(svg, {width, height, profile: !conversion && item.provenance.kind === 'ai' ? 'ai' : 'local-vector'});
    // The sanitizer may supply missing dimensions. Exact downloaded bytes must already declare them.
    const root = new DOMParser({locator: false, onError() {throw new Error('Invalid shared SVG.');}}).parseFromString(svg, 'image/svg+xml').documentElement;
    if (!root || !root.hasAttribute('width') || !root.hasAttribute('height') || !root.hasAttribute('viewBox')) throw new SharedWorkspaceError('The shared SVG must declare its native width, height and viewBox.', 'invalid-svg');
  }
  return svg;
}
