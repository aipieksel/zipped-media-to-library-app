function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The AI request was cancelled.', 'AbortError');
}

/**
 * Retag the exact original bytes after prepareAiImage has validated the full
 * static image and its dimensions. This is not a replacement image validator.
 * The normalized PNG sent to AI is a separate attachment, never the saved source.
 */
export async function normalizeValidatedAiSource(original: Blob, signal?: AbortSignal): Promise<Blob> {
  throwIfAborted(signal);
  const bytes = new Uint8Array(await original.slice(0, 12).arrayBuffer());
  throwIfAborted(signal);
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const mime = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
    : png.every((value, index) => bytes[index] === value) ? 'image/png'
    : bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 ? 'image/webp'
      : null;
  if (!mime) throw new Error('The validated source image format could not be recognized. Select the original again.');
  return original.slice(0, original.size, mime);
}
