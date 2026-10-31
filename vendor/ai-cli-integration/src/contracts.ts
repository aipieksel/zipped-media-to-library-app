import { z } from 'zod';

export const cliEngines = ['codex', 'grok'] as const;
export const cliReasoningEfforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;

export const cliProviderSettingsSchema = z.strictObject({
  enabled: z.boolean().default(false),
  model: z.string().trim().min(1).nullable().default(null),
  reasoning: z.enum(cliReasoningEfforts).nullable().default(null),
});

export const cliIntegrationSettingsSchema = z.strictObject({
  providers: z.strictObject({
    codex: cliProviderSettingsSchema.default({ enabled: false, model: null, reasoning: null }),
    grok: cliProviderSettingsSchema.default({ enabled: false, model: null, reasoning: null }),
  }),
  defaultEngine: z.enum(cliEngines).nullable().default(null),
});

export type CliEngine = (typeof cliEngines)[number];
export type CliReasoningEffort = (typeof cliReasoningEfforts)[number];
export type CliProviderSettings = z.infer<typeof cliProviderSettingsSchema>;
export type CliIntegrationSettings = z.infer<typeof cliIntegrationSettingsSchema>;

export interface CliReasoningOption {
  id: CliReasoningEffort;
  description: string;
}

export interface CliModel {
  id: string;
  name: string;
  description: string;
  defaultReasoning: CliReasoningEffort;
  reasoning: CliReasoningOption[];
  supportsImages: boolean;
}

export interface CliEngineCatalog {
  available: boolean;
  executable: string | null;
  version: string | null;
  models: CliModel[];
  error: string | null;
}

export interface CliCatalog {
  generatedAt: string;
  engines: Record<CliEngine, CliEngineCatalog>;
}

export function defaultCliIntegrationSettings(): CliIntegrationSettings {
  return cliIntegrationSettingsSchema.parse({
    providers: { codex: {}, grok: {} },
    defaultEngine: null,
  });
}

export function cliSettingsIssue(settings: CliIntegrationSettings): string | null {
  const enabled = cliEngines.filter((engine) => settings.providers[engine].enabled);
  if (enabled.some((engine) => !settings.providers[engine].model || !settings.providers[engine].reasoning)) {
    return 'Every enabled CLI provider needs a model and reasoning effort.';
  }
  if (enabled.length > 0 && (!settings.defaultEngine || !settings.providers[settings.defaultEngine].enabled)) {
    return 'Choose an enabled default CLI provider.';
  }
  if (enabled.length === 0 && settings.defaultEngine !== null) {
    return 'The default CLI provider must be cleared when all providers are disabled.';
  }
  return null;
}
