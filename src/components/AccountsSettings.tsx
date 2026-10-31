import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {Check, Copy, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, UserPlus, X} from 'lucide-react';
import type {FolioAccountController} from '../account/useFolioAccount';
import type {FolioAccounts, FolioCapability} from '../account/contracts';
import {accountPasswordError} from '../account/contracts';
import {accountCapabilityLink} from '../account/routes';
import './account.css';

interface LinkResult {kind: 'register' | 'recover'; capability: FolioCapability}

function CapabilityLink({result, onDismiss}: {result: LinkResult; onDismiss: () => void}) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  const url = accountCapabilityLink(result.kind, result.capability, window.location.origin);
  const expired = result.capability.expiresAt <= Date.now();
  const label = result.kind === 'register' ? 'Invitation link' : 'Password recovery link';
  const copy = async () => {
    setError('');
    try {await navigator.clipboard.writeText(url); setCopied(true);}
    catch {input.current?.focus(); input.current?.select(); setError('Select and copy the link above. Clipboard access is unavailable.');}
  };
  return <div className="account-link-result" role="region" aria-label={label}>
    <div className="account-link-heading"><strong role="status">{label} created</strong><button className="icon-button" type="button" aria-label="Dismiss link" onClick={onDismiss}><X size={13}/></button></div>
    <p className="form-note">For {result.capability.email}. {expired ? 'This link has expired.' : 'Expires ' + new Date(result.capability.expiresAt).toLocaleString() + '.'}</p>
    <div className="account-link-copy"><input ref={input} className="text-input" aria-label={label} value={url} readOnly spellCheck={false} autoComplete="off" onFocus={event => event.currentTarget.select()}/><button className="button" type="button" disabled={expired} onClick={() => void copy()}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Copied' : 'Copy link'}</button></div>
    <p className="form-note">Copy this link before leaving the page. It is shown once and can be used once. No email was sent.</p>
    {result.kind === 'register' && <p className="form-note">Your teammate also needs access to this private Site; this invitation grants Folio workspace membership.</p>}
    {copied && <span className="account-copy-status" role="status">Link copied.</span>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}

export function AccountsSettings({controller}: {controller: FolioAccountController}) {
  const [data, setData] = useState<FolioAccounts | null>(null), [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(''), [result, setResult] = useState<LinkResult | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null), [password, setPassword] = useState('');
  const [disableId, setDisableId] = useState<string | null>(null), [error, setError] = useState('');
  const alive = useRef(false), inviteId = useId(), recoveryPasswordId = useId();
  const {loadAccounts} = controller;
  const owner = controller.account?.role === 'owner';
  const busy = controller.busy || loading;
  const reload = useCallback(async () => {
    setLoading(true);
    const value = await loadAccounts();
    if (alive.current) {if (value) setData(value); setLoading(false);}
  }, [loadAccounts]);
  useEffect(() => {
    alive.current = true;
    if (owner) void reload(); else setLoading(false);
    return () => {alive.current = false;};
  }, [owner, controller.account?.id, reload]);
  if (!owner) return <div className="account-settings"><p className="form-note">The workspace owner manages account access.</p></div>;

  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const capability = await controller.createInvitation(email);
    if (!capability || !alive.current) return;
    setResult({kind: 'register', capability}); setEmail(''); await reload();
  };
  const setStatus = async (id: string, status: 'active' | 'disabled') => {
    setError('');
    if (await controller.setMemberStatus(id, status)) {
      if (!alive.current) return;
      setDisableId(null);
      if (status === 'disabled' && recoveryId === id) {setRecoveryId(null); setPassword('');}
      if (status === 'disabled' && result?.kind === 'recover' && result.capability.email === data?.members.find(member => member.id === id)?.email) setResult(null);
      await reload();
    }
  };
  const revoke = async (id: string) => {
    if (await controller.revokeInvitation(id) && alive.current) {
      if (result?.kind === 'register' && result.capability.email === data?.invitations.find(invitation => invitation.id === id)?.email) setResult(null);
      await reload();
    }
  };
  const recover = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!recoveryId) return;
    const invalid = accountPasswordError(password); if (invalid) {setError(invalid); return;}
    const capability = await controller.createMemberRecovery(recoveryId, password);
    if (!alive.current) return;
    setPassword('');
    if (capability) {setResult({kind: 'recover', capability}); setRecoveryId(null);}
  };
  const recovering = data?.members.find(member => member.id === recoveryId && member.status === 'active');

  return <div className="account-settings">
    <section className="settings-section">
      <h2>Workspace accounts</h2><p className="form-note">Everyone uses the same HTML, images, icons and folders. Each person signs in with their own Folio account.</p>
      <form className="account-invite-form" onSubmit={event => void invite(event)}><label className="form-field" htmlFor={inviteId}><span>Invite by email</span><input id={inviteId} type="email" name="invite-email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={busy} placeholder="teammate@example.com"/></label><button className="button" type="submit" disabled={busy}><UserPlus size={13} aria-hidden="true"/>Create invitation</button></form>
      <p className="form-note">You receive a single-use link to share. Your teammate also needs access to this private Site. No invitation email is sent.</p>
    </section>
    {result && <CapabilityLink key={result.capability.token} result={result} onDismiss={() => setResult(null)}/>}
    {(error || controller.error) && <p className="inline-error" role="alert">{error || controller.error}</p>}
    <section className="settings-section">
      <div className="account-section-heading"><h2>Members</h2><button className="icon-button" type="button" aria-label="Refresh workspace accounts" disabled={busy} onClick={() => void reload()}><RefreshCw size={13} aria-hidden="true"/></button></div>
      {loading && !data && <p className="account-status" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true"/>Loading accounts…</p>}
      {!loading && !data && <button className="button" type="button" onClick={() => void reload()}>Try again</button>}
      {data && <ul className="account-member-list">{data.members.map(member => <li key={member.id}>
        <div className="account-member-main"><div className="account-member-identity"><strong>{member.name}</strong><span>{member.email}</span></div><span className="account-member-status">{member.role === 'owner' ? <><ShieldCheck size={12} aria-hidden="true"/>Owner</> : member.status === 'active' ? 'Active' : 'Disabled'}</span>
          {member.role === 'member' && <div className="account-member-actions">{member.status === 'active' ? <><button className="text-button" type="button" disabled={busy} onClick={() => {setRecoveryId(recoveryId === member.id ? null : member.id); setPassword(''); setDisableId(null); setError(''); controller.clearError();}}><KeyRound size={12} aria-hidden="true"/>Recovery link</button><button className="text-button" type="button" disabled={busy} onClick={() => {setDisableId(member.id); setRecoveryId(null); setPassword('');}}>Disable</button></> : <button className="text-button" type="button" disabled={busy} onClick={() => void setStatus(member.id, 'active')}>Restore access</button>}</div>}
        </div>
        {disableId === member.id && <div className="account-inline-confirm"><p>Disable {member.name} and log out their sessions?</p><button className="button" type="button" disabled={busy} onClick={() => void setStatus(member.id, 'disabled')}>Disable access</button><button className="text-button" type="button" disabled={busy} onClick={() => setDisableId(null)}>Cancel</button></div>}
      </li>)}</ul>}
      {recovering && <form className="account-recovery-form" onSubmit={event => void recover(event)}>
        <h3>Recovery for {recovering.name}</h3><p className="form-note">Verify your owner password to create a reset link for {recovering.email}.</p>
        <input type="text" name="username" autoComplete="username" value={controller.account?.email ?? ''} readOnly className="account-autofill-username" tabIndex={-1} aria-hidden="true"/>
        <label className="form-field" htmlFor={recoveryPasswordId}><span>Your current password</span><input id={recoveryPasswordId} name="current-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} required disabled={busy}/></label>
        <div className="account-actions"><button className="button" type="submit" disabled={busy}>Create recovery link</button><button className="text-button" type="button" disabled={busy} onClick={() => {setRecoveryId(null); setPassword('');}}>Cancel</button></div>
      </form>}
    </section>
    <section className="settings-section"><h2>Pending invitations</h2>{data && !data.invitations.length && <p className="form-note">No pending invitations.</p>}{data && <ul className="account-invitation-list">{data.invitations.map(invitation => <li key={invitation.id}><div><strong>{invitation.email}</strong><span>Expires {new Date(invitation.expiresAt).toLocaleString()}</span></div><button className="text-button" type="button" disabled={busy} onClick={() => void revoke(invitation.id)}>Revoke</button></li>)}</ul>}</section>
  </div>;
}
