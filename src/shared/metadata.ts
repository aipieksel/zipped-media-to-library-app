import {z} from 'zod';
import {SharedWorkspaceError} from './client';
import type {DataRecord, DatasetName} from './codec';

const id = z.string().min(1).max(8192), text = z.string().max(2000), count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), dimension = z.number().int().min(1).max(4096);
const mode = z.enum(['pixels', 'smooth', 'embedded']);
const engine = z.object({id: text.min(1), name: text.min(1), version: text.min(1)}).passthrough();
const verification = z.object({checkedAt: text.refine(value => Number.isFinite(Date.parse(value))), browser: text.min(1), colorSpace: z.literal('srgb'), pixelFormat: z.literal('rgba8')});
const fidelity = z.object({status: z.enum(['verified', 'different', 'unavailable']), differingPixels: count.nullable(), totalPixels: count.max(4194304), reason: text.optional()}).refine(value => value.status === 'unavailable' ? value.differingPixels === null : value.differingPixels !== null && value.differingPixels <= value.totalPixels && (value.status === 'verified') === (value.differingPixels === 0));
const result = z.object({mode, width: dimension, height: dimension, rectangleCount: count.nullable(), pathCount: count.nullable(), engine, verification, sourceFormat: z.enum(['png', 'webp']).optional(), sourceBytes: count.max(20 * 1024 * 1024), outputBytes: count.max(24 * 1024 * 1024), fidelity, warnings: z.array(text).max(2000)}).passthrough().refine(value => value.width * value.height <= 4194304 && value.fidelity.totalPixels === value.width * value.height);
const schemas: Record<DatasetName, Record<string, z.ZodType>> = {
  library: {
    archives: z.object({id, rootId: id, parentId: id.nullable(), mountPath: z.string().max(8192), name: text, createdAt: count, fileCount: count, pageCount: count, imageCount: count.optional(), byteSize: count, warnings: z.array(text).max(20000)}).passthrough(),
    pages: z.object({id, archiveId: id, rootId: id, path: z.string().max(8192), label: text, isIndex: z.boolean(), size: count, kind: z.enum(['html', 'image']).optional(), modifiedAt: count.optional(), createdAt: count.optional(), addedAt: count.optional(), mime: text.optional()}).passthrough(),
    files: z.object({id, archiveId: id, path: z.string().max(8192), mime: z.string().max(200), remote: z.undefined().optional()}).passthrough(),
    snapshots: z.object({pageId: id, width: revision.max(32768), height: revision.max(32768), createdAt: count, warnings: z.array(text).max(20000)}).passthrough(),
    folders: z.object({id, name: text.min(1), createdAt: count}).passthrough(),
    organization: z.object({id, favorite: z.boolean(), folderId: id.nullable()}).passthrough(),
    prefs: z.object({key: z.enum(['favoriteFolders', 'hiddenCloudRoots']), value: z.array(id).max(20000)}),
  },
  icons: {
    icons: z.object({id, folderId: id, name: text.min(1), sourceName: text.min(1), sourcePath: z.string().max(8192), filename: text.min(1), size: count.max(20 * 1024 * 1024), sourceMime: z.enum(['image/png', 'image/webp']).optional(), lastModified: count, createdAt: count, updatedAt: count, mode, revision, status: z.enum(['cancelled', 'error', 'ready']), message: text, favorite: z.boolean(), result: result.optional(), claim: z.undefined().optional(), sharedPending: z.boolean().optional()}).passthrough(),
    folders: z.object({id, parentId: id.nullable(), name: text.min(1), createdAt: count, favorite: z.boolean()}).passthrough(),
    sources: z.object({id}).passthrough(), outputs: z.object({id, revision}).passthrough(), savedSources: z.object({id}).passthrough(), savedSvg: z.object({id, revision}).passthrough(),
    savedIcons: z.object({id, folderId: id, name: text.min(1), filename: text.min(1), createdAt: count, updatedAt: count, favorite: z.boolean(), revision, width: dimension, height: dimension, outputBytes: count.max(24 * 1024 * 1024), baseOutputBytes: count.max(24 * 1024 * 1024), source: z.object({kind: z.enum(['icons', 'images']), id, revision: revision.optional(), name: text.min(1), mime: z.enum(['image/png', 'image/webp', 'image/jpeg']), size: count.max(20 * 1024 * 1024)}), provenance: z.discriminatedUnion('kind', [z.object({kind: z.literal('conversion'), mode, engine}), z.object({kind: z.literal('ai'), provider: text.min(1), model: text.min(1), generatedAt: text.optional()})]), recolorable: z.boolean(), color: z.string().regex(/^#[a-fA-F0-9]{6}$/).nullable(), fidelity, verification: verification.optional(), baseFidelity: fidelity, baseVerification: verification.optional()}).passthrough().refine(value => value.width * value.height <= 4194304 && value.fidelity.totalPixels === value.width * value.height && value.baseFidelity.totalPixels === value.width * value.height),
  },
};

export function validateRecordMetadata(kind: DatasetName, store: string, row: DataRecord): void {
  if (!schemas[kind][store]?.safeParse(row).success) throw new SharedWorkspaceError(`The shared ${store} record has invalid or incomplete metadata.`, 'invalid-data');
}
