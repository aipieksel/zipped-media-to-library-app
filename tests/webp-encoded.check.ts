import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectRaster, inspectWebp } from '../src/raster-input';
import { PngSvgError } from '../src/png-svg';

// Explicit encoded-fixture gate, after python scripts/prepare-webp-fixtures.py.
// Missing inputs fail; these cases never silently skip their real codec data.
function rejectsCode(operation: () => unknown, code: string): void {
  assert.throws(operation, error => error instanceof PngSvgError && error.code === code);
}

test('real procedural Pillow WebPs expose the expected VP8/VP8L/VP8X format metadata', () => {
  const directory = new URL('../.qa/webp/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')) as {
    files: Array<{name: string; sha256: string; bytes: number; kind: string; width: number; height: number; lossless: boolean; alpha: boolean}>;
  };
  const expectedNames = ['opaque-lossless.webp', 'opaque-lossy.webp', 'alpha-lossless.webp', 'alpha-lossy.webp', 'monochrome-96.webp'];
  for (const name of expectedNames) {
    const entry = manifest.files.find(file => file.name === name);
    assert.ok(entry, `Generate ${name} with python scripts/prepare-webp-fixtures.py`);
    const bytes = new Uint8Array(readFileSync(new URL(name, directory)));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
    const metadata = inspectWebp(bytes);
    assert.equal(metadata.width, entry.width); assert.equal(metadata.height, entry.height);
    assert.equal(metadata.lossless, name.includes('lossless') || name === 'monochrome-96.webp');
    assert.equal(metadata.hasAlpha, name.startsWith('alpha-') || name === 'monochrome-96.webp');
  }
});

test('real animated WebP fails before decode; valid headers with absent entropy are a separate stage', () => {
  const directory = new URL('../.qa/webp/', import.meta.url);
  const animated = new Uint8Array(readFileSync(new URL('animated.webp', directory)));
  rejectsCode(() => inspectRaster(animated), 'animated-webp');
  const absentEntropy = new Uint8Array(readFileSync(new URL('invalid-entropy.webp', directory)));
  assert.equal(inspectWebp(absentEntropy).width, 32, 'Container inspection does not claim to validate the entropy stream');
  assert.equal(inspectWebp(absentEntropy).height, 24);
});
