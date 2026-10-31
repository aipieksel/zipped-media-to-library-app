import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_APPEARANCE, appearanceCssVariables, applyAppearance, colorContrast, normalizeAppearance, resetAppearance, validateAppearance} from '../src/appearance';
import type {AppearancePalette} from '../src/appearance';

const dark: AppearancePalette = {
  accent: '#ffb08a', background: '#121715', surface: '#1c2420', text: '#f0f5f1', muted: '#b5c4ba', border: '#46534b',
};

test('appearance retains the exact six default colors and accepts a readable dark palette', () => {
  assert.deepEqual(DEFAULT_APPEARANCE, {
    accent: '#b94c2d', background: '#f3f4f2', surface: '#ffffff', text: '#252a2d', muted: '#626c69', border: '#e4e7e5',
  });
  assert.equal(validateAppearance(DEFAULT_APPEARANCE).valid, true);
  assert.deepEqual(validateAppearance(dark), {valid: true, palette: dark});
  assert.equal(colorContrast('#000000', '#ffffff'), 21);
  assert.equal(colorContrast('#ffffff', '#ffffff'), 1);
  assert.deepEqual(normalizeAppearance({...DEFAULT_APPEARANCE, accent: ' #B94C2D '}), DEFAULT_APPEARANCE);
});

test('untrusted appearance data is restricted to six opaque hex colors', () => {
  for (const input of [null, [], '', {}, {...DEFAULT_APPEARANCE, css: 'body{display:none}'}, JSON.parse('{"__proto__":{"color":"red"}}')]) {
    assert.equal(validateAppearance(input).valid, false);
  }
  for (const color of ['red', '#fff', '#ff00ff80', 'transparent', 'var(--text)', 'url(https://example.test)', '#fff;display:none', 123, null]) {
    const result = validateAppearance({...DEFAULT_APPEARANCE, accent: color});
    assert.equal(result.valid, false, String(color));
    assert.deepEqual(normalizeAppearance({...DEFAULT_APPEARANCE, accent: color}), DEFAULT_APPEARANCE);
  }
  assert.throws(() => appearanceCssVariables({...DEFAULT_APPEARANCE, surface: 'url(https://example.test)'}), /color/);
  assert.throws(() => colorContrast('white', '#000000'), /six-digit/);
});

test('unreadable text pairs fail with field errors instead of changing the active theme', () => {
  const result = validateAppearance({...DEFAULT_APPEARANCE, text: '#eeeeee', muted: '#dddddd'});
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.errors.text ?? '', /4\.5:1/);
    assert.match(result.errors.muted ?? '', /4\.5:1/);
    assert.match(result.message, /last valid preview/);
  }
  assert.equal(validateAppearance({...DEFAULT_APPEARANCE, background: '#ffffff', surface: '#ffffff', text: '#777777'}).valid, false);
  assert.equal(validateAppearance({...DEFAULT_APPEARANCE, background: '#ffffff', surface: '#ffffff', text: '#767676'}).valid, true);
});

test('custom accent foreground, focus and selected text remain readable in light and dark interfaces', () => {
  for (const palette of [dark, {...DEFAULT_APPEARANCE, accent: '#ffff00'}, {...DEFAULT_APPEARANCE, accent: '#000000'}]) {
    const tokens = appearanceCssVariables(palette);
    assert.ok(colorContrast(tokens['--accent-foreground'], palette.accent) >= 4.5);
    assert.ok(colorContrast(tokens['--accent-text'], palette.surface) >= 4.5);
    assert.ok(colorContrast(tokens['--accent-text'], palette.background) >= 4.5);
    assert.ok(colorContrast(tokens['--focus'], palette.surface) >= 4.5);
    assert.ok(colorContrast(tokens['--selection-text'], tokens['--selection-background']) >= 4.5);
    assert.equal(tokens['--surface'], palette.surface);
    assert.equal(tokens['--canvas'], palette.background);
    for (const value of Object.values(tokens)) assert.match(value, /^(#[a-f0-9]{6}|rgba\(\d+,\d+,\d+,0\.\d+\))$/);
  }
  assert.equal(appearanceCssVariables({...DEFAULT_APPEARANCE, accent: '#ffff00'})['--accent-foreground'], '#000000');
});

test('theme application writes only interface variables and reset clears custom derived roles', () => {
  const values = new Map<string, string>([['--unrelated-property', 'preserved']]);
  const target = {
    style: {setProperty: (key: string, value: string) => {values.set(key, value);}, removeProperty: (key: string) => {values.delete(key);}},
    querySelectorAll: () => {throw new Error('Appearance must never traverse or recolor artwork.');},
  } as unknown as HTMLElement;
  applyAppearance(dark, target);
  assert.equal(values.get('--surface'), dark.surface);
  assert.equal(values.get('--canvas'), dark.background);
  assert.equal(values.get('--selection-background'), appearanceCssVariables(dark)['--selection-background']);
  assert.equal(values.get('--unrelated-property'), 'preserved');
  const previous = Array.from(values);
  assert.throws(() => applyAppearance({...dark, text: dark.surface}, target));
  assert.deepEqual(Array.from(values), previous, 'invalid palettes must not partially change the displayed theme');
  resetAppearance(target);
  assert.equal(values.has('--selection-background'), false, 'restore the original per-component default fallbacks');
  assert.equal(values.get('--accent-soft'), '#fcf0e9');
  assert.equal(values.get('--surface'), DEFAULT_APPEARANCE.surface);
  assert.equal(values.get('--unrelated-property'), 'preserved');
  assert.ok(Array.from(values.keys()).every(key => key.startsWith('--')));
});

test('artwork planes retain their original fixed backgrounds independently of application colors', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const background = (css: string, selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1];
    assert.ok(rule, `${selector} exists`);
    return rule.match(/(?:^|;)\s*background\s*:\s*([^;]+)/)?.[1].trim();
  };
  const png = read('../src/components/png-svg.css');
  assert.equal(background(png, '.png-image-plane.bg-light'), '#fff');
  assert.equal(background(png, '.png-image-plane.bg-dark'), '#242927');
  assert.equal(background(png, '.png-image-plane.bg-checker'), 'repeating-conic-gradient(#e3e7df 0% 25%,#f7f9f4 0% 50%) 0 0 / 16px 16px');
  assert.equal(background(png, '.png-preview-surface'), '#edf0ea');
  assert.equal(background(read('../src/components/ai.css'), '.ai-artwork-surface'), 'repeating-conic-gradient(#e3e7df 0% 25%,#f7f9f4 0% 50%) 0 0 / 16px 16px');
  assert.equal(background(read('../src/components/images.css'), '.folio-image-original'), 'repeating-conic-gradient(#e7e8e5 0% 25%, #f7f8f5 0% 50%) 50% / 16px 16px');
  const core = read('../src/styles.css');
  assert.equal(background(core, '.page-frame'), 'white');
  assert.equal(background(core, '.page-frame-wrap'), '#fff');
  assert.equal(background(core, '.snapshot-view>img'), '#fff');
});
