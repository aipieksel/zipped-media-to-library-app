import {SharedWorkspaceClient, SharedWorkspaceError, validateBlobReference} from './client';
import type {SharedDocument} from './client';
import {datasetBlobHashes, stableJson, validateDataset} from './codec';
import type {DatasetData, DatasetName} from './codec';

export const SHARED_METADATA_BYTES = 64 * 1024 * 1024;
const INLINE_METADATA_BYTES = 384 * 1024;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Expand a bounded immutable metadata manifest only after its published chunk hashes verify. */
export async function readDatasetDocument(client: SharedWorkspaceClient, kind: DatasetName): Promise<SharedDocument> {
  const document = await client.read(kind);
  if (document.data === null) {if (document.blobs.length) throw new SharedWorkspaceError('An empty workspace cannot reference files.', 'invalid-data'); return document;}
  const index = document.data;
  if (!object(index) || !Object.hasOwn(index, 'manifest')) {validateDataset(index, kind, document.blobs); return document;}
  if (index.schema !== 1 || index.kind !== kind || Object.keys(index).some(key => !['schema', 'kind', 'manifest'].includes(key))) throw new SharedWorkspaceError('The shared metadata index is invalid.', 'invalid-data');
  const reference = validateBlobReference(index.manifest);
  if (!reference.size || reference.size > SHARED_METADATA_BYTES || reference.mime !== 'application/json' || reference.chunks.some(chunk => !document.blobs.includes(chunk.hash))) throw new SharedWorkspaceError('The shared metadata manifest is invalid.', 'invalid-data');
  let data: DatasetData;
  try {data = validateDataset(JSON.parse(await (await client.download(reference)).text()), kind);}
  catch (error) {if (error instanceof SharedWorkspaceError) throw error; throw new SharedWorkspaceError('The shared metadata manifest is incomplete.', 'invalid-data');}
  const blobs = datasetBlobHashes(data), published = [...new Set([...blobs, ...reference.chunks.map(chunk => chunk.hash)])].sort();
  if (stableJson(published) !== stableJson([...document.blobs].sort())) throw new SharedWorkspaceError('The shared metadata references unpublished or unrelated bytes.', 'invalid-data');
  return {...document, data, blobs};
}

/** One CAS publishes the complete dataset, even when its metadata spans immutable chunks. */
export async function writeDatasetDocument(client: SharedWorkspaceClient, kind: DatasetName, data: DatasetData, blobs: string[], expectedRevision: number): Promise<SharedDocument> {
  validateDataset(data, kind, blobs);
  const payload = new Blob([stableJson(data)], {type: 'application/json'});
  if (payload.size > SHARED_METADATA_BYTES) throw new SharedWorkspaceError('This collection exceeds the 64 MiB metadata manifest limit. Your staged files are retained.', 'limit');
  let publishedData: unknown = data, publishedBlobs = blobs;
  if (payload.size > INLINE_METADATA_BYTES) {
    const manifest = await client.upload(payload);
    publishedData = {schema: 1, kind, manifest};
    publishedBlobs = [...new Set([...blobs, ...manifest.chunks.map(chunk => chunk.hash)])].sort();
  }
  const committed = await client.write(kind, publishedData, publishedBlobs, expectedRevision);
  if (stableJson(committed.data) !== stableJson(publishedData) || stableJson([...committed.blobs].sort()) !== stableJson([...publishedBlobs].sort())) throw new SharedWorkspaceError('The server did not acknowledge the submitted workspace contents.', 'invalid-response');
  return {...committed, data, blobs};
}
