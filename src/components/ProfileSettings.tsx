import {useEffect, useId, useState} from 'react';
import {Check, LoaderCircle, LogOut} from 'lucide-react';
import type {FolioAccountController} from '../account/useFolioAccount';
import {accountNameError, accountPasswordError} from '../account/contracts';
import './account.css';

export function ProfileSettings({controller}: {controller: FolioAccountController}) {
  const account = controller.account;
  const [name, setName] = useState(account?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [savingPassword, setSavingPassword] = useState(false);
  const nameId = useId(), emailId = useId(), currentId = useId(), passwordId = useId(), confirmId = useId(), passwordNoteId = useId();
  const busy = controller.busy || savingPassword;
  useEffect(() => {setName(account?.name ?? ''); setCurrentPassword(''); setNewPassword(''); setConfirm(''); setError('');}, [account?.id, account?.name]);
  if (!account) return <div className="account-settings"><p className="form-note">Log in to manage your profile.</p></div>;

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const invalid = accountNameError(name); if (invalid) {setError(invalid); return;}
    await controller.updateProfile(name);
  };
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const invalid = accountPasswordError(currentPassword) || accountPasswordError(newPassword);
    if (invalid) {setError(invalid); return;}
    if (newPassword !== confirm) {setError('The new passwords do not match.'); return;}
    setSavingPassword(true);
    try {if (await controller.changePassword({currentPassword, newPassword})) {setCurrentPassword(''); setNewPassword(''); setConfirm('');}}
    finally {setSavingPassword(false);}
  };

  return <div className="account-settings">
    <section className="settings-section">
      <h2>Your profile</h2><p className="form-note">Your account signs in to the shared workspace. All members see the same files and folders.</p>
      <form className="account-form" onSubmit={event => void saveProfile(event)}>
        <label className="form-field" htmlFor={nameId}><span>Name</span><input id={nameId} name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={busy}/></label>
        <label className="form-field" htmlFor={emailId}><span>Email</span><input id={emailId} value={account.email} readOnly type="email" aria-describedby={emailId + '-note'}/><small id={emailId + '-note'}>Your sign-in email. Email changes are not available here.</small></label>
        <div className="account-actions"><button className="button" type="submit" disabled={busy || name.normalize('NFC').trim() === account.name}>{controller.busy ? <LoaderCircle size={13} className="spin" aria-hidden="true"/> : <Check size={13} aria-hidden="true"/>}Save profile</button><span className="account-role">{account.role === 'owner' ? 'Workspace owner' : 'Workspace member'}</span></div>
      </form>
    </section>
    <section className="settings-section">
      <h2>Password</h2><p className="form-note" id={passwordNoteId}>Enter your current password to change it. Use 12–128 characters for the new password. Changing it logs out your other sessions.</p>
      <form className="account-form" onSubmit={event => void changePassword(event)}>
        <input type="text" name="username" autoComplete="username" value={account.email} readOnly className="account-autofill-username" tabIndex={-1} aria-hidden="true"/>
        <label className="form-field" htmlFor={currentId}><span>Current password</span><input id={currentId} name="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} minLength={12} maxLength={128} required disabled={busy}/></label>
        <div className="account-field-pair"><label className="form-field" htmlFor={passwordId}><span>New password</span><input id={passwordId} name="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={12} maxLength={128} required disabled={busy} aria-describedby={passwordNoteId}/></label><label className="form-field" htmlFor={confirmId}><span>Confirm new password</span><input id={confirmId} name="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={12} maxLength={128} required disabled={busy}/></label></div>
        <div className="account-actions"><button className="button" type="submit" disabled={busy}>{savingPassword && <LoaderCircle size={13} className="spin" aria-hidden="true"/>}Change password</button></div>
      </form>
    </section>
    {(error || controller.error) && <p className="inline-error" role="alert">{error || controller.error}</p>}
    {controller.notice && <p className="account-notice" role="status">{controller.notice}</p>}
    <section className="settings-section account-signout"><div><h2>This session</h2><p className="form-note">Log out of Folio on this browser.</p></div><button className="button" type="button" disabled={busy} onClick={() => void controller.logout()}><LogOut size={13} aria-hidden="true"/>Log out</button></section>
  </div>;
}
