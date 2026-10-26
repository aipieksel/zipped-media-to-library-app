import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('src/generated', {recursive:true});
await build({entryPoints:['src/capture-entry.ts'],outfile:'src/generated/bridge.js',bundle:true,format:'iife',target:'es2022',minify:true,legalComments:'inline'});
