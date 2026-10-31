import {useEffect, useRef, useState} from 'react';
import {CheckCircle2, Download, LoaderCircle, Save, Settings2, Sparkles, Square, X} from 'lucide-react';
import type {AiOperation, AiSvgResult} from '../ai/contracts';
import {AI_LIMITS} from '../ai/contracts';
import type {AiSettingsController} from '../ai/useAiSettings';
import {prepareAiImage} from '../ai/client';
import {checkArtworkPixels, describeFidelity} from '../ai/fidelity';
import {sanitizeSvg} from '../saved-svg';
import type {SaveArtworkInput, SavedIconRecord} from '../icon-types';
import type {PngSvgFidelity, PngSvgResult} from '../png-svg-browser';
import {allocateSvgFilename} from '../png-svg';
import {uniqueId} from '../identity';
import {normalizeValidatedAiSource} from '../ai/source';
import {PopoverSelect} from './PopoverSelect';

export interface AiAsset {
  key: string;
  id: string;
  name: string;
  kind: 'icons' | 'images';
  revision?: number;
  folderId?: string;
  getSource: () => Promise<Blob | undefined>;
  getCurrentSvg?: () => Promise<string | undefined>;
}
interface Candidate {
  result: AiSvgResult;
  source: Blob;
  width: number;
  height: number;
  fidelity?: PngSvgFidelity;
  verification?: PngSvgResult['verification'];
  checkError?: string;
}
interface Props {
  ai: AiSettingsController;
  asset: AiAsset;
  onSettings: () => void;
  onSave: (input: SaveArtworkInput) => Promise<SavedIconRecord>;
  onSaved?: (saved: SavedIconRecord) => void;
  onClose?: () => void;
}

/** One candidate belongs to one captured source revision. Parent keys this panel by asset.key. */
export function AiSvgPanel({ai, asset, onSettings, onSave, onSaved, onClose}: Props) {
  const [operation, setOperation] = useState<AiOperation>('recreate-svg');
  const [instructions, setInstructions] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [stage, setStage] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [urls, setUrls] = useState<{source: string; output: string} | null>(null);
  const work = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const sequence = useRef(0);
  const canGenerate = !!ai.selection && !!ai.model?.supportsImages && !!ai.provider?.capabilities.includes(operation);
  useEffect(() => {alive.current = true; return () => {alive.current = false; sequence.current++; work.current?.abort();};}, [asset.key]);
  useEffect(() => {
    if (!candidate) {setUrls(null); return;}
    const source = URL.createObjectURL(candidate.source), output = URL.createObjectURL(new Blob([candidate.result.svg], {type: 'image/svg+xml'}));
    setUrls({source, output}); return () => {URL.revokeObjectURL(source); URL.revokeObjectURL(output);};
  }, [candidate]);
  const cancel = () => {sequence.current++; work.current?.abort(); work.current = null; setBusy(false); setStage(''); setNotice('AI request cancelled. Your existing conversion is unchanged.');};
  const generate = async () => {
    if (!canGenerate || !ai.selection || busy || saving || ai.activeRequestId) return;
    const controller = new AbortController(), run = ++sequence.current; work.current = controller;
    setBusy(true); setError(''); setNotice(''); setStage('Preparing the selected original…');
    try {
      const original = await asset.getSource();
      if (!original) throw new Error('This original image is no longer available. Select it again.');
      const image = await prepareAiImage(original, asset.name, controller.signal);
      const source = await normalizeValidatedAiSource(original, controller.signal);
      let currentSvg = await asset.getCurrentSvg?.();
      if (currentSvg && new Blob([currentSvg]).size > AI_LIMITS.svgBytes) {
        if (operation === 'clean-svg') throw new Error('This SVG is too large to send for cleanup. Choose Recreate to work directly from the original image.');
        currentSvg = undefined; setNotice('The conversion is too large to include. AI will recreate the design from the original image.');
      }
      if (controller.signal.aborted) return;
      setStage('Recreating editable SVG artwork…');
      const result = await ai.generate({...ai.selection, requestId: uniqueId(), operation, image, currentSvg, instructions}, controller.signal);
      if (run !== sequence.current || !alive.current || controller.signal.aborted) return;
      const validated = sanitizeSvg(result.svg, {width: image.width, height: image.height, profile: 'ai'});
      const next: Candidate = {result: {...result, svg: validated.svg}, source, width: image.width, height: image.height};
      setStage('Checking the SVG at its original size…');
      try {Object.assign(next, await checkArtworkPixels(validated.svg, source, image.width, image.height, controller.signal));}
      catch (failure) {if (controller.signal.aborted) throw failure; next.checkError = failure instanceof Error ? failure.message : 'The native pixel check could not finish.';}
      if (run !== sequence.current || !alive.current || controller.signal.aborted) return;
      setCandidate(next); setSavedId(null); setNotice('AI candidate ready. Review its preview and native pixel check before saving.');
    } catch (failure) {if (run === sequence.current && alive.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'AI could not create an SVG.');}
    finally {if (work.current === controller) {work.current = null; if (alive.current) {setBusy(false); setStage('');}}}
  };
  const save = async () => {
    if (!candidate || saving || savedId || busy) return;
    const run = sequence.current; setSaving(true); setError('');
    try {
      const mime = candidate.source.type;
      if (!['image/png', 'image/webp', 'image/jpeg'].includes(mime)) throw new Error('The source has an unsupported image type.');
      const saved = await onSave({name: asset.name, folderId: asset.folderId, svg: candidate.result.svg, width: candidate.width, height: candidate.height,
        source: {kind: asset.kind, id: asset.id, revision: asset.revision, name: asset.name, mime: mime as 'image/png' | 'image/webp' | 'image/jpeg', blob: candidate.source},
        provenance: {kind: 'ai', provider: candidate.result.provider, model: candidate.result.model, generatedAt: candidate.result.createdAt}, fidelity: candidate.fidelity, verification: candidate.verification});
      if (run !== sequence.current || !alive.current) return;
      setSavedId(saved.id); onSaved?.(saved);
    } catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : 'The icon could not be saved.');}
    finally {if (alive.current) setSaving(false);}
  };
  const download = () => {
    if (!candidate) return;
    const url = URL.createObjectURL(new Blob([candidate.result.svg], {type: 'image/svg+xml'})), link = document.createElement('a');
    link.href = url; link.download = allocateSvgFilename(asset.name, new Set()); link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return <section className="ai-svg-panel" aria-label="AI SVG studio">
    <div className="ai-panel-heading"><Sparkles size={15}/><h3>Recreate with AI</h3><span>{ai.selection?.model ?? 'Connect in AI settings'}</span>{onClose && <button className="icon-button" aria-label="Close AI studio" onClick={onClose}><X size={14}/></button>}</div>
    <p className="form-note">Rebuild the same design with clean, editable shapes and curves. The selected original and SVG go to your AI provider when you generate. Review the result before saving.</p>
    {!canGenerate && <div className="ai-connect-prompt"><p>{ai.selection && !ai.model?.supportsImages ? 'Choose a model that supports images in AI settings.' : ai.provider?.reason ?? 'Connect your local companion and choose a model to use AI here.'}</p><button className="button" onClick={onSettings}><Settings2 size={13}/>AI settings</button></div>}
    <div className="ai-prompt-controls">
      <label className="form-field"><span>Task</span><PopoverSelect aria-label="AI SVG task" value={operation} disabled={busy} onValueChange={value => setOperation(value as AiOperation)} options={[{value:'recreate-svg',label:'Recreate from the image'},{value:'clean-svg',label:'Clean up the current SVG',disabled:!asset.getCurrentSvg}]}/></label>
      <label className="form-field ai-instructions"><span>Instructions <small>optional</small></span><textarea aria-label="AI SVG instructions" rows={2} maxLength={AI_LIMITS.instructions} value={instructions} disabled={busy} onChange={event => setInstructions(event.target.value)} placeholder="For example: smooth the circular edges, preserve the spacing and keep the original colors."/></label>
    </div>
    <div className="ai-generate-actions"><button className="button primary" disabled={!canGenerate || busy || saving || !!ai.activeRequestId} onClick={() => void generate()}>{busy ? <LoaderCircle className="spin" size={13}/> : <Sparkles size={13}/>}Generate SVG</button>{busy && <button className="button" onClick={cancel}><Square size={12}/>Cancel</button>}<span role="status">{stage}</span></div>
    {error && <p className="inline-error" role="alert">{error}</p>}{notice && <p className="form-note" role="status">{notice}</p>}
    {candidate && urls && <div className="ai-candidate">
      <div className="png-comparison ai-comparison">
        <section className="png-preview-card"><header><span>Original image</span><span>{candidate.width} × {candidate.height}</span></header><div className="ai-artwork-surface"><img src={urls.source} alt={`Original ${asset.name}`} width={candidate.width} height={candidate.height}/></div></section>
        <section className="png-preview-card"><header><span>AI candidate</span><span>Editable vector artwork</span></header><div className="ai-artwork-surface"><img src={urls.output} alt={`AI SVG candidate for ${asset.name}`} width={candidate.width} height={candidate.height}/></div></section>
      </div>
      <div className="ai-candidate-details"><strong>{describeFidelity(candidate.fidelity)}</strong><p>{candidate.checkError ?? 'Native-size sRGB comparison in this browser. AI reconstruction is an approximation; inspect the shape and detail.'}</p>{candidate.result.summary && <p>{candidate.result.summary}</p>}</div>
      <div className="ai-candidate-actions"><button className="button primary" disabled={saving || busy || !!savedId} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={13}/> : savedId ? <CheckCircle2 size={13}/> : <Save size={13}/>} {savedId ? 'Saved to library' : saving ? 'Saving…' : 'Save to icon library'}</button><button className="button" onClick={download}><Download size={13}/>Download candidate</button><button className="text-button" disabled={saving || busy} onClick={() => {sequence.current++; setCandidate(null); setSavedId(null); setError('');}}>Discard candidate</button></div>
    </div>}
  </section>;
}
