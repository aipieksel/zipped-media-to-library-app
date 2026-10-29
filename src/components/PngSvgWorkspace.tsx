import {useCallback, useEffect, useRef, useState} from 'react';
import {AlertTriangle, ArrowRight, Check, CheckCircle2, Download, FileImage, FileOutput, Info, LoaderCircle, Plus, RotateCcw, ShieldCheck, Square, Upload, X} from 'lucide-react';
import {allocateSvgFilename, PNG_SVG_LIMITS} from '../png-svg';
import type {ConversionMode} from '../png-svg';
import {convertPng} from '../png-svg-browser';
import type {PngSvgResult} from '../png-svg-browser';
import {buildSvgZip} from '../png-svg-download';
import './png-svg.css';

type ItemStatus = 'queued' | 'processing' | 'ready' | 'error' | 'cancelled';
interface ConverterItem {
  id: string;
  file: File;
  filename: string;
  mode: ConversionMode;
  status: ItemStatus;
  sourceUrl?: string;
  svgUrl?: string;
  result?: PngSvgResult;
  message: string;
  percent?: number;
}
interface ActiveJob {id: string; controller: AbortController}

const MAX_SESSION_FILES = 100;
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;
const modeLabel = (mode: ConversionMode) => mode === 'pixels' ? 'Pixel vectors' : 'Embedded PNG';
const bytesLabel = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const isWorking = (item: ConverterItem) => item.status === 'queued' || item.status === 'processing';

export function fidelityLabel(result: PngSvgResult): string {
  if (result.fidelity.status === 'verified' && result.fidelity.differingPixels === 0) return 'Pixel match verified';
  if (result.fidelity.differingPixels !== null) return `${result.fidelity.differingPixels.toLocaleString()} differing pixel${result.fidelity.differingPixels === 1 ? '' : 's'}`;
  return 'Pixel check unavailable';
}

function releaseItem(item: ConverterItem) {
  if (item.sourceUrl) URL.revokeObjectURL(item.sourceUrl);
  if (item.svgUrl) URL.revokeObjectURL(item.svgUrl);
}

/** Transient local files have no connection to the library database or cloud APIs. */
export function PngSvgWorkspace({active}: {active: boolean}) {
  const [items, setItems] = useState<ConverterItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ConversionMode>('pixels');
  const [zoom, setZoom] = useState('fit');
  const [background, setBackground] = useState('checker');
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [zipBusy, setZipBusy] = useState(false);
  const itemsRef = useRef<ConverterItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const addFilesButton = useRef<HTMLButtonElement>(null);
  const fileButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterUpdate = useRef<string | null | undefined>(undefined);
  const mounted = useRef(true);
  const pumping = useRef(false);
  const activeJob = useRef<ActiveJob | null>(null);
  const usedNames = useRef(new Set<string>());
  const nextItemId = useRef(0);
  const dragDepth = useRef(0);
  const downloadUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const zipLock = useRef(false);

  const updateItems = useCallback((change: (current: ConverterItem[]) => ConverterItem[]) => {
    const next = change(itemsRef.current);
    itemsRef.current = next;
    if (mounted.current) setItems(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeJob.current?.controller.abort();
      itemsRef.current.forEach(releaseItem);
      for (const [url, timer] of downloadUrls.current) {clearTimeout(timer); URL.revokeObjectURL(url);}
      downloadUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!active) {dragDepth.current = 0; setDragging(false);}
  }, [active]);

  useEffect(() => {
    const target = focusAfterUpdate.current;
    if (target === undefined) return;
    focusAfterUpdate.current = undefined;
    if (target === null) addFilesButton.current?.focus();
    else fileButtons.current.get(target)?.focus();
  }, [items]);

  useEffect(() => {
    // These files are intentionally session-only, so protect an unfinished batch.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (itemsRef.current.some(isWorking)) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const processQueue = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    const preserveJobFocus = (id: string) => {
      const focused = document.activeElement;
      const lastPending = !itemsRef.current.some(entry => entry.id !== id && isWorking(entry));
      if (focused?.getAttribute('data-png-stop') === id || (lastPending && focused?.hasAttribute('data-png-stop-batch'))) {
        focusAfterUpdate.current = id;
      }
    };
    try {
      while (mounted.current) {
        const item = itemsRef.current.find(entry => entry.status === 'queued');
        if (!item) break;
        const job: ActiveJob = {id: item.id, controller: new AbortController()};
        activeJob.current = job;
        updateItems(current => current.map(entry => entry.id === item.id ? {...entry, status: 'processing', message: 'Reading PNG…', percent: undefined} : entry));
        try {
          const result = await convertPng(item.file, {
            mode: item.mode,
            signal: job.controller.signal,
            onProgress: progress => {
              if (job.controller.signal.aborted || activeJob.current !== job || !mounted.current) return;
              updateItems(current => current.map(entry => {
                if (entry.id !== item.id || entry.status !== 'processing') return entry;
                // Decoding completes only after PNG structure, dimensions and native
                // image size have passed validation. Never preview unvalidated bytes.
                const sourceUrl = entry.sourceUrl ?? (progress.stage === 'converting'
                  ? URL.createObjectURL(entry.file.slice(0, entry.file.size, 'image/png')) : undefined);
                return {...entry, sourceUrl, message: progress.message, percent: progress.percent};
              }));
            },
          });
          if (!mounted.current || job.controller.signal.aborted || activeJob.current !== job) continue;
          const currentItem = itemsRef.current.find(entry => entry.id === item.id);
          if (!currentItem || currentItem.status !== 'processing') continue;
          const retainedBytes = itemsRef.current.reduce((sum, entry) => sum + (entry.id === item.id ? 0 : entry.result?.outputBytes ?? 0), 0);
          if (retainedBytes + result.outputBytes > MAX_OUTPUT_BYTES) throw new Error('This batch has reached the 128 MB SVG memory limit. Download and remove completed files, then retry.');
          const svgUrl = URL.createObjectURL(new Blob([result.svg], {type: 'image/svg+xml'}));
          preserveJobFocus(item.id);
          updateItems(current => current.map(entry => entry.id === item.id ? {...entry, status: 'ready', result, svgUrl, message: fidelityLabel(result), percent: undefined} : entry));
        } catch (error) {
          if (!mounted.current || activeJob.current !== job) continue;
          preserveJobFocus(item.id);
          updateItems(current => current.map(entry => entry.id === item.id && entry.status === 'processing' ? {
            ...entry,
            status: job.controller.signal.aborted ? 'cancelled' : 'error',
            message: job.controller.signal.aborted ? 'Conversion cancelled. Retry whenever you are ready.' : error instanceof Error ? error.message : 'This PNG could not be converted.',
            percent: undefined,
          } : entry));
        } finally {
          if (activeJob.current === job) activeJob.current = null;
        }
      }
    } finally {pumping.current = false;}
  }, [updateItems]);

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const additions: ConverterItem[] = [];
    let totalBytes = itemsRef.current.reduce((sum, item) => sum + item.file.size, 0);
    let skipped = 0;
    for (const file of files) {
      if (itemsRef.current.length + additions.length >= MAX_SESSION_FILES || totalBytes + file.size > MAX_SOURCE_BYTES) {skipped++; continue;}
      totalBytes += file.size;
      const supported = /\.png$/i.test(file.name) || file.type === 'image/png';
      const error = !supported ? 'Choose a PNG file. Other image formats are not converted.' : file.size > PNG_SVG_LIMITS.maxInputBytes ? 'This PNG exceeds the 20 MB per-file limit.' : '';
      additions.push({
        id: `png-${nextItemId.current++}`, file, filename: allocateSvgFilename(file.name, usedNames.current), mode,
        status: error ? 'error' : 'queued', message: error || 'Waiting to convert…',
      });
    }
    updateItems(current => [...current, ...additions]);
    if (additions[0]) setSelectedId(current => current ?? additions[0].id);
    setNotice(skipped ? `${skipped} file${skipped === 1 ? ' was' : 's were'} not added. A session holds up to 100 files and 100 MB of source PNGs. Download and remove files to make room.` : '');
    void processQueue();
  };

  const cancelQueue = () => {
    focusAfterUpdate.current = selectedId;
    activeJob.current?.controller.abort();
    updateItems(current => current.map(item => isWorking(item) ? {...item, status: 'cancelled', message: 'Conversion cancelled. Retry whenever you are ready.', percent: undefined} : item));
  };

  const removeItem = (id: string) => {
    if (activeJob.current?.id === id) activeJob.current.controller.abort();
    const old = itemsRef.current;
    const index = old.findIndex(item => item.id === id);
    if (index < 0) return;
    releaseItem(old[index]);
    const remaining = old.filter(item => item.id !== id);
    if (fileButtons.current.get(id)?.closest('li')?.contains(document.activeElement)) {
      focusAfterUpdate.current = remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
    }
    updateItems(() => remaining);
    setSelectedId(current => current === id ? remaining[Math.min(index, remaining.length - 1)]?.id ?? null : current);
  };

  const clearItems = () => {
    activeJob.current?.controller.abort();
    itemsRef.current.forEach(releaseItem);
    focusAfterUpdate.current = null;
    updateItems(() => []);
    setSelectedId(null);
    setNotice('');
  };

  const retry = (id: string, nextMode: ConversionMode) => {
    focusAfterUpdate.current = id;
    if (activeJob.current?.id === id) activeJob.current.controller.abort();
    updateItems(current => current.map(item => {
      if (item.id !== id) return item;
      if (item.svgUrl) URL.revokeObjectURL(item.svgUrl);
      return {...item, mode: nextMode, status: 'queued', svgUrl: undefined, result: undefined, message: 'Waiting to convert…', percent: undefined};
    }));
    void processQueue();
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    const timer = setTimeout(() => {URL.revokeObjectURL(url); downloadUrls.current.delete(url);}, 30_000);
    downloadUrls.current.set(url, timer);
  };

  const downloadOne = (item: ConverterItem) => {
    if (item.result) download(new Blob([item.result.svg], {type: 'image/svg+xml'}), item.filename);
  };

  const downloadZip = async () => {
    if (zipLock.current) return;
    const completed = itemsRef.current.filter(item => item.status === 'ready' && item.result);
    if (!completed.length) return;
    zipLock.current = true; setZipBusy(true); setNotice('');
    try {
      const blob = await buildSvgZip(completed.map(item => ({filename: item.filename, svg: item.result!.svg})));
      if (!mounted.current) return;
      download(blob, 'folio-svg-icons.zip');
      const excluded = itemsRef.current.length - completed.length;
      setNotice(`ZIP prepared with ${completed.length} SVG${completed.length === 1 ? '' : 's'}.${excluded > 0 ? ` ${excluded} unfinished or failed file${excluded === 1 ? ' was' : 's were'} excluded.` : ''}`);
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : 'The ZIP could not be prepared. Individual SVG downloads are still available.');
    } finally {zipLock.current = false; if (mounted.current) setZipBusy(false);}
  };

  const selected = items.find(item => item.id === selectedId);
  const readyCount = items.filter(item => item.status === 'ready').length;
  const pendingCount = items.filter(isWorking).length;
  const failedCount = items.filter(item => item.status === 'error' || item.status === 'cancelled').length;
  const selectedResult = selected?.result;
  const verified = selectedResult?.fidelity.status === 'verified' && selectedResult.fidelity.differingPixels === 0;
  const imageStyle = selectedResult && zoom !== 'fit' ? {width: selectedResult.width * Number(zoom), height: selectedResult.height * Number(zoom)} : undefined;

  return <section className="png-workspace" hidden={!active} aria-label="PNG to SVG converter"
    onDragEnter={event => {if (event.dataTransfer.types.includes('Files')) {event.preventDefault(); event.stopPropagation(); dragDepth.current++; setDragging(true);}}}
    onDragOver={event => {if (event.dataTransfer.types.includes('Files')) {event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy';}}}
    onDragLeave={event => {event.preventDefault(); event.stopPropagation(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false);}}
    onDrop={event => {event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false); addFiles(Array.from(event.dataTransfer.files));}}>
    <input ref={input} type="file" accept=".png,image/png" multiple hidden aria-label="Import PNGs for conversion" onChange={event => {addFiles(Array.from(event.target.files ?? [])); event.target.value = '';}}/>
    <aside className="png-sidebar" aria-label="Conversion batch">
      <div className="png-sidebar-heading"><strong>PNG to SVG</strong><span>{items.length}</span><button className="icon-button" aria-label="Add PNG files" title="Add PNG files" onClick={() => input.current?.click()}><Plus size={17}/></button></div>
      <div className="png-mode-controls">
        <label htmlFor="png-conversion-mode">Conversion mode</label>
        <select id="png-conversion-mode" value={mode} onChange={event => setMode(event.target.value as ConversionMode)}><option value="pixels">Pixel vectors · editable fills</option><option value="embedded">Embedded PNG · bitmap in SVG</option></select>
        <p>{mode === 'pixels' ? 'Preserve the pixel grid as editable SVG shapes.' : 'Keep the original PNG inside an SVG. The bitmap is not editable vector artwork.'}</p>
        <span className="png-mode-hint">Applies to new files. Existing files keep their mode.</span>
      </div>
      <div className="png-batch-toolbar"><span>{readyCount} ready{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}{failedCount > 0 ? ` · ${failedCount} need attention` : ''}</span>{pendingCount > 0 ? <button className="text-button" data-png-stop-batch onClick={cancelQueue}><Square size={10}/>Stop batch</button> : <button className="text-button" disabled={!items.length} onClick={clearItems}>Clear all</button>}</div>
      <ul className="png-file-list" aria-label="PNG files">
        {items.map(item => <li key={item.id} className={'png-file-row ' + (selectedId === item.id ? 'is-selected' : '')}>
          <button className="png-file-select" ref={node => {if (node) fileButtons.current.set(item.id, node); else fileButtons.current.delete(item.id);}} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)} title={item.file.name}>
            <span className={'png-file-icon ' + (item.status === 'ready' && item.result?.fidelity.status === 'verified' ? 'is-verified' : '')}>{item.status === 'processing' ? <LoaderCircle size={16} className="spin"/> : item.status === 'error' || item.status === 'cancelled' ? <AlertTriangle size={16}/> : item.status === 'ready' && item.result?.fidelity.status === 'verified' ? <CheckCircle2 size={16}/> : <FileImage size={16}/>}</span>
            <span className="png-file-copy"><strong>{item.file.name}</strong><span>{item.result ? `${item.result.width} × ${item.result.height} · ${bytesLabel(item.result.outputBytes)}` : bytesLabel(item.file.size)} · {item.status === 'processing' ? 'Processing' : item.status === 'ready' ? modeLabel(item.mode) : item.status === 'queued' ? 'Queued' : item.status === 'cancelled' ? 'Stopped' : 'Needs attention'}</span></span>
          </button>
          {item.result && <button className="icon-button tiny" aria-label={`Download ${item.filename}`} title={`Download ${item.filename}`} onClick={() => downloadOne(item)}><Download size={13}/></button>}
          <button className="icon-button tiny" aria-label={`Remove ${item.file.name}`} title="Remove from this batch" onClick={() => removeItem(item.id)}><X size={13}/></button>
        </li>)}
      </ul>
      {!items.length && <div className="png-list-empty"><FileImage size={22}/><p>Your PNGs will appear here.</p><span>Drop a batch anywhere in this tool.</span></div>}
      <button ref={addFilesButton} className="png-add-files" onClick={() => input.current?.click()}><Upload size={13}/>Add PNGs<span>Up to 20 MB each</span></button>
      <div className="png-local-note"><ShieldCheck size={14}/><span>Processed on your device.<br/>Download your results before closing.</span></div>
    </aside>

    <main className="png-main" aria-label="Conversion preview">
      <header className="png-toolbar">
        <div className="png-current-file"><strong>{selected?.file.name ?? 'Convert PNG icons, keep every pixel.'}</strong><span>{selected ? selected.filename : 'Local processing · no uploads'}</span></div>
        <button className="button" disabled={!selectedResult} onClick={() => selected && downloadOne(selected)}><Download size={13}/><span>Download SVG</span></button>
        <button className="button primary" disabled={!readyCount || zipBusy} onClick={() => void downloadZip()}>{zipBusy ? <LoaderCircle size={13} className="spin"/> : <Download size={13}/>}<span>{zipBusy ? 'Preparing…' : `Download ZIP${readyCount ? ` (${readyCount})` : ''}`}</span></button>
      </header>
      {notice && <div className="png-notice" role="status"><Info size={14}/><span>{notice}</span><button className="icon-button tiny" aria-label="Dismiss converter notice" onClick={() => setNotice('')}><X size={13}/></button></div>}
      {!selected ? <div className="png-empty-state">
        <div className="png-empty-symbol"><FileImage size={26}/><ArrowRight size={18}/><FileOutput size={26}/></div>
        <h1>Same pixels. A new format.</h1>
        <p>Drop PNG icons here to make editable pixel vectors.<br/>Compare the original and SVG, then download your batch.</p>
        <button className="button primary" onClick={() => input.current?.click()}><Plus size={15}/>Choose PNG files</button>
        <div className="png-empty-notes"><span><Check size={12}/>Original dimensions</span><span><Check size={12}/>Transparency preserved</span><span><Check size={12}/>Rendered pixel check</span></div>
      </div> : <div className="png-preview-workspace">
        <div className="png-preview-controls">
          <span className={'png-mode-tag ' + (selected.mode === 'embedded' ? 'is-bitmap' : '')}>{selected.mode === 'pixels' ? 'Pixel vectors · editable fills' : 'Embedded PNG · bitmap inside SVG'}</span>
          <label>Preview<select aria-label="Preview zoom" value={zoom} onChange={event => setZoom(event.target.value)}><option value="fit">Fit</option><option value="1">100% · native size</option><option value="2">200%</option><option value="4">400%</option></select></label>
          <label>Background<select aria-label="Preview background" value={background} onChange={event => setBackground(event.target.value)}><option value="checker">Checkerboard</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        </div>
        <div className="png-comparison">
          <section className="png-preview-card" aria-label="Original PNG preview"><header><span>Original PNG</span><span>{bytesLabel(selected.file.size)}</span></header><div className={`png-preview-surface bg-${background} ${zoom === 'fit' ? 'is-fit' : 'is-actual'}`}>{selected.sourceUrl ? <img src={selected.sourceUrl} alt={`Original ${selected.file.name}`} style={imageStyle} className={zoom !== 'fit' ? 'pixel-zoom' : ''}/> : <div className="png-preview-placeholder"><FileImage size={24}/><span>No PNG preview</span></div>}</div><footer>{selectedResult ? `${selectedResult.width} × ${selectedResult.height} px` : 'Source PNG'}<span>Original file</span></footer></section>
          <section className="png-preview-card" aria-label="SVG output preview"><header><span>SVG output</span><span>{selectedResult ? bytesLabel(selectedResult.outputBytes) : '—'}</span></header><div className={`png-preview-surface bg-${background} ${zoom === 'fit' ? 'is-fit' : 'is-actual'}`}>{selected.svgUrl ? <img src={selected.svgUrl} alt={`SVG output for ${selected.file.name}`} style={imageStyle} className={zoom !== 'fit' ? 'pixel-zoom' : ''}/> : <div className="png-preview-placeholder">{isWorking(selected) ? <LoaderCircle size={24} className="spin"/> : <AlertTriangle size={24}/>}<span>{isWorking(selected) ? selected.message : 'No SVG generated'}</span></div>}</div><footer>{selectedResult ? `${selectedResult.width} × ${selectedResult.height} px` : 'Native dimensions'}<span>{selected.mode === 'pixels' ? 'Editable SVG fills' : 'Bitmap inside SVG'}</span></footer></section>
        </div>
        <div className={'png-result-panel ' + (selected.status === 'error' ? 'has-error' : '')} role="status" aria-live="polite">
          <div className="png-result-top">
            {selectedResult ? verified ? <CheckCircle2 size={17} className="png-success-icon"/> : <AlertTriangle size={17}/> : isWorking(selected) ? <LoaderCircle size={17} className="spin"/> : <AlertTriangle size={17}/>}
            <div><strong>{selectedResult ? fidelityLabel(selectedResult) : selected.status === 'error' ? 'Couldn’t convert this file' : selected.status === 'cancelled' ? 'Conversion stopped' : selected.message}</strong><p>{selectedResult ? selectedResult.fidelity.status === 'unavailable' ? selectedResult.fidelity.reason ?? 'The browser could not complete the native-size pixel check.' : `${selectedResult.fidelity.differingPixels?.toLocaleString()} of ${selectedResult.fidelity.totalPixels.toLocaleString()} pixels differ · checked at ${selectedResult.width} × ${selectedResult.height} in this browser (sRGB).` : selected.status === 'error' || selected.status === 'cancelled' ? selected.message : 'The SVG is checked after rendering at the original PNG dimensions.'}</p></div>
            {isWorking(selected) && <button className="button" data-png-stop={selected.id} onClick={() => {focusAfterUpdate.current = selected.id; activeJob.current?.id === selected.id && activeJob.current.controller.abort(); updateItems(current => current.map(item => item.id === selected.id ? {...item, status: 'cancelled', message: 'Conversion cancelled. Retry whenever you are ready.'} : item));}}>Stop</button>}
          </div>
          {selectedResult && <div className="png-result-stats"><span><strong>{selectedResult.mode === 'pixels' ? selectedResult.rectangleCount?.toLocaleString() : '1'}</strong>{selectedResult.mode === 'pixels' ? 'merged shapes' : 'embedded bitmap'}</span><span><strong>{bytesLabel(selectedResult.outputBytes)}</strong>SVG size</span><span><strong>{selectedResult.sourceBytes ? (selectedResult.outputBytes / selectedResult.sourceBytes).toFixed(1) : '—'}×</strong>source size</span></div>}
          {selectedResult?.warnings.map((warning, index) => <p key={index} className="png-result-warning">{warning}</p>)}
          {!isWorking(selected) && <div className="png-retry-row"><button className="button" onClick={() => retry(selected.id, mode)}><RotateCcw size={12}/>{selectedResult ? 'Reconvert' : 'Retry'} as {modeLabel(mode).toLowerCase()}</button>{selected.mode === 'pixels' && <button className="text-button" onClick={() => retry(selected.id, 'embedded')}>Use embedded PNG instead</button>}</div>}
          {selected.mode === 'embedded' && <p className="png-bitmap-note">This SVG contains the original PNG bitmap. It is not editable vector artwork.</p>}
        </div>
      </div>}
      <details className="png-about"><summary><Info size={13}/>About fidelity & limits</summary><div><p>Pixel vectors preserve the pixel grid, so they still look pixelated when enlarged. Smooth, editable curves cannot generally be recovered exactly from arbitrary PNGs.</p><p>“Pixel match verified” means zero visible RGBA differences after rendering this SVG in this browser at native dimensions using sRGB canvas. Hidden RGB values are ignored only where both pixels are fully transparent. Other browsers and color profiles are not certified.</p><p>Static PNGs only · 20 MB per file · up to 4096 px per side and 4,194,304 pixels · 150,000 merged shapes · 24 MB per SVG. Large or complex vectors can be retried as an embedded PNG without resizing. A batch holds 100 files, 100 MB of source PNGs and 128 MB of generated SVGs. Files and results stay in memory for this tab and are cleared on reload.</p></div></details>
    </main>
    {dragging && <div className="png-drop-overlay"><span><Upload size={20}/>Drop PNGs to convert locally</span></div>}
  </section>;
}
