import {useEffect, useId, useRef, useState} from 'react';
import {ArrowLeft, Library, LoaderCircle, LogIn, ShieldCheck} from 'lucide-react';
import type {FolioAccountController} from '../account/useFolioAccount';
import {accountNameError, accountPasswordError, SITE_SIGN_IN_PATH} from '../account/contracts';
import {clearConsumedAuthRoute, parseAuthRoute} from '../account/routes';
import type {AuthRoute} from '../account/routes';
import './account.css';

const loginRoute = (): AuthRoute => ({kind: 'login', email: '', token: '', invalidLink: false});

export function AuthPage({controller}: {controller: FolioAccountController}) {
  const [route, setRoute] = useState(() => parseAuthRoute(window.location.hash) ?? loginRoute());
  const [email, setEmail] = useState(route.email), [name, setName] = useState('');
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const emailId = useId(), nameId = useId(), passwordId = useId(), confirmId = useId(), noteId = useId();
  const setup = controller.state?.setupRequired ?? false;
  const canSetup = setup && controller.state?.canBootstrap;
  const mode = canSetup ? 'bootstrap' : route.kind;
  const creating = mode === 'bootstrap' || mode === 'register';
  const resetting = mode === 'recover';
  const needsLink = (mode === 'register' || resetting) && (!route.token || route.invalidLink);
  const busy = controller.busy;
  const error = formError || controller.error || (route.invalidLink ? 'This link is not valid. Ask for a new link and open it again.' : '');

  useEffect(() => {
    const changed = () => {
      const next = parseAuthRoute(window.location.hash) ?? loginRoute();
      setRoute(next); setEmail(next.email); setPassword(''); setConfirm(''); setFormError(''); controller.clearError();
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, [controller.clearError]);
  useEffect(() => {heading.current?.focus();}, [mode, controller.status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError('');
    const invalid = creating ? accountNameError(name) || accountPasswordError(password) : accountPasswordError(password);
    if (invalid) {setFormError(invalid); return;}
    if ((creating || resetting) && password !== confirm) {setFormError('The passwords do not match.'); return;}
    let done = false;
    if (mode === 'bootstrap') done = await controller.bootstrap({email, name, password});
    else if (mode === 'register') done = await controller.register({email, name, password, token: route.token});
    else if (resetting) done = await controller.recover({email, token: route.token, newPassword: password});
    else done = await controller.login({email, password});
    if (!done) return;
    setPassword(''); setConfirm('');
    if (resetting) {clearConsumedAuthRoute('login'); setEmail(email);}
    else if (parseAuthRoute(window.location.hash)) clearConsumedAuthRoute('html');
  };

  const recoverOwner = async () => {
    const capability = await controller.createOwnerRecovery();
    if (!capability) return;
    // The capability stays only in this mounted form, never browser storage.
    setRoute({kind: 'recover', email: capability.email, token: capability.token, invalidLink: false});
    setEmail(capability.email); setPassword(''); setConfirm(''); setFormError('');
  };

  const title = controller.status === 'loading' ? 'Opening Folio' : controller.status === 'error' ? 'Account unavailable'
    : setup && !canSetup ? 'Owner setup needed'
    : mode === 'bootstrap' ? 'Create your owner account' : mode === 'register' ? 'Join the workspace'
    : resetting ? 'Reset your password' : 'Log in to Folio';

  return <main className="auth-page">
    <section className="auth-panel" aria-labelledby="folio-auth-title">
      <div className="auth-brand"><Library size={19} aria-hidden="true"/><span>Folio</span></div>
      <h1 id="folio-auth-title" ref={heading} tabIndex={-1}>{title}</h1>
      {controller.notice && <p className="account-notice" role="status">{controller.notice}</p>}
      {controller.status === 'loading' ? <p className="account-status" role="status"><LoaderCircle size={15} className="spin" aria-hidden="true"/>Checking your account…</p>
        : controller.status === 'error' ? <><p className="inline-error" role="alert">{controller.error}</p><button className="button" type="button" onClick={() => void controller.refresh()}>Try again</button></>
        : setup && !canSetup ? <><p className="form-note">The configured Site owner needs to create the Folio owner account before this workspace can be used.</p><div className="account-actions"><button className="button" type="button" onClick={() => void controller.refresh()}>Check again</button><a className="text-button" href={SITE_SIGN_IN_PATH} target="_top">Sign in to the Site</a></div></>
        : controller.account && mode === 'login' ? <><p className="form-note">You are logged in as {controller.account.email}.</p><div className="account-actions"><button className="button primary" type="button" onClick={() => clearConsumedAuthRoute('html')}>Open workspace</button><button className="text-button" type="button" disabled={busy} onClick={() => void controller.logout()}>Log out</button></div></>
        : <>
          <p className="auth-intro">{mode === 'bootstrap' ? 'Set up a separate Folio sign-in for this shared workspace.'
            : mode === 'register' ? 'Create your account to use the same library as your teammates.'
            : resetting ? 'Choose a new Folio password. Your existing sessions will be logged out.'
            : 'Open your shared HTML, images and icon library.'}</p>
          {needsLink ? <div className="account-recovery-help">
            {error && <p className="inline-error" role="alert">{error}</p>}
            <p className="form-note">{mode === 'register' ? 'Registration needs an invitation link from the workspace owner.' : 'Ask the workspace owner for a password recovery link. No reset email is sent automatically.'}</p>
            {resetting && controller.state?.canRecoverOwner && <><p className="form-note">Your current Site sign-in can recover this workspace’s owner account.</p><button className="button" type="button" disabled={busy} onClick={() => void recoverOwner()}>{busy && <LoaderCircle size={13} className="spin" aria-hidden="true"/>}Recover owner account</button></>}
          </div> : <form className="account-form auth-form" onSubmit={event => void submit(event)}>
            {creating && <label className="form-field" htmlFor={nameId}><span>Name</span><input id={nameId} name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={busy}/></label>}
            <label className="form-field" htmlFor={emailId}><span>Email</span><input id={emailId} name="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required readOnly={(mode === 'register' || resetting) && !!route.email} disabled={busy} spellCheck={false} autoCapitalize="none"/></label>
            <label className="form-field" htmlFor={passwordId}><span>{resetting ? 'New password' : 'Password'}</span><input id={passwordId} name={creating || resetting ? 'new-password' : 'password'} type="password" autoComplete={creating || resetting ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} required disabled={busy} aria-describedby={creating || resetting ? noteId : undefined}/></label>
            {(creating || resetting) && <><label className="form-field" htmlFor={confirmId}><span>Confirm password</span><input id={confirmId} name="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={12} maxLength={128} required disabled={busy}/></label><p id={noteId} className="form-note">Use 12–128 characters.</p></>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="button primary auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" aria-hidden="true"/> : <LogIn size={14} aria-hidden="true"/>}{busy ? 'Please wait…' : mode === 'bootstrap' ? 'Create owner account' : mode === 'register' ? 'Create account' : resetting ? 'Reset password' : 'Log in'}</button>
          </form>}
          {!canSetup && <div className="auth-navigation">{mode === 'login' ? <><a href="#recover">Forgot password?</a><a href="#register">Have an invitation?</a></> : <a href="#login"><ArrowLeft size={12} aria-hidden="true"/>Back to login</a>}</div>}
          {mode === 'register' && <p className="form-note account-site-note">Your teammate invitation also requires access to this private Site. Ask the owner if the Site itself will not open.</p>}
        </>}
      <p className="auth-footnote"><ShieldCheck size={12} aria-hidden="true"/>Folio accounts and your AI connection are managed separately.</p>
    </section>
  </main>;
}
