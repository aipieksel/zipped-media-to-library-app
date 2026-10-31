import {z} from 'zod';
import {
  FolioAccountSchema, FolioCapabilitySchema, FolioInvitationSchema, FolioMemberSchema, FolioSessionSchema,
  normalizeAccountEmail,
} from './contracts';
import type {BootstrapInput, LoginInput, PasswordInput, RecoveryInput, RegisterInput} from './contracts';

const BASE = '/api/folio-auth';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const OK = z.object({ok: z.literal(true)});
const ACCOUNT = z.object({account: FolioAccountSchema});
const ERROR = z.object({error: z.string().min(1).max(500), code: z.string().min(1).max(64)});

export class AccountRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {super(message); this.name = 'AccountRequestError';}
}

export function isSessionDenied(error: unknown): boolean {
  return error instanceof AccountRequestError &&
    ((error.status === 401 && error.code === 'signed_out') || (error.status === 403 && error.code === 'membership'));
}

async function responseJSON(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new AccountRequestError(response.status, 'response', 'The account service returned an unexpected response. Try again.');
  const length = response.headers.get('content-length');
  if (length && Number(length) > MAX_RESPONSE_BYTES)
    throw new AccountRequestError(response.status, 'response', 'The account response was too large.');
  const reader = response.body?.getReader();
  if (!reader) throw new AccountRequestError(response.status, 'response', 'The account response was empty.');
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {await reader.cancel(); throw new AccountRequestError(response.status, 'response', 'The account response was too large.');}
      parts.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {bytes.set(part, offset); offset += part.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));}
  catch {throw new AccountRequestError(response.status, 'response', 'The account response could not be read. Try again.');}
}

function memberId(value: string): string {
  if (!/^[a-zA-Z0-9-]{1,64}$/u.test(value)) throw new AccountRequestError(400, 'id', 'Choose a valid account or invitation.');
  return value;
}

/** Same-origin cookie requests only. No credential or capability storage. */
export function createFolioAccountClient(fetcher: typeof fetch = fetch) {
  async function request<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, {once: true});
    const timeout = setTimeout(abort, 25_000);
    try {
      const response = await fetcher(BASE + path, {
        method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: {accept: 'application/json', ...(method === 'GET' ? {} : {'content-type': 'application/json'})},
        ...(method === 'GET' ? {} : {body: JSON.stringify(body ?? {})}),
      });
      const raw = await responseJSON(response);
      if (!response.ok) {
        const parsed = ERROR.safeParse(raw);
        throw new AccountRequestError(response.status, parsed.success ? parsed.data.code : 'request',
          parsed.success ? parsed.data.error : 'This account action could not be completed. Try again.');
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw new AccountRequestError(response.status, 'response', 'The account response was not recognized. Try again.');
      return parsed.data;
    } catch (error) {
      if (error instanceof AccountRequestError || signal?.aborted) throw error;
      throw new AccountRequestError(0, controller.signal.aborted ? 'timeout' : 'network',
        method !== 'GET' ? 'This account action could not be confirmed. Check your connection and account status before trying again.'
          : controller.signal.aborted ? 'The account service took too long. Try again.' : 'The account service could not be reached. Check your connection and try again.');
    } finally {clearTimeout(timeout); signal?.removeEventListener('abort', abort);}
  }
  return {
    session: (signal?: AbortSignal) => request('/session', FolioSessionSchema, 'GET', undefined, signal),
    login: (input: LoginInput, signal?: AbortSignal) => request('/login', ACCOUNT, 'POST', {...input, email: normalizeAccountEmail(input.email)}, signal),
    bootstrap: (input: BootstrapInput, signal?: AbortSignal) => request('/bootstrap', ACCOUNT, 'POST', {...input, email: normalizeAccountEmail(input.email), name: input.name.normalize('NFC').trim()}, signal),
    register: (input: RegisterInput, signal?: AbortSignal) => request('/register', ACCOUNT, 'POST', {...input, email: normalizeAccountEmail(input.email), name: input.name.normalize('NFC').trim()}, signal),
    logout: (signal?: AbortSignal) => request('/logout', OK, 'POST', {}, signal),
    updateProfile: (name: string, signal?: AbortSignal) => request('/profile', ACCOUNT, 'PATCH', {name: name.normalize('NFC').trim()}, signal),
    changePassword: (input: PasswordInput, signal?: AbortSignal) => request('/password', OK, 'POST', input, signal),
    recover: (input: RecoveryInput, signal?: AbortSignal) => request('/recovery', OK, 'POST', {...input, email: normalizeAccountEmail(input.email)}, signal),
    members: (signal?: AbortSignal) => request('/members', z.object({members: z.array(FolioMemberSchema).max(1000)}), 'GET', undefined, signal),
    invitations: (signal?: AbortSignal) => request('/invitations', z.object({invitations: z.array(FolioInvitationSchema).max(100)}), 'GET', undefined, signal),
    createInvitation: (email: string, signal?: AbortSignal) => request('/invitations', FolioCapabilitySchema, 'POST', {email: normalizeAccountEmail(email)}, signal),
    revokeInvitation: (id: string, signal?: AbortSignal) => request('/invitations/' + memberId(id), OK, 'DELETE', {}, signal),
    setMemberStatus: (id: string, status: 'active' | 'disabled', signal?: AbortSignal) => request('/members/' + memberId(id), OK, 'PATCH', {status}, signal),
    createMemberRecovery: (id: string, currentPassword: string, signal?: AbortSignal) => request('/members/' + memberId(id) + '/recovery', FolioCapabilitySchema, 'POST', {currentPassword}, signal),
    createOwnerRecovery: (signal?: AbortSignal) => request('/owner-recovery', FolioCapabilitySchema, 'POST', {}, signal),
  };
}
