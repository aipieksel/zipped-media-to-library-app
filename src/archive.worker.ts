import { parseArchive } from './archive';

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<{ buffer: ArrayBuffer; name: string; modifiedAt?: number }>) => void) | null;
  postMessage(message: unknown): void;
};
let queue = Promise.resolve();

worker.onmessage = event => {
  queue = queue.then(async () => {
    try {
      const { buffer, name, modifiedAt } = event.data;
      if (!(buffer instanceof ArrayBuffer) || typeof name !== 'string') throw new Error('Invalid ZIP import request.');
      let lastProgressAt = 0;
      const bundle = await parseArchive(buffer, name, message => {
        const now = Date.now();
        if (now - lastProgressAt >= 50) {
          lastProgressAt = now;
          worker.postMessage({ type: 'progress', message });
        }
      }, {}, modifiedAt);
      worker.postMessage({ type: 'result', bundle });
    } catch (error) {
      worker.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'This ZIP could not be imported.' });
    }
  });
};
