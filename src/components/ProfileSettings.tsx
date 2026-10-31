import {useEffect, useId, useRef, useState} from 'react';
import {ExternalLink, LoaderCircle, LogIn, LogOut} from 'lucide-react';
import {getPreference, setPreference} from '../db';

const SIGN_IN_PATH = '/signin-with-chatgpt?return_to=%2F';
const SIGN_OUT_PATH = '/signout-with-chatgpt?return_to=%2F';
const PASSWORD_HELP = 'https://help.openai.com/en/articles/4936828-resetting-or-changing-your-chatgpt-password';
const SECURITY_HELP = 'https://help.openai.com/en/articles/8304786-keeping-your-openai-account-secure';

interface AccountProfile {userId: string; email: string; fullName: string | null; displayName: string}
interface AccountResponse {authenticated: boolean; profile: AccountProfile | null; signInPath: string; signOutPath: string}
type AccountState = {status: 'loading'} | {status: 'ready'; value: AccountResponse} | {status: 'error'; message: string};
interface ProfilePreference {displayName: string}

function displayNamePreference(value: unknown): string {
  if (!value || typeof value !== 'object' || !('displayName' in value) || typeof value.displayName !== 'string') return '';
  return Array.from(value.displayName.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/gu, '').trim()).slice(0, 80).join('');
}

function parseAccount(value: unknown): AccountResponse {
  if (!value || typeof value !== 'object') throw new Error('The account response was not recognized.');
  const result = value as Partial<AccountResponse>;
  // Auth navigation stays on the fixed platform paths, never a response URL.
  if (result.signInPath !== SIGN_IN_PATH || result.signOutPath !== SIGN_OUT_PATH || typeof result.authenticated !== 'boolean') throw new Error('The account response was not recognized.');
  if (!result.authenticated) {
    if (result.profile !== null) throw new Error('The account response was not recognized.');
    return {authenticated: false, profile: null, signInPath: SIGN_IN_PATH, signOutPath: SIGN_OUT_PATH};
  }
  const profile = result.profile;
  if (!profile || typeof profile.userId !== 'string' || !profile.userId || profile.userId.length > 512 ||
    typeof profile.email !== 'string' || !profile.email || profile.email.length > 320 ||
    typeof profile.displayName !== 'string' || !profile.displayName || profile.displayName.length > 512 ||
    !(profile.fullName === null || (typeof profile.fullName === 'string' && profile.fullName.length <= 512))) throw new Error('The account response was not recognized.');
  return {authenticated: true, profile, signInPath: SIGN_IN_PATH, signOutPath: SIGN_OUT_PATH};
}

/** Mounted only when the user opens the Profile settings tab. */
export function ProfileSettings() {
  const [account, setAccount] = useState<AccountState>({status: 'loading'});
  const [reload, setReload] = useState(0);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const mounted = useRef(false);
  const nameId = useId();
  const nameNoteId = useId();
  const accountTitleId = useId();
  const securityTitleId = useId();

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void getPreference<ProfilePreference>('profile').then(value => {
      if (!active) return;
      const stored = displayNamePreference(value);
      setName(stored); setSavedName(stored); setPreferenceLoaded(true);
    }).catch(() => {
      if (!active) return;
      setPreferenceError('Your local profile preference could not be loaded. Check browser storage and try saving again.');
      setPreferenceLoaded(true);
    });
    return () => {active = false; mounted.current = false;};
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setAccount({status: 'loading'});
    void (async () => {
      const result = await fetch('/api/account', {credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: {accept: 'application/json'}});
      if (result.status !== 200 && result.status !== 401) throw new Error('Account unavailable');
      const value = parseAccount(await result.json());
      if ((result.status === 200) !== value.authenticated) throw new Error('Account status mismatch');
      if (active) setAccount({status: 'ready', value});
    })().catch(() => {
      if (active) setAccount({status: 'error', message: 'Your account could not be loaded. Try again, or sign in with ChatGPT.'});
    }).finally(() => clearTimeout(timeout));
    return () => {active = false; clearTimeout(timeout); controller.abort();};
  }, [reload]);

  const savePreference = async () => {
    if (saving || !preferenceLoaded) return;
    const displayName = displayNamePreference({displayName: name});
    setSaving(true); setPreferenceError(''); setSavedMessage('');
    try {
      await setPreference('profile', {displayName});
      if (!mounted.current) return;
      setName(displayName); setSavedName(displayName); setSavedMessage('Saved in this browser.');
    } catch {
      if (mounted.current) setPreferenceError('This preference could not be saved. Check available browser storage and try again.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const profile = account.status === 'ready' ? account.value.profile : null;
  const dirty = displayNamePreference({displayName: name}) !== savedName;

  return <div className="modal-body help-content">
    <section aria-labelledby={accountTitleId}>
      <h3 id={accountTitleId}>ChatGPT account</h3>
      {account.status === 'loading' && <p role="status"><LoaderCircle size={13} className="spin" aria-hidden="true"/> Loading your account…</p>}
      {account.status === 'error' && <><p className="form-error" role="alert">{account.message}</p><button type="button" className="button" onClick={() => setReload(value => value + 1)}>Try again</button></>}
      {profile && <><div className="setting-row"><span>Name</span><strong style={{overflowWrap: 'anywhere', minWidth: 0}}>{profile.displayName}</strong></div><div className="setting-row"><span>Email</span><span style={{overflowWrap: 'anywhere', minWidth: 0}}>{profile.email}</span></div><p className="form-note">This account controls access to Folio. Connect your local AI provider separately in AI settings.</p><a className="menu-row" href={SIGN_OUT_PATH} target="_top"><LogOut size={14} aria-hidden="true"/>Sign out of Folio</a></>}
      {account.status === 'ready' && !profile && <p>Sign in with ChatGPT to view your account.</p>}
      {account.status !== 'loading' && !profile && <a className="menu-row" href={SIGN_IN_PATH} target="_top"><LogIn size={14} aria-hidden="true"/>Sign in with ChatGPT</a>}
    </section>

    <section>
      <form onSubmit={event => {event.preventDefault(); void savePreference();}}>
        <label className="field-label" htmlFor={nameId}>Folio display name</label>
        <input id={nameId} className="text-input" value={name} maxLength={80} autoComplete="nickname" disabled={!preferenceLoaded || saving} placeholder={profile?.displayName ?? 'Optional display name'} aria-describedby={nameNoteId} onChange={event => {setName(event.target.value); setSavedMessage(''); setPreferenceError('');}}/>
        <p className="form-note" id={nameNoteId}>A local preference for Folio on this browser. It does not change your ChatGPT profile or sign-in.</p>
        {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
        {savedMessage && <p className="form-note" role="status">{savedMessage}</p>}
        <button className="button" type="submit" disabled={!preferenceLoaded || saving || !dirty}>{saving ? 'Saving…' : 'Save preference'}</button>
      </form>
    </section>

    <section aria-labelledby={securityTitleId}>
      <h3 id={securityTitleId}>Password and security</h3>
      <p>Manage your account with ChatGPT. Folio does not store your password.</p>
      <a className="menu-row" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true"/>Open ChatGPT</a>
      <a className="menu-row" href={PASSWORD_HELP} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true"/>Change or reset your password</a>
      <a className="menu-row" href={SECURITY_HELP} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true"/>Account security</a>
    </section>
  </div>;
}
