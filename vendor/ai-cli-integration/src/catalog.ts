import {
  cliReasoningEfforts,
  type CliModel,
  type CliReasoningEffort,
  type CliReasoningOption,
} from './contracts';

const REASONING = new Set<string>(cliReasoningEfforts);

function effort(value: unknown, fallback: CliReasoningEffort): CliReasoningEffort {
  return typeof value === 'string' && REASONING.has(value)
    ? value as CliReasoningEffort
    : fallback;
}

export function parseCodexModels(output: string): CliModel[] {
  const parsed = JSON.parse(output) as { models?: unknown } | unknown[];
  const rows = Array.isArray(parsed) ? parsed : parsed.models;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const rawId = row.slug ?? row.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id) return [];
    if (row.visibility === 'hide' || row.visibility === 'none' || row.show_in_picker === false) return [];
    const fallback = effort(row.default_reasoning_level ?? row.default_reasoning_effort ?? row.defaultReasoningEffort, 'medium');
    const candidateOptions = row.supported_reasoning_levels ?? row.supported_reasoning_efforts ?? row.supportedReasoningEfforts;
    const rawOptions = Array.isArray(candidateOptions) ? candidateOptions : [];
    const modalities = row.input_modalities ?? row.inputModalities;
    const reasoning = rawOptions.flatMap((option): CliReasoningOption[] => {
      if (!option || typeof option !== 'object') return [];
      const item = option as Record<string, unknown>;
      if (typeof item.effort !== 'string' || !REASONING.has(item.effort)) return [];
      const id = item.effort as CliReasoningEffort;
      return [{
        id,
        description: typeof item.description === 'string' ? item.description : '',
      }];
    });
    return [{
      id,
      name: typeof row.display_name === 'string' ? row.display_name : id,
      description: typeof row.description === 'string' ? row.description : '',
      defaultReasoning: fallback,
      reasoning: reasoning.length > 0 ? reasoning : [{ id: fallback, description: '' }],
      // Codex's published model protocol explicitly uses text+image for legacy
      // catalogs without modality metadata. Explicit text-only entries stay so.
      supportsImages: !Array.isArray(modalities) || modalities.includes('image'),
    }];
  });
}

const GROK_REASONING: CliReasoningOption[] = [
  { id: 'low', description: 'Faster response with lighter reasoning.' },
  { id: 'high', description: 'Deeper reasoning for complex work.' },
];

export function parseGrokModels(output: string): CliModel[] {
  const seen = new Set<string>();
  const models: CliModel[] = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*[*-]\s+([^\s(]+)/);
    const id = match?.[1]?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({
      id,
      name: id,
      description: line.includes('(default)') ? 'Current default Grok model.' : 'Available Grok model.',
      defaultReasoning: 'high',
      reasoning: GROK_REASONING,
      supportsImages: false,
    });
  }
  return models;
}
