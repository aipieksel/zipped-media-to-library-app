export const SETTINGS_SECTIONS = ['profile', 'ai', 'appearance', 'workspace', 'accounts'] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number];

export function settingsSectionFromHash(hash: string): SettingsSection | null {
  if (hash === '#settings' || hash === '#settings/') return 'profile';
  const section = hash.match(/^#settings\/([^/?]+)$/)?.[1];
  return SETTINGS_SECTIONS.includes(section as SettingsSection) ? section as SettingsSection : null;
}
