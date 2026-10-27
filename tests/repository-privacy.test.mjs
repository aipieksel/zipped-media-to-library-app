import test from 'node:test';
import assert from 'node:assert/strict';
import { privacyViolation } from '../scripts/check-repository-privacy.mjs';

const check = (path, content = 'source text', mode = '100644') => privacyViolation(path, mode, Buffer.from(content));

test('allows app scaffolding and text source', () => {
  assert.equal(check('index.html', '<!doctype html><html></html>'), null);
  assert.equal(check('public/favicon.svg', '<svg></svg>'), null);
  assert.equal(check('src/demo.ts', 'export const synthetic = `<svg></svg>`;'), null);
  assert.equal(check('documents/architecture.md'), null);
});

test('rejects collection files, including force-added and uppercase extensions', () => {
  for (const path of ['pack.zip', 'PACK.ZIP', 'page.html', 'nested/index.html', 'photo.PNG', 'photo.avif', 'capture.webp', 'asset.svg', 'source.bundle', 'pack.tar.gz', 'font.woff2']) {
    assert.ok(check(path), path);
  }
});

test('rejects private directories, catalogues and credentials', () => {
  for (const path of ['nested/imports/data.json', 'fixtures/fixture.ts', 'cloud-fast-data/metadata.json', '.env', '.env.local', 'key.pem', 'collection.json', 'x/catalogue.public.json', 'x/manifest.json']) {
    assert.ok(check(path), path);
  }
});

test('rejects disguised binary, HTML, SVG, symlinks and large payloads', () => {
  assert.ok(check('payload.txt', Buffer.from([0xff, 0xd8, 0xff])));
  assert.ok(check('payload.txt', 'PK\0\0'));
  assert.ok(check('payload.txt', '<!DOCTYPE html><html></html>'));
  assert.ok(check('payload.txt', '<?xml version="1.0"?><svg></svg>'));
  assert.ok(check('src/link.ts', 'target', '120000'));
  assert.ok(check('src/data.ts', Buffer.alloc(1024 * 1024 + 1, 65)));
  assert.ok(check('public/favicon.svg', '<svg>' + 'x'.repeat(4096) + '</svg>'));
});
