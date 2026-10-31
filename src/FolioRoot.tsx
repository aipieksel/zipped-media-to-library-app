import {useEffect, useRef, useState} from 'react';
import {LoaderCircle} from 'lucide-react';
import App from './App';
import {AuthPage} from './components/AuthPage';
import {useFolioAccount} from './account/useFolioAccount';
import {isAuthRoute} from './account/routes';
import {configureSharedWorkspace, startSharedWorkspace, stopSharedWorkspace} from './shared/workspace';
import './components/shell.css';

/** The private workspace never mounts before account and shared-storage admission. */
export function FolioRoot() {
  const controller = useFolioAccount();
  const [hash, setHash] = useState(window.location.hash);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [storageError, setStorageError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const transitions = useRef<Promise<void>>(Promise.resolve());
  const refreshAccount = useRef(controller.refresh);
  refreshAccount.current = controller.refresh;
  const accountId = controller.account?.id ?? null;
  useEffect(() => {
    const change = () => setHash(window.location.hash);
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    let active = true;
    setReadyFor(null); setStorageError('');
    transitions.current = transitions.current.catch(() => undefined).then(async () => {
      if (!active || !accountId) return;
      configureSharedWorkspace({enabled: true, onUnauthorized: () => {void refreshAccount.current();}});
      try {
        await startSharedWorkspace();
        if (active) setReadyFor(accountId);
      } catch (error) {
        if (active) setStorageError(error instanceof Error ? error.message : 'The shared workspace could not be opened.');
      }
    });
    return () => {
      active = false;
      transitions.current = transitions.current.catch(() => undefined).then(() => stopSharedWorkspace());
    };
  }, [accountId, attempt]);

  if (controller.status === 'loading') return <div className="session-loading" role="status"><LoaderCircle className="spin" size={20}/><p>Opening Folio…</p></div>;
  if (!controller.account || isAuthRoute(hash)) return <AuthPage controller={controller}/>;
  if (readyFor !== accountId) return <div className="session-loading" role={storageError ? 'alert' : 'status'}>
    {!storageError && <LoaderCircle className="spin" size={20}/>}
    <p>{storageError || 'Opening the shared workspace…'}</p>
    {storageError && <><button className="button primary" onClick={() => setAttempt(value => value + 1)}>Try again</button><button className="text-button" onClick={() => void controller.logout()}>Log out</button></>}
  </div>;
  return <App key={accountId} accountController={controller}/>;
}
