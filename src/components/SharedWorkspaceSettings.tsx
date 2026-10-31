import {useEffect, useState} from 'react';
import {CloudUpload, LoaderCircle, RefreshCw} from 'lucide-react';
import {discardRecoveryChange, inspectBrowserData, isSharedWorkspaceEnabled, listRecoveryChanges, migrateBrowserData, retryRecoveryChange} from '../shared/workspace';
import type {MigrationInventory, RecoveryChange} from '../shared/workspace';
import '../shared/workspace.css';

const bytes = (value: number) => value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / (1024 * 1024)).toFixed(1)} MiB`;

export function SharedWorkspaceSettings() {
  const [inventory, setInventory] = useState<MigrationInventory | null>(null);
  const [retained, setRetained] = useState<RecoveryChange[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const enabled = isSharedWorkspaceEnabled();
  async function inspect() {
    const [next, pending] = await Promise.all([inspectBrowserData(), enabled ? listRecoveryChanges() : Promise.resolve([])]);
    setInventory(next); setRetained(pending);
  }
  useEffect(() => {void inspect().catch(failure => setError(failure instanceof Error ? failure.message : 'Browser files could not be inspected.'));}, []);
  async function run(action: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(action); setError(''); setNotice('');
    try {await work(); await inspect();} catch (failure) {setError(failure instanceof Error ? failure.message : 'The workspace change failed.'); await inspect().catch(() => undefined);} finally {setBusy('');}
  }
  return <div className="shared-workspace-settings">
    <section className="settings-section">
      <h2>Browser files</h2>
      <p className="form-note">Share files saved in this browser with everyone in this workspace. Your original browser copies are kept. The existing cloud collection is already shared.</p>
      {!inventory ? <p className="form-note" role="status">Checking browser storage…</p> : <>
        <dl className="shared-inventory">
          <div><dt>HTML and images</dt><dd>{inventory.library.items} items · {inventory.library.folders} folders · {bytes(inventory.library.bytes)}</dd></div>
          <div><dt>Icons</dt><dd>{inventory.icons.items} conversions · {inventory.icons.saved} saved · {bytes(inventory.icons.bytes)}</dd></div>
          <div><dt>Destination</dt><dd>This shared workspace</dd></div>
        </dl>
        <div className="shared-settings-actions">
          <button className="button primary" disabled={!enabled || !inventory.hasData || !!busy} onClick={() => void run('migrate', async () => {const result = await migrateBrowserData(); setNotice(result.library || result.icons ? 'Browser files are shared. The original copies are still on this device.' : 'These browser files have already been shared.');})}>{busy === 'migrate' ? <LoaderCircle size={13} className="spin"/> : <CloudUpload size={13}/>}Share browser files</button>
          <button className="button" disabled={!!busy} onClick={() => void run('inspect', inspect)}><RefreshCw size={13}/>Refresh inventory</button>
        </div>
        {!enabled && <p className="form-note">Sign in to the hosted workspace to share these files.</p>}
      </>}
    </section>
    {retained.length > 0 && <section className="settings-section"><h2>Retained changes</h2><p className="form-note">These changes did not receive a complete shared save. Retry checks the current server version before applying them.</p>
      <ul className="shared-retained-list">{retained.map(change => <li key={change.id}>
        <div><strong>{change.kind === 'icons' ? 'Icons' : 'Library'} change</strong><p>{change.error}</p></div>
        <div className="shared-settings-actions">
          <button className="button" disabled={!!busy} onClick={() => void run(change.id, async () => {await retryRecoveryChange(change.id); setNotice('The retained change is now saved to the shared workspace.');})}>{busy === change.id ? <LoaderCircle size={12} className="spin"/> : <RefreshCw size={12}/>}Retry</button>
          {confirmDiscard === change.id ? <><button className="button danger" disabled={!!busy} onClick={() => void run(`discard-${change.id}`, async () => {await discardRecoveryChange(change.id); setConfirmDiscard(null); setNotice('The unsaved staged copy was discarded. Shared files and original browser files were kept.');})}>Confirm discard</button><button className="button" onClick={() => setConfirmDiscard(null)} disabled={!!busy}>Cancel</button></> : <button className="text-button" disabled={!!busy} onClick={() => setConfirmDiscard(change.id)}>Discard staged copy</button>}
        </div>
      </li>)}</ul>
    </section>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {notice && <p className="form-note" role="status">{notice}</p>}
  </div>;
}
