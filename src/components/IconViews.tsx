import './icon-views.css';

export function IconViews({view, savedCount, onChange}: {view: 'convert' | 'saved'; savedCount: number; onChange: (view: 'convert' | 'saved') => void}) {
  return <div className="mode-switch icon-view-switch" role="group" aria-label="Icons view">
    <button type="button" data-icon-view="convert" className={view === 'convert' ? 'active' : ''} aria-pressed={view === 'convert'} onClick={() => onChange('convert')}>Convert</button>
    <button type="button" data-icon-view="saved" className={view === 'saved' ? 'active' : ''} aria-pressed={view === 'saved'} onClick={() => onChange('saved')}>Saved <span>{savedCount}</span></button>
  </div>;
}
