import {z} from 'zod';

export const SITE_SIGN_IN_PATH = '/signin-with-chatgpt?return_to=%2F' as const;
export const SITE_SIGN_OUT_PATH = '/signout-with-chatgpt?return_to=%2F' as const;

const email = z.string().max(254).regex(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u);
const id = z.string().min(1).max(64).regex(/^[a-zA-Z0-9-]+$/u);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const FolioAccountSchema = z.object({id, email, name: z.string().min(1).max(80), role: z.enum(['owner', 'member'])});
export type FolioAccount = z.infer<typeof FolioAccountSchema>;

export const FolioSessionSchema = z.object({
  authenticated: z.boolean(),
  account: FolioAccountSchema.nullable(),
  setupRequired: z.boolean(),
  canBootstrap: z.boolean(),
  canRecoverOwner: z.boolean(),
  siteSignInPath: z.literal(SITE_SIGN_IN_PATH),
  siteSignOutPath: z.literal(SITE_SIGN_OUT_PATH),
}).refine(value => value.authenticated === (value.account !== null), {message: 'Inconsistent session response.'})
  .refine(value => !(value.canBootstrap && !value.setupRequired), {message: 'Inconsistent setup response.'})
  .refine(value => !(value.canRecoverOwner && value.setupRequired), {message: 'Inconsistent recovery response.'});
export type FolioSession = z.infer<typeof FolioSessionSchema>;

export const FolioInvitationSchema = z.object({id, email, expiresAt: timestamp, createdAt: timestamp});
export type FolioInvitation = z.infer<typeof FolioInvitationSchema>;
export const FolioMemberSchema = FolioAccountSchema.extend({status: z.enum(['active', 'disabled']), createdAt: timestamp});
export type FolioMember = z.infer<typeof FolioMemberSchema>;
export const FolioCapabilitySchema = z.object({token: z.string().regex(/^[a-f0-9]{64}$/u), email, expiresAt: timestamp});
export type FolioCapability = z.infer<typeof FolioCapabilitySchema>;
export interface FolioAccounts {members: FolioMember[]; invitations: FolioInvitation[]}

export interface LoginInput {email: string; password: string}
export interface BootstrapInput extends LoginInput {name: string}
export interface RegisterInput extends BootstrapInput {token: string}
export interface PasswordInput {currentPassword: string; newPassword: string}
export interface RecoveryInput {email: string; token: string; newPassword: string}

export function normalizeAccountEmail(value: string): string {return value.trim().toLowerCase();}

export function accountNameError(value: string): string {
  const normalized = value.normalize('NFC').trim();
  return !normalized || normalized.length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
    ? 'Enter a name of 1–80 characters.' : '';
}

export function accountPasswordError(value: string): string {
  return value.length < 12 || value.length > 128 || new TextEncoder().encode(value).length > 512
    ? 'Use a password of 12–128 characters.' : '';
}

export function anonymousSession(previous: FolioSession | null): FolioSession {
  return {
    authenticated: false, account: null, setupRequired: previous?.setupRequired ?? false,
    canBootstrap: previous?.canBootstrap ?? false, canRecoverOwner: previous?.canRecoverOwner ?? false,
    siteSignInPath: SITE_SIGN_IN_PATH, siteSignOutPath: SITE_SIGN_OUT_PATH,
  };
}
