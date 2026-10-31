#!/usr/bin/env node
import { createServer } from 'node:http';
import { inspectCliCatalog } from './discovery';

const LOOPBACK_HOST = '127.0.0.1';
const parsedPort = Number(process.env.CODRA_AI_CLI_RUNNER_PORT ?? '8798');
if (!Number.isInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
  throw new Error('CODRA_AI_CLI_RUNNER_PORT must be an integer between 1024 and 65535.');
}

const allowedOrigins = new Set(
  (process.env.CODRA_AI_CLI_ALLOWED_ORIGINS
    ?? 'http://127.0.0.1:8788,http://localhost:8788,http://127.0.0.1:8799,http://localhost:8799,http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function send(response: import('node:http').ServerResponse, status: number, body: unknown, origin?: string) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}),
  });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  const origin = request.headers.origin;
  const acceptedOrigin = origin && allowedOrigins.has(origin) ? origin : undefined;
  if (origin && !acceptedOrigin) {
    send(response, 403, { error: 'Origin is not allowed.' });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      ...(acceptedOrigin ? { 'access-control-allow-origin': acceptedOrigin, vary: 'origin' } : {}),
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, { ok: true, service: 'codra-ai-cli-runner' }, acceptedOrigin);
    return;
  }
  if (request.method === 'GET' && request.url === '/v1/catalog') {
    try {
      send(response, 200, await inspectCliCatalog(), acceptedOrigin);
    } catch (error) {
      send(response, 500, { error: error instanceof Error ? error.message : 'CLI catalog inspection failed.' }, acceptedOrigin);
    }
    return;
  }
  send(response, 404, { error: 'Not found.' }, acceptedOrigin);
}).listen(parsedPort, LOOPBACK_HOST, () => {
  console.log(`Codra AI CLI runner listening on http://${LOOPBACK_HOST}:${parsedPort}`);
});
