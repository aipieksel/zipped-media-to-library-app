import {SharedWorkspaceClient, validateBlobReference} from './client';
import {stableJson} from './codec';
import type {DataRecord} from './codec';

const isReference = (value: unknown): boolean => !!value && typeof value === 'object' && (value as {kind?: unknown}).kind === 'folio-blob-v1';

/** Immutable pack layout may change while original file contents stay exactly the same. */
export async function sameMigrationRecord(existing: DataRecord, incoming: DataRecord, original: DataRecord | undefined, client: SharedWorkspaceClient, preserveCurrentNames = false): Promise<boolean> {
  for (const key of new Set([...Object.keys(existing), ...Object.keys(incoming)])) {
    if (preserveCurrentNames && (key === 'name' || key === 'filename')) continue;
    if (stableJson(existing[key]) === stableJson(incoming[key])) continue;
    if (!isReference(existing[key]) || !isReference(incoming[key]) || !(original?.[key] instanceof Blob)) return false;
    const before = validateBlobReference(existing[key]), after = validateBlobReference(incoming[key]), source = original[key] as Blob;
    if (before.size !== after.size || before.mime !== after.mime || source.size !== after.size) return false;
    const [sharedBytes, originalBytes] = await Promise.all([(await client.download(before)).arrayBuffer(), source.arrayBuffer()]);
    const left = new Uint8Array(sharedBytes), right = new Uint8Array(originalBytes);
    if (left.length !== right.length || left.some((value, index) => value !== right[index])) return false;
  }
  return true;
}
