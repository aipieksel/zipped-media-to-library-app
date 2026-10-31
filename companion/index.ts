#!/usr/bin/env node
import { startCompanion, DEFAULT_FOLIO_ORIGIN } from './server';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Folio AI companion\n\nUsage: node folio-ai.mjs [--port 8798] [--origin https://your-folio-site]\n\nRequires Node.js 22+ and the official Codex CLI signed in with ChatGPT.\nThe companion keeps provider credentials in Codex. Pair using the code printed at startup.\nOnly the configured origin can connect; restarting creates a new pairing code.');
} else {
  let port = Number(process.env.FOLIO_AI_PORT ?? 8798), origin = process.env.FOLIO_AI_ORIGIN ?? DEFAULT_FOLIO_ORIGIN;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--port' && args[index + 1]) port = Number(args[++index]);
    else if (args[index] === '--origin' && args[index + 1]) origin = args[++index];
    else throw new Error('Unknown option. Run with --help for usage.');
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port between 1024 and 65535.');
  try {
    const companion = await startCompanion({ port, origin });
    console.log(`Folio AI companion is running on http://127.0.0.1:${companion.port}\nAllowed site: ${companion.origin}\n\nPairing code: ${companion.token}\n\nIn Folio, open Settings → AI, enter this code and connect.\nKeep this terminal open. Restarting revokes this pairing code.\nAI runs only when you choose Test connection or create an SVG.`);
    let closing = false;
    const close = () => { if (closing) return; closing = true; void companion.close().then(() => process.exit(0)); };
    process.once('SIGINT', close); process.once('SIGTERM', close);
  } catch {
    console.error('The Folio companion could not start. Check that the port is free and the origin is valid. Run with --help for usage.');
    process.exitCode = 1;
  }
}
