export class CompanionError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message); this.name = 'CompanionError';
  }
}
export function publicError(error: unknown): CompanionError {
  if (error instanceof CompanionError) return error;
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'cancelled') return new CompanionError('CANCELLED', 'The AI request was cancelled.', 409);
    if (error.code === 'timeout') return new CompanionError('TIMEOUT', 'The AI request timed out. Try a faster model or a simpler image.', 504);
    if (error.code === 'unsafe-tool') return new CompanionError('ISOLATION_UNSUPPORTED', 'Codex attempted an unexpected tool action. The request was stopped without accepting its output.', 422);
    if (error.code === 'output-limit') return new CompanionError('INVALID_OUTPUT', 'The AI response exceeded the supported size. Try a simpler icon.', 502);
  }
  return new CompanionError('AI_FAILED', 'The local AI request failed. Check that Codex is signed in with ChatGPT and that the selected model is available, then reconnect.', 502);
}
