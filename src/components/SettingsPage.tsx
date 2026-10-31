import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {ArrowLeft, FolderSync, LogOut, Palette, Settings, Sparkles, UserRound, UsersRound} from 'lucide-react';
import type {SettingsSection} from '../settings-route';
import './shell.css';

const sections = [
  {id: 'profile', label: 'Profile', icon: UserRound, description: 'Your Folio account and password.'},
  {id: 'ai', label: 'AI', icon: Sparkles, description: 'Connect your local AI companion and choose a model.'},
  {id: 'appearance', label: 'Appearance', icon: Palette, description: 'Make the shared workspace feel like yours.'},
  {id: 'workspace', label: 'Workspace', icon: FolderSync, description: 'Shared files and this browser’s existing imports.'},
  {id: 'accounts', label: 'Accounts', icon: UsersRound, description: 'Manage access to the same shared workspace.'},
] as const;

export function SettingsPage({section, owner, name, busy, onLogout, returnHref, children}: {
  section: SettingsSection; owner: boolean; name: string; busy: boolean;
  onLogout: () => void; returnHref: string; children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const current = sections.find(item => item.id === section)!;
  useEffect(() => {
    heading.current?.focus({preventScroll: true});
  }, [section]);
  return <div className="settings-page">
    <aside className="settings-sidebar" aria-label="Settings navigation">
      <a className="settings-return" href={returnHref}><ArrowLeft size={15}/>Back to library</a>
      <div className="settings-sidebar-title"><Settings size={17}/><strong>Settings</strong></div>
      <nav aria-label="Settings sections">
        {sections.filter(item => item.id !== 'accounts' || owner).map(({id, label, icon: Icon}) =>
          <a key={id} href={`#settings/${id}`} className={section === id ? 'active' : ''} aria-current={section === id ? 'page' : undefined}><Icon size={16}/>{label}</a>)}
      </nav>
      <div className="settings-sidebar-footer">
        <span className="settings-account-name" title={name}>{name}</span>
        <button className="settings-logout" type="button" onClick={onLogout} disabled={busy}><LogOut size={15}/>{busy ? 'Please wait…' : 'Log out'}</button>
      </div>
    </aside>
    <main className="settings-main">
      <div className="settings-content">
        <header className="settings-page-heading"><h1 ref={heading} tabIndex={-1}>{current.label}</h1><p>{current.description}</p></header>
        {children}
      </div>
    </main>
  </div>;
}
