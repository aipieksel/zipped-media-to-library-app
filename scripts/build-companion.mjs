import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist-companion', { recursive: true });
await build({ entryPoints: ['companion/index.ts'], outfile: 'dist-companion/folio-ai.mjs',
  bundle: true, platform: 'node', format: 'esm', target: 'node20', sourcemap: false,
  banner: { js: "import { createRequire as __folioCreateRequire } from 'node:module'; const require = __folioCreateRequire(import.meta.url);" },
});
await copyFile('vendor/ai-cli-integration/LICENSE', 'dist-companion/AGPL-3.0.txt');
await copyFile('THIRD_PARTY_NOTICES.md', 'dist-companion/THIRD_PARTY_NOTICES.md');
await copyFile('companion/README.md', 'dist-companion/README.md');
console.log('Built dist-companion/folio-ai.mjs. Run with --help for setup.');
