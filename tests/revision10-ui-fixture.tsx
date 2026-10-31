/// <reference types="vite/client" />
import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Modal} from '../src/components/Modal';
import {PopoverSelect} from '../src/components/PopoverSelect';
import {SettingsPage} from '../src/components/SettingsPage';
import {settingsSectionFromHash} from '../src/settings-route';
import type {SettingsSection} from '../src/settings-route';
import '../src/styles.css';
import './revision10-ui-fixture.css';

// Actual components and styles, manual browser input, no accounts, storage or API fixture.
if (!import.meta.env.DEV) throw new Error('The UI fixture is development-only.');

const workspaceOptions = [{value: 'html', label: 'HTML'}, {value: 'images', label: 'Images'}, {value: 'icons', label: 'Icons'}];
const modeOptions = [
  {value: 'pixels', label: 'Pixel vectors · exact grid'},
  {value: 'smooth', label: 'Smooth curves · approximate'},
  {value: 'embedded', label: 'Embedded bitmap · original bytes'},
  {value: 'disabled', label: 'Unavailable mode', disabled: true},
];
const logoutError = 'Log out could not be confirmed. Your session is still open. Please try again.';

function DialogFixture() {
  const [workspace, setWorkspace] = useState('html');
  const [mode, setMode] = useState('pixels');
  const [open, setOpen] = useState(false);
  return <main className="qa-ui-controls">
    <h1>Dialog and dropdown checks</h1>
    <p>Use real pointer or keyboard input. Open the modal, choose an option, then press Escape twice to check nested dismissal and focus return.</p>
    <button className="button primary" onClick={() => setOpen(true)}>Open native modal</button>
    <label className="qa-ui-field"><span>Outside-dialog workspace</span><PopoverSelect aria-label="Outside-dialog workspace" value={workspace} onValueChange={setWorkspace} options={workspaceOptions}/></label>
    <output aria-live="polite">Workspace: {workspace} · Modal mode: {mode} · Modal: {open ? 'open' : 'closed'}</output>
    <button className="button" type="button">Following focus target</button>
    {open && <Modal title="Native dialog dropdown" onClose={() => setOpen(false)}>
      <div className="modal-body">
        <label className="qa-ui-field"><span>Conversion mode</span><PopoverSelect aria-label="Native dialog conversion mode" value={mode} onValueChange={setMode} options={modeOptions}/></label>
        <p className="form-note" role="status">Selected value: <strong>{mode}</strong></p>
        <label className="qa-ui-field"><span>Following text field</span><input className="text-input" aria-label="Following text field" placeholder="Tab should reach this field"/></label>
      </div>
      <div className="modal-footer"><button className="button" onClick={() => setOpen(false)}>Close modal</button></div>
    </Modal>}
  </main>;
}

function SettingsFixture() {
  const [section, setSection] = useState<SettingsSection>(() => settingsSectionFromHash(location.hash) ?? 'appearance');
  const [attempts, setAttempts] = useState(0);
  const [choice, setChoice] = useState('html');
  useEffect(() => {
    const onHash = () => setSection(settingsSectionFromHash(location.hash) ?? 'appearance');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return <SettingsPage section={section} owner name="Synthetic teammate with a long display name" busy={false} error={logoutError}
    onLogout={() => setAttempts(value => value + 1)} returnHref="?frame=1&surface=controls">
    <section className="settings-section">
      <h2>Synthetic settings content</h2>
      <p className="form-note">This is the actual Settings page shell and stylesheet. The footer shows a synthetic logout error in every section.</p>
      <label className="qa-ui-field"><span>Preview choice</span><PopoverSelect aria-label="Settings preview choice" value={choice} onValueChange={setChoice} options={workspaceOptions}/></label>
      <p className="form-note" role="status">Selected value: {choice}. Synthetic logout attempts: {attempts}.</p>
    </section>
    <section className="settings-section"><h2>Scroll target</h2><p className="form-note">This second section makes content scrolling observable at a 360-pixel viewport height. No profile, credential or shared-data request runs here.</p></section>
  </SettingsPage>;
}

function Runner() {
  const [surface, setSurface] = useState<'controls' | 'settings'>('controls');
  const [size, setSize] = useState({width: 390, height: 360});
  const frameUrl = `/tests/revision10-ui-fixture.html?frame=1&surface=${surface}`;
  return <main className="qa-ui-runner">
    <header><h1>Folio revision 10 · isolated UI checks</h1><p>Real components and styles. Manual input only; no API, account or browser-storage operations.</p></header>
    <div className="qa-ui-actions" aria-label="Fixture surface">
      <button className="button" aria-pressed={surface === 'controls'} onClick={() => setSurface('controls')}>Dialog + dropdowns</button>
      <button className="button" aria-pressed={surface === 'settings'} onClick={() => setSurface('settings')}>Settings + logout error</button>
    </div>
    <div className="qa-ui-actions" aria-label="Fixture viewport">
      {[320, 390, 640].map(width => <button className="button" key={width} aria-pressed={size.width === width && size.height === 360} onClick={() => setSize({width, height: 360})}>{width} × 360</button>)}
      <label>Width <input type="number" min={240} max={1600} value={size.width} onChange={event => {const value = event.target.valueAsNumber; if (Number.isFinite(value)) setSize(current => ({...current, width: Math.max(240, Math.min(1600, value))}));}}/></label>
      <label>Height <input type="number" min={240} max={1200} value={size.height} onChange={event => {const value = event.target.valueAsNumber; if (Number.isFinite(value)) setSize(current => ({...current, height: Math.max(240, Math.min(1200, value))}));}}/></label>
    </div>
    <p role="status">Inner viewport: {size.width} × {size.height} CSS pixels. <a href={frameUrl} target="_blank" rel="noreferrer">Open this fixture directly</a></p>
    <div className="qa-ui-frame-area"><iframe key={surface} title={surface === 'controls' ? 'Native modal and custom dropdown fixture' : 'Settings and logout error fixture'} src={frameUrl} style={{width: size.width, height: size.height}}/></div>
  </main>;
}

const query = new URLSearchParams(location.search);
const content = query.get('frame') === '1' ? query.get('surface') === 'settings' ? <SettingsFixture/> : <DialogFixture/> : <Runner/>;
createRoot(document.getElementById('root')!).render(<StrictMode>{content}</StrictMode>);
