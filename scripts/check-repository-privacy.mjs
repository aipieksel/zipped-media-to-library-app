import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const media = /\.(?:zip|gz|tgz|tar|7z|rar|bundle|html?|png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|heic|heif|psd|pdf|mp4|mov|webm|woff2?|ttf|otf)$/i;
const privateDirectory = /(?:^|\/)(?:imports|uploads|exports|fixtures|screenshots|captures|private-data|collection-data|cloud-data|cloud-fast-data|source-zips|\.qa|\.sites-runtime|node_modules|dist)(?:\/|$)/i;
const privateMetadata = /(?:^|\/)(?:collection|catalogue|catalog|manifest)(?:[.-][^/]*)?\.json$/i;
const decoder = new TextDecoder('utf-8', { fatal: true });

// Inspect committed/staged blob bytes, not possibly different working-tree bytes.
export function privacyViolation(path, mode, bytes) {
  if (mode !== '100644' && mode !== '100755') return 'only regular source files are allowed';
  if (privateDirectory.test(path)) return 'private/generated data directory';
  if (/(?:^|\/)\.env(?:\.|$)|\.(?:pem|key)$/i.test(path)) return 'credentials/configuration file';
  if (privateMetadata.test(path)) return 'collection catalogue or resource manifest';
  const appAsset = path === 'index.html' || path === 'public/favicon.svg';
  if (media.test(path) && !appAsset) return 'archive, page, image, capture or other media';
  if (bytes.length > 1024 * 1024) return 'unexpected source blob larger than 1 MiB';
  if (path === 'public/favicon.svg' && bytes.length > 4096) return 'unexpected favicon payload';
  if (bytes.includes(0)) return 'binary payload';
  let text;
  try { text = decoder.decode(bytes); } catch { return 'non-UTF-8 payload'; }
  // Catch common originals renamed with a source/text extension.
  if (!appAsset && /^\s*(?:<!doctype\s+html\b|<html\b|(?:<\?xml[^>]*>\s*)?<svg\b)/i.test(text)) {
    return 'standalone HTML/SVG document';
  }
  return null;
}

export function checkRepository() {
  const entries = execFileSync('git', ['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean);
  const failures = [];
  for (const entry of entries) {
    const split = entry.indexOf('\t');
    const [mode, hash, stage] = entry.slice(0, split).split(' ');
    const path = entry.slice(split + 1);
    if (stage !== '0') { failures.push([path, 'unresolved index entry']); continue; }
    const bytes = execFileSync('git', ['cat-file', 'blob', hash], { maxBuffer: 32 * 1024 * 1024 });
    const reason = privacyViolation(path, mode, bytes);
    if (reason) failures.push([path, reason]);
  }
  if (failures.length) {
    console.error('Repository privacy check failed. Keep collection data in private app storage.');
    for (const [path, reason] of failures) console.error(`${JSON.stringify(path)}: ${reason}`);
    return 1;
  }
  console.log(`Repository privacy check passed (${entries.length} source files).`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = checkRepository(); }
  catch { console.error('Repository privacy check could not complete; refusing to pass.'); process.exitCode = 1; }
}
