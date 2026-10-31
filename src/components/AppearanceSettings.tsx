import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {LoaderCircle, RotateCcw, Save} from 'lucide-react';
import {APPEARANCE_FIELDS, DEFAULT_APPEARANCE, applyAppearance, normalizeAppearance, sameAppearance, validateAppearance} from '../appearance';
import type {AppearanceField, AppearancePalette} from '../appearance';
import './appearance.css';

export interface AppearanceSettingsProps {
  value: AppearancePalette;
  onSave: (palette: AppearancePalette) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function AppearanceSettings({value, onSave, loading = false, error}: AppearanceSettingsProps) {
  const prefix = useId();
  const valueKey = APPEARANCE_FIELDS.map(field => value[field.key]).join('|');
  const [baseline, setBaseline] = useState(() => normalizeAppearance(value));
  const [draft, setDraft] = useState<AppearancePalette>(() => normalizeAppearance(value));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [staleDraft, setStaleDraft] = useState(false);
  const saved = useRef(normalizeAppearance(value));
  const mounted = useRef(true);
  const dirty = !sameAppearance(draft, baseline);
  const draftRef = useRef(draft);
  const baselineRef = useRef(baseline);
  draftRef.current = draft;
  baselineRef.current = baseline;
  const validation = useMemo(() => validateAppearance(draft), [draft]);

  useEffect(() => {
    const next = normalizeAppearance(value);
    saved.current = next;
    if (!sameAppearance(next, baselineRef.current)) {
      if (sameAppearance(draftRef.current, baselineRef.current)) {
        setDraft(next); setBaseline(next); setStaleDraft(false);
      } else if (sameAppearance(draftRef.current, next)) {
        setBaseline(next); setStaleDraft(false);
      } else {
        setStaleDraft(true);
      }
    }
    // A repeated server response with identical values must not discard an edited draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  useEffect(() => {
    if (validation.valid) applyAppearance(validation.palette);
  }, [validation]);

  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false; applyAppearance(saved.current);};
  }, []);

  function updateColor(key: AppearanceField, next: string) {
    setDraft(current => ({...current, [key]: next})); setNotice(''); setSaveError(null);
  }

  function discard() {
    const next = {...saved.current};
    setDraft(next); setBaseline(next); setStaleDraft(false); setSaveError(null); setNotice('');
    applyAppearance(next);
  }

  async function persist(next: AppearancePalette, reset = false) {
    if (saving || loading || staleDraft) return;
    const checked = validateAppearance(next);
    if (!checked.valid) return;
    setSaving(true); setSaveError(null); setNotice('');
    try {
      await onSave(checked.palette);
      saved.current = checked.palette;
      if (mounted.current) {
        setBaseline(checked.palette); setDraft(checked.palette); setStaleDraft(false);
        setNotice(reset ? 'Default colors saved.' : 'Colors saved for this workspace.');
      }
    } catch (failure) {
      if (mounted.current) setSaveError(failure instanceof Error ? failure.message : 'The colors could not be saved. Your changes are still here.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const busy = loading || saving;
  return <form className="appearance-settings" onSubmit={event => {event.preventDefault(); if (validation.valid) void persist(validation.palette);}} aria-busy={busy}>
    <section className="settings-section">
      <h3>Workspace colors</h3>
      <p className="form-note">Preview changes here, then save them for everyone in this workspace. Image and icon colors stay the same.</p>
      <div className="appearance-fields">
        {APPEARANCE_FIELDS.map(({key, label, description}) => {
          const fieldError = validation.valid ? undefined : validation.errors[key];
          const inputId = `${prefix}-${key}`;
          const validColor = /^#[\da-f]{6}$/i.test(draft[key]) ? draft[key] : baseline[key];
          return <div className="appearance-field" key={key}>
            <label className="appearance-label" htmlFor={inputId}><span>{label}</span><small>{description}</small></label>
            <div className="appearance-color-inputs">
              <input type="color" aria-label={`${label} color`} value={validColor} onChange={event => updateColor(key, event.target.value)} disabled={busy} aria-describedby={fieldError ? `${inputId}-error` : undefined}/>
              <input id={inputId} type="text" aria-label={`${label} hex value`} value={draft[key]} onChange={event => updateColor(key, event.target.value)} disabled={busy} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={7} aria-invalid={!!fieldError} aria-describedby={fieldError ? `${inputId}-error` : undefined}/>
            </div>
            {fieldError && <p id={`${inputId}-error`} className="appearance-field-error">{fieldError}</p>}
          </div>;
        })}
      </div>
    </section>
    {staleDraft && <p className="inline-error" role="alert">Workspace colors changed while you were editing. Discard your draft to load the saved colors before continuing.</p>}
    {!validation.valid && <p className="form-note" role="status">{validation.message}</p>}
    {(saveError || error) && <p className="inline-error" role="alert">{saveError || error}</p>}
    <div className="appearance-actions">
      <button className="button" type="button" onClick={() => void persist({...DEFAULT_APPEARANCE}, true)} disabled={busy || staleDraft || (sameAppearance(baseline, DEFAULT_APPEARANCE) && !dirty)}><RotateCcw size={13}/>Reset to defaults</button>
      <span className="flex-space"/>
      {(dirty || staleDraft) && <button className="button" type="button" onClick={discard} disabled={busy}>Discard</button>}
      <button className="button primary" type="submit" disabled={busy || staleDraft || !dirty || !validation.valid}>{saving ? <LoaderCircle size={13} className="spin"/> : <Save size={13}/>}Save colors</button>
    </div>
    <p className="appearance-save-status form-note" role="status" aria-live="polite">{notice || (dirty && validation.valid && !staleDraft ? 'Previewing unsaved colors.' : '')}</p>
  </form>;
}
