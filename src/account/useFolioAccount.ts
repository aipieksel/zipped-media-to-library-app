import {useCallback, useEffect, useRef, useState} from 'react';
import {createFolioAccountClient, isSessionDenied} from './client';
import {anonymousSession} from './contracts';
import type {BootstrapInput, FolioAccount, FolioAccounts, FolioCapability, FolioSession, LoginInput, PasswordInput, RecoveryInput, RegisterInput} from './contracts';

export interface FolioAccountController {
  status: 'loading' | 'ready' | 'error';
  state: FolioSession | null;
  account: FolioAccount | null;
  busy: boolean;
  error: string;
  notice: string;
  clearError: () => void;
  refresh: () => Promise<boolean>;
  login: (input: LoginInput) => Promise<boolean>;
  bootstrap: (input: BootstrapInput) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updateProfile: (name: string) => Promise<boolean>;
  changePassword: (input: PasswordInput) => Promise<boolean>;
  recover: (input: RecoveryInput) => Promise<boolean>;
  loadAccounts: () => Promise<FolioAccounts | null>;
  createInvitation: (email: string) => Promise<FolioCapability | null>;
  revokeInvitation: (id: string) => Promise<boolean>;
  setMemberStatus: (id: string, status: 'active' | 'disabled') => Promise<boolean>;
  createMemberRecovery: (id: string, currentPassword: string) => Promise<FolioCapability | null>;
  createOwnerRecovery: () => Promise<FolioCapability | null>;
}

/** Mount once above the authenticated workspace; cookies remain server-owned. */
export function useFolioAccount(): FolioAccountController {
  const [client] = useState(() => createFolioAccountClient());
  const [status, setStatus] = useState<FolioAccountController['status']>('loading');
  const [state, setState] = useState<FolioSession | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const current = useRef<FolioSession | null>(null);
  const mounted = useRef(false), locked = useRef(false), revision = useRef(0);
  const pending = useRef(new Set<AbortController>()), sessionRequest = useRef<AbortController | null>(null);

  const commit = useCallback((value: FolioSession) => {
    if (!mounted.current) return;
    current.current = value; setState(value); setStatus('ready');
  }, []);
  const acceptAccount = useCallback((account: FolioAccount) => {
    commit({...anonymousSession(current.current), authenticated: true, account, setupRequired: false, canBootstrap: false});
  }, [commit]);
  const clearError = useCallback(() => setError(''), []);

  const refresh = useCallback(async () => {
    if (locked.current) return false;
    const requestRevision = ++revision.current;
    sessionRequest.current?.abort();
    const controller = new AbortController(); sessionRequest.current = controller; pending.current.add(controller);
    if (mounted.current) {if (!current.current) setStatus('loading'); setError('');}
    try {
      const next = await client.session(controller.signal);
      if (!mounted.current || controller.signal.aborted || requestRevision !== revision.current) return false;
      if (current.current?.authenticated && !next.authenticated) setNotice('Your session ended. Log in to continue.');
      commit(next);
      return true;
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted || requestRevision !== revision.current) return false;
      // An unverified/error response must not grant access to cached shared data.
      current.current = null; setState(null); setStatus('error');
      setError(failure instanceof Error ? failure.message : 'Your account could not be checked. Try again.');
      return false;
    } finally {pending.current.delete(controller); if (sessionRequest.current === controller) sessionRequest.current = null;}
  }, [client, commit]);

  const perform = useCallback(async <T,>(task: (signal: AbortSignal) => Promise<T>, succeeded?: (value: T) => void): Promise<T | null> => {
    if (locked.current || !mounted.current) return null;
    locked.current = true; ++revision.current; sessionRequest.current?.abort();
    const controller = new AbortController(); pending.current.add(controller);
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await task(controller.signal);
      if (!mounted.current || controller.signal.aborted) return null;
      succeeded?.(value);
      return value;
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return null;
      if (isSessionDenied(failure)) commit(anonymousSession(current.current));
      setError(failure instanceof Error ? failure.message : 'This account action could not be completed. Try again.');
      return null;
    } finally {
      pending.current.delete(controller); locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [commit]);

  const login = useCallback(async (input: LoginInput) => !!await perform(signal => client.login(input, signal), value => acceptAccount(value.account)), [client, perform, acceptAccount]);
  const bootstrap = useCallback(async (input: BootstrapInput) => {
    if (!await perform(signal => client.bootstrap(input, signal), value => {acceptAccount(value.account); setNotice('Owner account created.');})) return false;
    await refresh(); // Trusted Site-owner recovery becomes available after setup.
    return true;
  }, [client, perform, acceptAccount, refresh]);
  const register = useCallback(async (input: RegisterInput) => !!await perform(signal => client.register(input, signal), value => acceptAccount(value.account)), [client, perform, acceptAccount]);
  const logout = useCallback(async () => {
    if (!await perform(signal => client.logout(signal), () => {
      commit(anonymousSession(current.current)); setNotice('You have logged out of Folio.');
    })) return false;
    await refresh();
    return true;
  }, [client, perform, commit, refresh]);
  const updateProfile = useCallback(async (name: string) => !!await perform(signal => client.updateProfile(name, signal), value => {
    acceptAccount(value.account); setNotice('Profile saved.');
  }), [client, perform, acceptAccount]);
  const changePassword = useCallback(async (input: PasswordInput) => {
    if (!await perform(signal => client.changePassword(input, signal))) return false;
    // The server revokes every old session and may issue a replacement cookie.
    // Verify the resulting session rather than assuming either behavior.
    const checked = await refresh();
    if (mounted.current) setNotice(!checked
      ? 'Password changed. Your session could not be checked; try the account check again.'
      : current.current?.authenticated ? 'Password changed. Other sessions have been logged out.'
      : 'Password changed. Log in again with your new password.');
    return true;
  }, [client, perform, refresh]);
  const recover = useCallback(async (input: RecoveryInput) => !!await perform(signal => client.recover(input, signal), () => {
    commit(anonymousSession(current.current)); setNotice('Password reset. Log in with your new password.');
  }), [client, perform, commit]);
  const loadAccounts = useCallback(() => perform(async signal => {
    const [members, invitations] = await Promise.all([client.members(signal), client.invitations(signal)]);
    return {members: members.members, invitations: invitations.invitations};
  }), [client, perform]);
  const createInvitation = useCallback((email: string) => perform(signal => client.createInvitation(email, signal)), [client, perform]);
  const revokeInvitation = useCallback(async (id: string) => !!await perform(signal => client.revokeInvitation(id, signal)), [client, perform]);
  const setMemberStatus = useCallback(async (id: string, memberStatus: 'active' | 'disabled') => !!await perform(signal => client.setMemberStatus(id, memberStatus, signal)), [client, perform]);
  const createMemberRecovery = useCallback((id: string, password: string) => perform(signal => client.createMemberRecovery(id, password, signal)), [client, perform]);
  const createOwnerRecovery = useCallback(() => perform(signal => client.createOwnerRecovery(signal)), [client, perform]);

  useEffect(() => {
    mounted.current = true; void refresh();
    const visible = () => {if (document.visibilityState === 'visible') void refresh();};
    const restored = () => {void refresh();};
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pageshow', restored);
    return () => {
      mounted.current = false; ++revision.current;
      pending.current.forEach(controller => controller.abort()); pending.current.clear();
      document.removeEventListener('visibilitychange', visible); window.removeEventListener('pageshow', restored);
    };
  }, [refresh]);

  return {status, state, account: state?.account ?? null, busy, error, notice, clearError, refresh, login, bootstrap, register, logout, updateProfile, changePassword, recover, loadAccounts, createInvitation, revokeInvitation, setMemberStatus, createMemberRecovery, createOwnerRecovery};
}
