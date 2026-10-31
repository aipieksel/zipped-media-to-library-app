import { z } from 'zod';
import { cliReasoningEfforts } from '../../vendor/ai-cli-integration/src/contracts';

export const AI_COMPANION_PORT = 8798;
export const AI_PROTOCOL_VERSION = 1 as const;
export const AI_LIMITS = Object.freeze({
  imageBytes: 8 * 1024 * 1024,
  pixels: 4_194_304,
  side: 4096,
  requestBytes: 14 * 1024 * 1024,
  svgBytes: 2 * 1024 * 1024,
  instructions: 4000,
  statusTimeoutMs: 120_000,
  timeoutMs: 300_000,
});

export type AiProviderId = 'codex' | 'grok';
export type AiOperation = 'recreate-svg' | 'clean-svg';
export type AiReasoning = typeof cliReasoningEfforts[number];
export interface AiConnection { port: number; token: string }

const provider = z.enum(['codex', 'grok']);
const reasoning = z.enum(cliReasoningEfforts);
const model = z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/+-]*$/);
const requestId = z.uuid();
const boundedSvg = z.string().max(AI_LIMITS.svgBytes).refine(
  (value) => new TextEncoder().encode(value).byteLength <= AI_LIMITS.svgBytes,
  'The SVG exceeds the 2 MiB AI limit. Choose Recreate to use the source image.',
);

export const aiPreferencesSchema = z.strictObject({
  port: z.number().int().min(1024).max(65535).default(AI_COMPANION_PORT),
  provider: provider.default('codex'),
  model: model.nullable().default(null),
  reasoning: reasoning.nullable().default(null),
});
export type AiPreferences = z.infer<typeof aiPreferencesSchema>;
export function defaultAiPreferences(): AiPreferences { return aiPreferencesSchema.parse({}); }
export function normalizeAiPreferences(value: unknown): AiPreferences {
  const parsed = aiPreferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultAiPreferences();
}

export const aiSelectionSchema = z.strictObject({ provider, model, reasoning });
export type AiSelection = z.infer<typeof aiSelectionSchema>;
export const aiImageSchema = z.strictObject({
  name: z.string().min(1).max(255).refine((name) => !/[\u0000-\u001f\u007f]/.test(name), 'Invalid image filename.'),
  mimeType: z.literal('image/png'),
  dataBase64: z.string().min(4).max(Math.ceil(AI_LIMITS.imageBytes / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  width: z.number().int().min(1).max(AI_LIMITS.side),
  height: z.number().int().min(1).max(AI_LIMITS.side),
}).refine((image) => image.width * image.height <= AI_LIMITS.pixels, 'Image exceeds 4 megapixels.');
export type AiImageInput = z.infer<typeof aiImageSchema>;
export const aiSvgRequestSchema = aiSelectionSchema.extend({
  requestId,
  operation: z.enum(['recreate-svg', 'clean-svg']),
  image: aiImageSchema,
  currentSvg: boundedSvg.optional(),
  instructions: z.string().max(AI_LIMITS.instructions).default(''),
}).refine((request) => request.operation !== 'clean-svg' || Boolean(request.currentSvg?.trim()),
  'Clean up requires an existing SVG. Choose Recreate to work from the image.');
export type AiSvgRequest = z.infer<typeof aiSvgRequestSchema>;
export const aiTestRequestSchema = aiSelectionSchema.extend({ requestId });

export const aiSvgAnswerSchema = z.strictObject({
  svg: boundedSvg.min(1),
  summary: z.string().max(1200),
});
export const aiSvgResultSchema = aiSvgAnswerSchema.extend({
  requestId,
  provider: z.literal('codex'),
  model,
  createdAt: z.iso.datetime(),
});
export type AiSvgResult = z.infer<typeof aiSvgResultSchema>;
export const aiModelSchema = z.strictObject({
  id: model,
  name: z.string().max(256),
  description: z.string().max(4000),
  defaultReasoning: reasoning,
  reasoning: z.array(z.strictObject({ id: reasoning, description: z.string().max(2000) })).min(1).max(8),
  supportsImages: z.boolean(),
});
export type AiModel = z.infer<typeof aiModelSchema>;
export const aiProviderStatusSchema = z.strictObject({
  id: provider,
  name: z.string().max(80),
  installed: z.boolean(),
  version: z.string().max(128).nullable(),
  auth: z.enum(['chatgpt', 'not-signed-in', 'api-key', 'unknown', 'not-checked']),
  ready: z.boolean(),
  reason: z.string().max(1000).nullable(),
  models: z.array(aiModelSchema).max(1000),
  capabilities: z.array(z.enum(['recreate-svg', 'clean-svg'])).max(2),
});
export type AiProviderStatus = z.infer<typeof aiProviderStatusSchema>;
export const aiCompanionStatusSchema = z.strictObject({
  protocolVersion: z.literal(AI_PROTOCOL_VERSION),
  companionVersion: z.string().max(64),
  activeRequestId: requestId.nullable(),
  providers: z.array(aiProviderStatusSchema).max(2),
  checkedAt: z.iso.datetime(),
});
export type AiCompanionStatus = z.infer<typeof aiCompanionStatusSchema>;
export const aiTestResultSchema = z.strictObject({
  requestId,
  ok: z.literal(true),
  provider: z.literal('codex'),
  model,
  message: z.string().max(1000),
  checkedAt: z.iso.datetime(),
});
export type AiTestResult = z.infer<typeof aiTestResultSchema>;
export const aiErrorSchema = z.strictObject({
  error: z.strictObject({ code: z.string().max(80), message: z.string().max(1500) }),
  requestId: requestId.optional(),
});

export const AI_SVG_OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['svg', 'summary'],
  properties: {
    svg: { type: 'string', maxLength: AI_LIMITS.svgBytes },
    summary: { type: 'string', maxLength: 1200 },
  },
} as const;
