import {useEffect, useRef, useState} from 'react';
import {Bookmark, Download, LoaderCircle, RotateCcw, ShieldCheck} from 'lucide-react';
import type {useIconCollection} from '../useIconCollection';
import {checkArtworkPixels, describeFidelity} from '../ai/fidelity';
import {buildSvgZip} from '../png-svg-download';
import {IconViews} from './IconViews';
import {PopoverSelect} from './PopoverSelect';

type Collection = ReturnType<typeof useIconCollection>;
interface Props {collection: Collection; selectedId: string | null; filteredIds: string[]; onViewChange: (view: 'convert' | 'saved') => void}
function download(blob: Blob, name: string) {const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);}

export function SavedIconsWorkspace({collection, selectedId, filteredIds, onViewChange}: Props) {
  const item = collection.saved.find(value => value.id === selectedId);
  const [urls, setUrls] = useState<{id: string; revision: number; source: string; output: string} | null>(null);
  const [color, setColor] = useState('#000000'), [busy, setBusy] = useState(false), [packing, setPacking] = useState(false);
  const [checking, setChecking] = useState(false), [error, setError] = useState('');
  const [zoom, setZoom] = useState<'fit' | '1' | '2' | '4'>('1');
  const [background, setBackground] = useState('checker');
  const validColor = /^#[0-9a-f]{6}$/i.test(color);
  const alive = useRef(true);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useEffect(() => {setColor(item?.color ?? '#000000'); setError('');}, [item?.id, item?.revision]);
  useEffect(() => {
    const controller = new AbortController(); const owned: string[] = [];
    setUrls(null); setChecking(false);
    if (item) void (async () => {
      const [source, output] = await Promise.all([collection.getSavedSource(item.id), collection.getSavedOutput(item.id, item.revision)]);
      if (controller.signal.aborted) return;
      if (!source || !output) throw new Error('This saved artwork could not be loaded. Select it again.');
      const sourceUrl = URL.createObjectURL(source), outputUrl = URL.createObjectURL(output); owned.push(sourceUrl, outputUrl);
      setUrls({id: item.id, revision: item.revision, source: sourceUrl, output: outputUrl});
      if (item.fidelity.status === 'unavailable') {
        setChecking(true);
        const checked = await checkArtworkPixels(await output.text(), source, item.width, item.height, controller.signal);
        if (!controller.signal.aborted) await collection.recordSavedVerification(item.id, item.revision, checked.fidelity, checked.verification);
      }
    })().catch(failure => {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The saved artwork could not be checked.');})
      .finally(() => {if (!controller.signal.aborted) setChecking(false);});
    return () => {controller.abort(); owned.forEach(url => URL.revokeObjectURL(url));};
  }, [item?.id, item?.revision, collection.getSavedSource, collection.getSavedOutput, collection.recordSavedVerification]);
  const changeColor = async (next: string | null) => {
    if (!item || busy) return; setBusy(true); setError('');
    try {await collection.recolorSaved(item.id, next, item.revision);}
    catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : 'The color could not be saved.');}
    finally {if (alive.current) setBusy(false);}
  };
  const exportZip = async () => {
    if (packing) return; setPacking(true); setError('');
    try {
      const selected = collection.saved.filter(value => filteredIds.includes(value.id));
      if (selected.reduce((sum, value) => sum + value.outputBytes, 0) > 128 * 1024 * 1024) throw new Error('This ZIP exceeds 128 MB. Filter the saved library or download individual icons.');
      const entries: {filename: string; svg: string}[] = []; let total = 0;
      for (const value of selected) {
        const blob = await collection.getSavedOutput(value.id, value.revision); if (!blob) throw new Error('A saved icon changed while exporting. Please try again.');
        total += blob.size; if (total > 128 * 1024 * 1024) throw new Error('This ZIP exceeds 128 MB. Choose fewer icons.');
        entries.push({filename: value.filename, svg: await blob.text()});
      }
      download(await buildSvgZip(entries), 'folio-saved-icons.zip');
    } catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : 'The ZIP could not be prepared.');}
    finally {if (alive.current) setPacking(false);}
  };
  const shown = urls?.id === item?.id && urls?.revision === item?.revision ? urls : null;
  const dimensions = item && zoom !== 'fit' ? {width: item.width * Number(zoom), height: item.height * Number(zoom)} : undefined;
  return <section className="png-converter-canvas" aria-label="Saved icon library">
    <div className="icon-conversion-toolbar">
      <IconViews view="saved" savedCount={collection.saved.length} onChange={onViewChange}/>
      <label><span>Zoom</span><PopoverSelect aria-label="Saved icon zoom" value={zoom} onValueChange={value => setZoom(value as typeof zoom)} options={[{value:'fit',label:'Fit'},{value:'1',label:'100% · native'},{value:'2',label:'200%'},{value:'4',label:'400%'}]}/></label>
      <label><span>Background</span><PopoverSelect aria-label="Saved icon background" value={background} onValueChange={setBackground} options={[{value:'checker',label:'Checkerboard'},{value:'light',label:'Light'},{value:'dark',label:'Dark'}]}/></label><span className="flex-space"/>
      <button className="button icon-toolbar-button" disabled={!filteredIds.length || packing} onClick={() => void exportZip()}>{packing ? <LoaderCircle className="spin" size={13}/> : <Download size={13}/>}Download ZIP ({filteredIds.length})</button>
    </div>
    <div className="icon-collection-status"><ShieldCheck size={12}/><span>{collection.saved.length} chosen icon{collection.saved.length === 1 ? '' : 's'} saved on this device</span><span className="icon-mode-scope">Independent of your conversion queue.</span></div>
    {error && <div className="png-notice" role="alert">{error}</div>}
    {!item ? <div className="workspace-empty icon-empty"><Bookmark size={27}/><h1>{collection.saved.length ? 'No matching saved icons' : 'Keep your finished icons here'}</h1><p>{collection.saved.length ? 'Choose a folder or change the search and favorites filter.' : 'Save a conversion or an AI result to keep its artwork, original image and chosen color together.'}</p><button className="button" onClick={() => onViewChange('convert')}>Go to conversions</button></div> : <div className="png-preview-workspace">
      <div className="saved-color-toolbar"><div className="saved-color-field"><span>Icon color</span><input aria-label="Saved icon color" type="color" value={validColor ? color : '#000000'} disabled={!item.recolorable || busy} onInput={event => setColor(event.currentTarget.value)} onChange={event => setColor(event.target.value)}/><input aria-label="Saved icon hex color" type="text" value={color} placeholder="#000000" maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={!validColor} disabled={!item.recolorable || busy} onChange={event => setColor(event.target.value.toLowerCase())}/></div><button className="button" disabled={!item.recolorable || busy || !validColor || color === item.color} onClick={() => void changeColor(color)}>{busy ? <LoaderCircle size={13} className="spin"/> : null}Apply color</button><button className="button" disabled={!item.color || busy} onClick={() => void changeColor(null)}><RotateCcw size={13}/>Original colors</button><span className="form-note">{!validColor ? 'Enter a six-digit hex color, such as #1a73e8.' : item.recolorable ? 'Applies one color to fills and strokes, preserving transparency.' : 'Bitmap inside SVG · colors are not editable.'}</span></div>
      <div className="png-comparison">
        <section className="png-preview-card"><header><span>Saved original</span><span>{item.width} × {item.height} px</span></header><div className="png-preview-surface"><div className="png-preview-stage">{shown ? <div className={`png-image-plane bg-${background} saved-image-plane ${zoom === 'fit' ? 'fit-artwork' : ''}`} style={dimensions}><img src={shown.source} alt={`Saved original ${item.source.name}`} width={dimensions?.width ?? item.width} height={dimensions?.height ?? item.height}/></div> : <LoaderCircle size={22} className="spin"/>}</div></div></section>
        <section className="png-preview-card"><header><span>Saved SVG{item.color ? ` · ${item.color}` : ''}</span><span>{(item.outputBytes / 1024).toFixed(1)} KB</span></header><div className="png-preview-surface"><div className="png-preview-stage">{shown ? <div className={`png-image-plane bg-${background} saved-image-plane ${zoom === 'fit' ? 'fit-artwork' : ''}`} style={dimensions}><img src={shown.output} alt={`Saved SVG ${item.name}`} width={dimensions?.width ?? item.width} height={dimensions?.height ?? item.height}/></div> : <LoaderCircle size={22} className="spin"/>}</div></div></section>
      </div>
      <div className="png-result-panel"><div className="png-result-top"><div><strong role="status" aria-live="polite">{checking ? 'Checking this color at native size…' : describeFidelity(item.fidelity)}</strong><p>{item.provenance.kind === 'ai' ? `AI artwork · ${item.provenance.model}` : `Saved conversion · ${item.provenance.engine.name}`}{item.color ? ' · Custom color saved' : ' · Original colors'}</p><p>{item.color ? 'The comparison includes your chosen color. A deliberate color change normally differs from the original.' : 'This check belongs to the saved SVG bytes and the retained original image.'}</p>{item.verification && <p className="icon-verification-context">Checked {new Date(item.verification.checkedAt).toLocaleString()} · sRGB / RGBA8 · {item.verification.browser}</p>}</div></div></div>
      <p className="form-note saved-storage-note">Saved icons remain here after you retry or remove a conversion. They are stored in this browser; clearing site data removes them. Download a ZIP to keep a backup.</p>
    </div>}
  </section>;
}
