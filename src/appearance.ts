/** Interface colors only. Artwork, imported documents and preview planes are not theme inputs. */
export type AppearancePalette = {
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
};

export const DEFAULT_APPEARANCE: Readonly<AppearancePalette> = Object.freeze({
  accent: '#b94c2d', background: '#f3f4f2', surface: '#ffffff',
  text: '#252a2d', muted: '#626c69', border: '#e4e7e5',
});

export const APPEARANCE_FIELDS = [
  {key: 'accent', label: 'Accent', description: 'Buttons, links and selected controls'},
  {key: 'background', label: 'Background', description: 'The workspace canvas'},
  {key: 'surface', label: 'Surfaces', description: 'Sidebar, panels and fields'},
  {key: 'text', label: 'Text', description: 'Headings and primary text'},
  {key: 'muted', label: 'Secondary text', description: 'Labels and supporting text'},
  {key: 'border', label: 'Borders', description: 'Dividers and control outlines'},
] as const;

export type AppearanceField = keyof AppearancePalette;
export type AppearanceValidation =
  | {valid: true; palette: AppearancePalette}
  | {valid: false; errors: Partial<Record<AppearanceField, string>>; message: string};

const HEX_COLOR = /^#[\da-f]{6}$/i;
const colorKeys = APPEARANCE_FIELDS.map(field => field.key);
const channels = (color: string): [number, number, number] => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number];
const hex = (values: readonly number[]) => `#${values.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;

function luminance(color: string): number {
  const [r, g, b] = channels(color).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG relative-luminance contrast ratio, with finite opaque sRGB colors only. */
export function colorContrast(first: string, second: string): number {
  if (!HEX_COLOR.test(first) || !HEX_COLOR.test(second)) throw new TypeError('Use a six-digit hex color.');
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function validateAppearance(value: unknown): AppearanceValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {valid: false, errors: {}, message: 'Choose a color for each appearance setting.'};
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !colorKeys.includes(key as AppearanceField))) {
    return {valid: false, errors: {}, message: 'Only the six supported appearance colors can be saved.'};
  }
  const palette = {} as AppearancePalette;
  const errors: Partial<Record<AppearanceField, string>> = {};
  for (const {key} of APPEARANCE_FIELDS) {
    const color = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!HEX_COLOR.test(color)) errors[key] = 'Use a six-digit hex color, such as #b94c2d.';
    else palette[key] = color.toLowerCase();
  }
  if (Object.keys(errors).length) return {valid: false, errors, message: 'Check the highlighted color values.'};
  for (const key of ['text', 'muted'] as const) {
    const failed = (['background', 'surface'] as const).filter(surface => colorContrast(palette[key], palette[surface]) < 4.5);
    if (failed.length) {
      errors[key] = `${key === 'text' ? 'Text' : 'Secondary text'} needs at least 4.5:1 contrast with ${failed.map(surface => surface === 'surface' ? 'surfaces' : 'the background').join(' and ')}.`;
    }
  }
  if (Object.keys(errors).length) return {valid: false, errors, message: 'Adjust text or background colors so the interface stays readable. Your last valid preview is unchanged.'};
  return {valid: true, palette};
}

/** Invalid or missing persisted data cannot inject CSS or leave the application unreadable. */
export function normalizeAppearance(value: unknown): AppearancePalette {
  const result = validateAppearance(value);
  return {...(result.valid ? result.palette : DEFAULT_APPEARANCE)};
}

export function sameAppearance(first: AppearancePalette, second: AppearancePalette): boolean {
  return colorKeys.every(key => first[key] === second[key]);
}

function mix(first: string, second: string, amount: number): string {
  const a = channels(first), b = channels(second);
  return hex(a.map((value, index) => value * (1 - amount) + b[index] * amount));
}

function alpha(color: string, opacity: number): string {
  return `rgba(${channels(color).join(',')},${opacity})`;
}

function readable(color: string, backgrounds: readonly string[], fallback: string): string {
  const candidates = [fallback, '#000000', '#ffffff'];
  const target = candidates.reduce((best, candidate) => {
    const score = (value: string) => Math.min(...backgrounds.map(background => colorContrast(value, background)));
    return score(candidate) > score(best) ? candidate : best;
  }, fallback);
  for (let step = 0; step <= 40; step++) {
    const candidate = mix(color, target, step / 40);
    if (backgrounds.every(background => colorContrast(candidate, background) >= 4.5)) return candidate;
  }
  return target;
}

const OPTIONAL_TOKENS = [
  '--field-background', '--surface-hover', '--surface-soft', '--surface-active',
  '--selection-background', '--selection-text', '--accent-hover', '--accent-text', '--accent-border',
  '--focus', '--border-color', '--border-strong', '--border-soft', '--body-text', '--secondary-text', '--icon-color', '--icon-hover', '--workspace-background',
  '--scrollbar', '--shadow', '--shadow-soft', '--shadow-strong', '--scrim', '--drop-background',
  '--overlay-surface', '--loading-surface', '--toast-background', '--toast-text', '--toast-muted', '--toast-hover',
  '--warning-text', '--warning-soft', '--warning-border', '--success-text', '--success-soft', '--success-border',
  '--danger', '--danger-hover', '--danger-foreground', '--danger-text', '--danger-soft', '--danger-border',
] as const;

/** Pure token generation; the current default keeps each existing CSS fallback hue intact. */
export function appearanceCssVariables(value: AppearancePalette): Record<string, string> {
  const validated = validateAppearance(value);
  if (!validated.valid) throw new TypeError(validated.message);
  const palette = validated.palette;
  const foreground = colorContrast(palette.accent, '#ffffff') >= colorContrast(palette.accent, '#000000') ? '#ffffff' : '#000000';
  const tokens: Record<string, string> = {
    '--accent': palette.accent, '--canvas': palette.background, '--surface': palette.surface,
    '--text': palette.text, '--muted': palette.muted, '--line': palette.border,
    '--accent-foreground': foreground,
    '--accent-soft': sameAppearance(palette, DEFAULT_APPEARANCE) ? '#fcf0e9' : mix(palette.surface, palette.accent, 0.12),
  };
  if (sameAppearance(palette, DEFAULT_APPEARANCE)) return tokens;

  const backgrounds = [palette.surface, palette.background];
  const selected = mix(palette.surface, palette.accent, 0.12);
  const hover = mix(palette.surface, palette.text, 0.055);
  const soft = mix(palette.surface, palette.text, 0.025);
  const danger = '#a7342a';
  Object.assign(tokens, {
    '--field-background': palette.surface, '--surface-hover': hover, '--surface-soft': soft,
    '--surface-active': mix(palette.surface, palette.text, 0.09),
    '--selection-background': selected, '--selection-text': readable(palette.accent, [selected], palette.text),
    '--accent-hover': mix(palette.accent, foreground === '#ffffff' ? '#000000' : '#ffffff', 0.12),
    '--accent-text': readable(palette.accent, backgrounds, palette.text),
    '--accent-border': mix(palette.surface, palette.accent, 0.45),
    '--focus': readable(palette.accent, backgrounds, palette.text),
    '--border-color': palette.border, '--border-strong': mix(palette.border, palette.text, 0.28), '--border-soft': mix(palette.surface, palette.border, 0.65),
    '--body-text': palette.text, '--workspace-background': palette.background,
    '--secondary-text': palette.muted, '--icon-color': palette.muted, '--icon-hover': palette.text,
    '--scrollbar': mix(palette.surface, palette.text, 0.28),
    '--shadow': alpha('#000000', 0.18), '--shadow-soft': alpha('#000000', 0.08), '--shadow-strong': alpha('#000000', 0.3),
    '--scrim': alpha('#000000', 0.4), '--drop-background': alpha(selected, 0.88),
    '--overlay-surface': alpha(palette.surface, 0.96), '--loading-surface': alpha(palette.surface, 0.94),
    '--toast-background': palette.text, '--toast-text': palette.surface,
    '--toast-muted': mix(palette.surface, palette.text, 0.15), '--toast-hover': mix(palette.text, palette.surface, 0.15),
    '--danger': danger, '--danger-hover': mix(danger, '#000000', 0.12), '--danger-foreground': '#ffffff',
  });
  for (const [status, color] of [['warning', '#94601c'], ['success', '#40805b'], ['danger', danger]] as const) {
    const statusBackground = mix(palette.surface, color, 0.1);
    tokens[`--${status}-soft`] = statusBackground;
    tokens[`--${status}-text`] = readable(color, [...backgrounds, statusBackground], palette.text);
    tokens[`--${status}-border`] = mix(palette.surface, color, 0.35);
  }
  return tokens;
}

/** Applies only allowlisted interface variables to one element; never visits images, SVGs or iframes. */
export function applyAppearance(palette: AppearancePalette, target?: HTMLElement): void {
  const tokens = appearanceCssVariables(palette);
  const element = target ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  if (!element) return;
  for (const token of OPTIONAL_TOKENS) element.style.removeProperty(token);
  for (const [name, value] of Object.entries(tokens)) element.style.setProperty(name, value);
}

export function resetAppearance(target?: HTMLElement): void {
  applyAppearance({...DEFAULT_APPEARANCE}, target);
}
