import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { runCliProcess, type CliProcessOptions } from '../vendor/ai-cli-integration/src/node/process';
import { CompanionError } from './errors';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
}
function fail(message: string): never { throw new CompanionError('ISOLATION_UNSUPPORTED', message, 422); }
// Canonical current Codex feature gates. Disabling shell/MCP alone does not
// disable hosted image generation, browser/computer access or delegated agents.
export const ISOLATION_FEATURES = [
  'shell_tool', 'shell_snapshot', 'apps', 'plugins', 'remote_plugin', 'hooks',
  'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'computer_use',
  'multi_agent', 'multi_agent_v2', 'multi_agent_v2_dynamic_tools',
  'image_generation', 'view_image', 'code_mode_only', 'code_mode_tool_search',
  'goals', 'memories', 'skill_mcp_dependency_install', 'skill_search', 'tool_suggest',
] as const;
const CONFIG_LAYER_TYPES = new Set(['packagedDefaults', 'mdm', 'system', 'enterpriseManaged', 'user', 'project', 'sessionFlags', 'legacyManagedConfigTomlFromFile', 'legacyManagedConfigTomlFromMdm']);

export function fixedCodexOverrides(cwd: string, mcpNames: readonly string[], profileName: string): string[] {
  return [
    'model_provider="openai"', 'forced_login_method="chatgpt"', 'approval_policy="never"', 'web_search="disabled"',
    'project_doc_max_bytes=0', 'allow_login_shell=false',
    'agents.enabled=false',
    ...ISOLATION_FEATURES.map((name) => `features.${name}=false`),
    'features.code_mode.enabled=false',
    'features.code_mode_host.enabled=false',
    `default_permissions=${JSON.stringify(profileName)}`,
    `permissions.${profileName}.filesystem={":minimal"="read",${JSON.stringify(cwd)}="read"}`,
    `permissions.${profileName}.network.enabled=false`,
    // A single TOML table preserves dotted server names as literal keys and
    // prevents repeated root overrides from replacing an earlier disable.
    `mcp_servers={${mcpNames.map((name) => `${JSON.stringify(name)}={enabled=false}`).join(',')}}`,
  ];
}
export function overrideArgs(overrides: readonly string[]): string[] { return overrides.flatMap((value) => ['-c', value]); }

export function parseMcpNames(text: string): string[] {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return fail('This Codex version did not return a supported MCP catalog. Update Codex and reconnect.'); }
  const rows = Array.isArray(raw) ? raw : object(raw).servers;
  if (!Array.isArray(rows) || rows.length > 128) return fail('Codex returned an unsupported MCP catalog. Update Codex and reconnect.');
  const names = rows.map((row) => object(row).name);
  if (names.some((name) => typeof name !== 'string' || name.length === 0 || name.length > 128 || /[\u0000-\u001f]/.test(name)))
    return fail('Codex returned an invalid MCP configuration. Review it in Codex before connecting Folio.');
  return [...new Set(names as string[])];
}

export interface ConfigSnapshot { config: unknown; requirements: unknown }

function mergeConfig(target: ObjectValue, source: ObjectValue, depth = 0): void {
  if (depth > 40) return fail('Codex returned an excessively nested configuration.');
  for (const [key, value] of Object.entries(source)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return fail('Codex returned an invalid configuration key.');
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const child = { ...object(target[key]) };
      mergeConfig(child, value as ObjectValue, depth + 1); target[key] = child;
    } else target[key] = value;
  }
}

/** Only config RPCs are sent; no thread, tool, filesystem or inference RPC is available here. */
export async function readCodexConfiguration(executable: string, cwd: string, overrides: readonly string[], options: Pick<CliProcessOptions, 'env' | 'signal'> = {}): Promise<ConfigSnapshot> {
  let child: ChildProcessWithoutNullStreams | undefined;
  let configuration: unknown, requirements: unknown;
  let gotConfig = false, gotRequirements = false, initialized = false;
  const send = (value: unknown) => child!.stdin.write(`${JSON.stringify(value)}\n`);
  try {
    await runCliProcess(executable, [...overrideArgs(overrides), 'app-server', '--strict-config', '--listen', 'stdio://'], {
      ...options, cwd, timeoutMs: 30_000, maxOutputBytes: 8 * 1024 * 1024,
      onSpawn(process) {
        child = process;
        send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'folio_companion', title: 'Folio Companion', version: '1.0.0' }, capabilities: { experimentalApi: true } } });
      },
      onStdoutLine(line) {
        if (!line.trim()) return;
        let message: ObjectValue;
        try { message = object(JSON.parse(line)); } catch { return fail('Codex returned an unsupported configuration response. Update Codex and reconnect.'); }
        if ('method' in message && 'id' in message) return fail('Codex requested an unexpected action during its configuration check.');
        if (message.error) return fail('Codex could not validate its configuration. Update Codex or resolve the configuration error in your terminal.');
        if (message.id === 1 && !initialized) {
          initialized = true;
          send({ method: 'initialized', params: {} });
          send({ id: 2, method: 'config/read', params: { includeLayers: true, cwd } });
          send({ id: 3, method: 'configRequirements/read', params: {} });
        } else if (message.id === 2) { configuration = message.result; gotConfig = true; }
        else if (message.id === 3) { requirements = object(message.result).requirements; gotRequirements = true; }
        if (gotConfig && gotRequirements) child!.stdin.end();
      },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error instanceof CompanionError) throw error;
    return fail('Codex could not complete the strict configuration check. Update Codex and check its local configuration, then reconnect.');
  }
  if (!gotConfig || !gotRequirements) return fail('This Codex version does not support Folio’s configuration checks. Update Codex and reconnect.');
  return { config: configuration, requirements };
}

/** Verify effective fixed controls; only user layers are omitted for exec --ignore-user-config. */
export function validateCodexConfiguration(snapshot: ConfigSnapshot, cwd: string, profileName: string): void {
  const response = object(snapshot.config), reported = object(response.config);
  const config: ObjectValue = {};
  const layers = response.layers;
  if (!Array.isArray(layers) || !layers.length) return fail('Codex did not expose its configuration layers. Update Codex before connecting.');
  // Codex config/read lists highest-priority layers first. Merge from the
  // lowest priority so session flags and higher managed layers win correctly.
  for (const value of [...layers].reverse()) {
    const layer = object(value), name = object(layer.name), body = object(layer.config);
    if (!CONFIG_LAYER_TYPES.has(String(name.type))) return fail('Codex has a configuration layer Folio cannot validate. Update the companion.');
    if (layer.disabledReason != null || name.type === 'user') continue;
    // This literal legacy setting takes precedence over named permissions.
    if (body.sandbox_mode != null || body.sandbox_workspace_write != null)
      return fail('A managed or system Codex sandbox setting conflicts with Folio’s restricted profile. Remove the conflict through your Codex configuration before connecting.');
    if (Object.keys(object(object(body.model_providers).openai)).length || body.chatgpt_base_url != null)
      return fail('Managed OpenAI routing cannot be used by this local companion. Use the standard Codex ChatGPT connection.');
    mergeConfig(config, body);
  }
  // Reconstructing the ordered layers models exec's documented user exclusion.
  // Current Codex uses features.view_image; the old tools.view_image key is
  // rejected by --strict-config and is deliberately not passed or required.
  if (reported.model_provider !== 'openai' || reported.approval_policy !== 'never' || reported.web_search !== 'disabled')
    return fail('Codex reported settings different from Folio’s fixed invocation.');
  const features = object(config.features);
  if (ISOLATION_FEATURES.some((name) => features[name] !== false)
    || object(features.code_mode).enabled !== false || object(features.code_mode_host).enabled !== false
    || object(config.agents).enabled !== false)
    return fail('Codex did not apply Folio’s tool restrictions. Review managed settings or update Codex.');
  // The typed response may omit some keys. Whenever it does expose a tool gate,
  // it must agree with the reconstructed execution policy as well.
  const reportedFeatures = object(reported.features);
  if (ISOLATION_FEATURES.some((name) => reportedFeatures[name] != null && reportedFeatures[name] !== false)
    || (reportedFeatures.code_mode != null && reportedFeatures.code_mode !== false && object(reportedFeatures.code_mode).enabled !== false)
    || (reportedFeatures.code_mode_host != null && reportedFeatures.code_mode_host !== false && object(reportedFeatures.code_mode_host).enabled !== false)
    || (object(reported.agents).enabled != null && object(reported.agents).enabled !== false))
    return fail('Codex reported enabled tools that conflict with Folio’s restrictions. The AI request was not started.');
  if (config.forced_login_method !== 'chatgpt'
    || (reported.forced_login_method != null && reported.forced_login_method !== 'chatgpt'))
    return fail('Codex did not enforce ChatGPT-only authentication. The AI request was not started.');
  if (config.model_provider !== 'openai' || config.approval_policy !== 'never' || config.web_search !== 'disabled'
    || config.project_doc_max_bytes !== 0)
    return fail('Codex did not apply Folio’s isolated request settings. Review its configuration before connecting.');
  for (const value of Object.values(object(config.mcp_servers))) {
    if (object(value).enabled !== false) return fail('A configured MCP server remained enabled. Reconnect after reviewing the Codex configuration.');
  }
  if (config.default_permissions !== profileName) return fail('Codex did not select Folio’s restricted permission profile.');
  const profile = object(object(config.permissions)[profileName]);
  const files = object(profile.filesystem), network = object(profile.network);
  if (profile.extends != null || Object.keys(object(profile.workspace_roots)).length
    || Object.keys(files).length !== 2 || files[':minimal'] !== 'read' || files[cwd] !== 'read'
    || network.enabled !== false || Object.keys(network).some((key) => key !== 'enabled'))
    return fail('Codex’s effective filesystem profile grants unexpected access. The AI request was not started.');
  const requirements = object(snapshot.requirements), requiredFeatures = object(requirements.featureRequirements);
  if (ISOLATION_FEATURES.some((name) => requiredFeatures[name] === true)
    || ['code_mode', 'code_mode.enabled', 'code_mode_host', 'code_mode_host.enabled'].some((name) => requiredFeatures[name] === true)
    || object(requiredFeatures.code_mode).enabled === true || object(requiredFeatures.code_mode_host).enabled === true)
    return fail('Your managed Codex policy requires tools this operation cannot use. Ask your administrator for a compatible profile.');
  const allowedProfiles = requirements.allowedPermissionProfiles;
  if (allowedProfiles != null && object(allowedProfiles)[profileName] !== true)
    return fail('Your managed Codex policy does not allow Folio’s restricted permission profile.');
  if (requirements.defaultPermissions != null && requirements.defaultPermissions !== profileName)
    return fail('Your managed Codex default profile conflicts with Folio’s restricted permission profile.');
  if (Array.isArray(requirements.allowedApprovalPolicies) && !requirements.allowedApprovalPolicies.includes('never'))
    return fail('Your managed Codex policy requires approval modes unavailable in this fixed SVG operation.');
  if (requirements.modelProvider != null && requirements.modelProvider !== 'openai')
    return fail('Your managed Codex provider is not the standard OpenAI ChatGPT connection.');
  if (Object.keys(object(object(requirements.modelProviders).openai)).length || requirements.chatgptBaseUrl != null)
    return fail('Your managed OpenAI routing is not supported by this companion.');
  if (Array.isArray(requirements.allowedLoginMethods) && !requirements.allowedLoginMethods.includes('chatgpt'))
    return fail('Your managed Codex policy does not allow ChatGPT sign-in.');
  if (requirements.hooks != null && Object.keys(object(requirements.hooks)).length)
    return fail('Your managed Codex policy requires hooks. Folio cannot run this isolated operation with them.');
}
