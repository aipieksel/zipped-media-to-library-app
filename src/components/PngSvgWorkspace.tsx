import {isSharedWorkspaceEnabled} from '../shared/runtime';
import {useEffect, useMemo, useRef, useState} from 'react';
import {AlertTriangle, CheckCircle2, Download, FolderInput, Info, LoaderCircle, RefreshCw, ScanLine, ShieldCheck, Square, Upload, Save, Sparkles} from 'lucide-react';
import type {useIconCollection} from '../useIconCollection';
import type {ConversionMode} from '../png-svg';
import {buildSvgZip} from '../png-svg-download';
import './png-svg.css';
import {IconViews} from './IconViews';
import {AiSvgPanel} from './AiSvgPanel';
import {PopoverSelect} from './PopoverSelect';
import type {AiSettingsController} from '../ai/useAiSettings';
import type {SavedIconRecord} from '../icon-types';

type IconCollection = ReturnType<typeof useIconCollection>;
type Zoom = 'fit' | '1' | '2' | '4';
type Background = 'checker' | 'light' | 'dark';
interface Props {collection:IconCollection; selectedId:string|null; filteredIds:string[]; onImport:()=>void; onImportFolder:()=>void; ai:AiSettingsController; onAiSettings:()=>void; onSaved:(item:SavedIconRecord)=>void; onViewChange:(view:'convert'|'saved')=>void}
const modeNames:Record<ConversionMode,string>={pixels:'Pixel vectors',smooth:'Smooth curves',embedded:'Embedded bitmap'};
const modeNotes:Record<ConversionMode,string>={
  pixels:'Editable fills on the original pixel grid. For smooth enlarged contours, choose Smooth curves.',
  smooth:'Editable curves, fitted to the image. This is an approximation; the native pixel difference is measured below.',
  embedded:'The original bitmap inside an SVG. It is not editable vector artwork.',
};
const bytesLabel=(bytes:number)=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${(bytes/1024).toFixed(1)} KB`;
const MAX_ZIP_BYTES=128*1024*1024;
function downloadBlob(blob:Blob,filename:string){
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
}

/** Canvas only: App owns the one shared Library sidebar and all tree navigation. */
export function PngSvgWorkspace({collection,selectedId,filteredIds,onImport,onImportFolder,ai,onAiSettings,onSaved,onViewChange}:Props){
  const item=collection.items.find(value=>value.id===selectedId),result=item?.result;
  const mode=item?.mode??collection.preferences.defaultMode;
  const sourceFormat=result?.sourceFormat??(item?.sourceMime==='image/webp'?'webp':'png');
  const sourceLabel=sourceFormat==='webp'?'WebP':'PNG';
  const [zoom,setZoom]=useState<Zoom>(collection.preferences.zoom);
  const [background,setBackground]=useState<Background>(collection.preferences.background);
  const [inspectPixels,setInspectPixels]=useState(false);
  const [aiOpen,setAiOpen]=useState(false),[saving,setSaving]=useState(false),[savedKey,setSavedKey]=useState('');
  useEffect(()=>{setAiOpen(false);},[item?.id]);
  const [urls,setUrls]=useState<{id:string;revision:number;source:string;output:string}|null>(null);
  const [previewError,setPreviewError]=useState(''),[actionError,setActionError]=useState('');
  const [packing,setPacking]=useState(false),[fitScale,setFitScale]=useState(1);
  const originalSurface=useRef<HTMLDivElement>(null),outputSurface=useRef<HTMLDivElement>(null),modeSelect=useRef<HTMLButtonElement>(null);
  const batchStopFocused=useRef(false);
  const progress=selectedId?collection.progress.get(selectedId):undefined;
  const busy=item?.status==='queued'||item?.status==='processing';
  const ready=useMemo(()=>collection.items.filter(value=>value.status==='ready'&&value.result&&filteredIds.includes(value.id)),[collection.items,filteredIds]);
  const pending=collection.items.filter(value=>value.status==='queued'||value.status==='processing').length;
  const failed=collection.items.filter(value=>value.status==='error').length;
  useEffect(()=>{if(!pending&&batchStopFocused.current){batchStopFocused.current=false;modeSelect.current?.focus();}},[pending]);
  useEffect(()=>{setZoom(collection.preferences.zoom);setBackground(collection.preferences.background);},[collection.preferences.zoom,collection.preferences.background]);
  useEffect(()=>{
    let cancelled=false;const created:string[]=[];setUrls(null);setPreviewError('');
    // Successful native decode must precede any source preview, including after reload.
    if(item&&result)void Promise.all([collection.getSource(item.id),collection.getOutput(item.id,item.revision)]).then(([source,output])=>{
      if(cancelled)return;
      if(!source||!output)throw new Error('This saved preview could not be loaded. Try converting the icon again.');
      const sourceUrl=URL.createObjectURL(source.slice(0,source.size,sourceFormat==='webp'?'image/webp':'image/png')),outputUrl=URL.createObjectURL(output);created.push(sourceUrl,outputUrl);
      setUrls({id:item.id,revision:item.revision,source:sourceUrl,output:outputUrl});
    }).catch(error=>{if(!cancelled)setPreviewError(error instanceof Error?error.message:'Preview could not be loaded.');});
    return()=>{cancelled=true;created.forEach(url=>URL.revokeObjectURL(url));};
  },[item?.id,item?.revision,!!result,sourceFormat,collection.getSource,collection.getOutput]);
  useEffect(()=>{
    const a=originalSurface.current,b=outputSurface.current;if(!a||!b||!result)return;
    const measure=()=>setFitScale(Math.max(.01,Math.min(1,(Math.min(a.clientWidth,b.clientWidth)-32)/result.width,(Math.min(a.clientHeight,b.clientHeight)-32)/result.height)));
    const observer=new ResizeObserver(measure);observer.observe(a);observer.observe(b);measure();return()=>observer.disconnect();
  },[result?.width,result?.height]);
  useEffect(()=>{for(const element of [originalSurface.current,outputSurface.current])if(element){element.scrollLeft=0;element.scrollTop=0;}},[item?.id,zoom]);
  const scale=zoom==='fit'?fitScale:Number(zoom);
  const imageSize=result?{width:Math.max(1,Math.round(result.width*scale)),height:Math.max(1,Math.round(result.height*scale))}:undefined;
  const shownUrls=urls?.id===item?.id&&urls?.revision===item?.revision?urls:null;
  const syncPan=(source:HTMLDivElement,target:HTMLDivElement|null)=>{if(!target)return;if(target.scrollLeft!==source.scrollLeft)target.scrollLeft=source.scrollLeft;if(target.scrollTop!==source.scrollTop)target.scrollTop=source.scrollTop;};
  const setMode=async(next:ConversionMode)=>{
    setActionError('');try{await collection.setPreferences({defaultMode:next});if(item)await collection.retry(item.id,next);}
    catch(error){setActionError(error instanceof Error?error.message:'The conversion mode could not be saved.');}
  };
  const exportZip=async()=>{
    if(packing||!ready.length)return;setPacking(true);setActionError('');
    try{
      if(ready.reduce((sum,value)=>sum+(value.result?.outputBytes??0),0)>MAX_ZIP_BYTES)throw new Error('These SVGs exceed the 128 MB ZIP limit. Use Find a file or Favorites to export a smaller selection, or download icons individually.');
      const entries:{filename:string;svg:string}[]=[];let total=0;
      for(const value of ready){const blob=await collection.getOutput(value.id,value.revision);if(!blob)throw new Error('An icon changed while preparing the ZIP. Please try again.');total+=blob.size;if(total>MAX_ZIP_BYTES)throw new Error('This export exceeds the 128 MB ZIP limit. Filter the collection and try again.');entries.push({filename:value.filename,svg:await blob.text()});}
      downloadBlob(await buildSvgZip(entries),'folio-icons.zip');
    }catch(error){setActionError(error instanceof Error?error.message:'The ZIP could not be prepared.');}finally{setPacking(false);}
  };
  const saveConversion=async()=>{if(!item||saving||!result)return;const sourceId=item.id,revision=item.revision;setSaving(true);setActionError('');try{const saved=await collection.saveConverted(sourceId,revision);setSavedKey(`${sourceId}:${revision}`);onSaved(saved);}catch(error){setActionError(error instanceof Error?error.message:'The icon could not be saved.');}finally{setSaving(false);}};
  const verified=result?.fidelity.status==='verified'&&result.fidelity.differingPixels===0;
  const fidelityTitle=verified?'Pixel match verified':result?.fidelity.differingPixels!==null&&result?.fidelity.differingPixels!==undefined?`${result.fidelity.differingPixels.toLocaleString()} differing pixels`:'Pixel check unavailable';
  const checkedAt=result?.verification?.checkedAt;
  return <section className="png-converter-canvas" aria-label="Icon conversion canvas">
    <div className="icon-conversion-toolbar" aria-label="Conversion and preview controls">
      <IconViews view="convert" savedCount={collection.saved.length} onChange={onViewChange}/>
      <label className="icon-mode-field"><span>Mode</span><PopoverSelect ref={modeSelect} aria-label="Conversion mode" value={mode} onValueChange={value=>void setMode(value as ConversionMode)} options={[{value:'pixels',label:'Pixel vectors · exact grid'},{value:'smooth',label:'Smooth curves · approximate'},{value:'embedded',label:'Embedded bitmap · original bytes'}]}/></label>
      <label><span>Zoom</span><PopoverSelect aria-label="Preview zoom" value={zoom} onValueChange={next=>{const value=next as Zoom;setZoom(value);void collection.setPreferences({zoom:value});}} options={[{value:'fit',label:'Fit'},{value:'1',label:'100% · native'},{value:'2',label:'200%'},{value:'4',label:'400%'}]}/></label>
      <label><span>Background</span><PopoverSelect aria-label="Preview background" value={background} onValueChange={next=>{const value=next as Background;setBackground(value);void collection.setPreferences({background:value});}} options={[{value:'checker',label:'Checkerboard'},{value:'light',label:'Light'},{value:'dark',label:'Dark'}]}/></label>
      <span className="flex-space"/>
      {pending>0&&<button className="button icon-toolbar-button" onFocus={()=>{batchStopFocused.current=true;}} onBlur={()=>{batchStopFocused.current=false;}} onClick={()=>{void collection.cancelAll();modeSelect.current?.focus();}}><Square size={12}/>Stop ({pending})</button>}
      <button className="button icon-toolbar-button" disabled={!ready.length||packing} onClick={()=>void exportZip()}>{packing?<LoaderCircle size={13} className="spin"/>:<Download size={13}/>}<span>{packing?'Preparing…':`Download ZIP (${ready.length})`}</span></button>
    </div>
    <div className="icon-collection-status" role="status"><ShieldCheck size={12}/><span>{collection.importing?'Saving imported icons…':`${collection.items.length} saved ${isSharedWorkspaceEnabled()?'in the shared workspace':'on this device'}`}{pending?` · ${pending} converting`:''}{failed?` · ${failed} need attention`:''}</span><span className="icon-mode-scope">Mode applies to this icon and new imports.</span></div>
    {(collection.notice||actionError||previewError)&&<div className="png-notice" role="status"><Info size={14}/><span>{actionError||previewError||collection.notice}</span></div>}
    {!item?<div className="workspace-empty icon-empty"><ScanLine size={27}/><h1>{collection.items.length?'No matching icons':'Your icons, in the same place'}</h1><p>{collection.items.length?'Choose another folder or adjust Find a file and Favorites.':'Drop PNGs, WebPs or folders anywhere. They are saved here and converted automatically.'}</p>{!collection.items.length&&<div className="empty-actions"><button className="button primary" onClick={onImport} disabled={!collection.loaded||collection.importing}><Upload size={14}/>Import PNGs / WebPs</button><button className="button" onClick={onImportFolder} disabled={!collection.loaded||collection.importing}><FolderInput size={14}/>Import folder</button></div>}<p className="icon-empty-note">Loose images go into Uncategorized. {isSharedWorkspaceEnabled()?'Files are saved to the shared workspace; conversion runs on your device.':'Files and conversion stay on your device.'}</p></div>:<div className="png-preview-workspace">
      <div className="icon-mode-description"><span className={'png-mode-tag '+(mode==='embedded'?'is-bitmap':'')}>{modeNames[mode]}</span><p>{modeNotes[mode]}</p><button className="button icon-save-button" disabled={!result||busy||saving||savedKey===`${item.id}:${item.revision}`} onClick={()=>void saveConversion()}>{saving?<LoaderCircle size={13} className="spin"/>:<Save size={13}/>} {savedKey===`${item.id}:${item.revision}`?'Saved':'Save to library'}</button><button className="button icon-save-button" disabled={!result||busy} aria-expanded={aiOpen} onClick={()=>setAiOpen(!aiOpen)}><Sparkles size={13}/>Recreate with AI</button></div>
      <div className="png-comparison">
        <section className="png-preview-card" aria-label={'Original '+sourceLabel+' preview'}><header><span>Original {sourceLabel}</span><span>{bytesLabel(item.size)}</span></header><div ref={originalSurface} className="png-preview-surface" onScroll={event=>syncPan(event.currentTarget,outputSurface.current)}>{shownUrls&&imageSize?<div className="png-preview-stage"><div className={'png-image-plane bg-'+background} style={imageSize}><img className={inspectPixels?'pixel-zoom':''} src={shownUrls.source} alt={'Original '+item.sourceName} width={imageSize.width} height={imageSize.height}/></div></div>:<div className="png-preview-placeholder">{busy?<><LoaderCircle size={22} className="spin"/>Validating and converting…</>:'Preview available after a successful conversion.'}</div>}</div><footer><span>{result?`${result.width} × ${result.height} px`:'Original saved'}</span><label className="pixel-inspection"><input type="checkbox" checked={inspectPixels} onChange={event=>setInspectPixels(event.target.checked)}/>Show source pixels</label></footer></section>
        <section className="png-preview-card" aria-label="SVG output preview"><header><span>SVG output</span><span>{result?bytesLabel(result.outputBytes):'—'}</span></header><div ref={outputSurface} className="png-preview-surface" onScroll={event=>syncPan(event.currentTarget,originalSurface.current)}>{shownUrls&&imageSize?<div className="png-preview-stage"><div className={'png-image-plane bg-'+background} style={imageSize}><img src={shownUrls.output} alt={'SVG output for '+item.sourceName} width={imageSize.width} height={imageSize.height}/></div></div>:<div className="png-preview-placeholder">{busy?<><LoaderCircle size={22} className="spin"/>{progress?.message??'Queued for conversion…'}</>:item.message||'Convert this icon to see its SVG.'}</div>}</div><footer><span>{result?`${result.width} × ${result.height} px`:'Native dimensions retained'}</span><span>{mode==='embedded'?'Bitmap inside SVG':mode==='smooth'?'Editable vector curves':'Editable pixel fills'}</span></footer></section>
      </div>
      <div className={'png-result-panel '+(item.status==='error'?'has-error':'')} role="status"><div className="png-result-top">{busy?<LoaderCircle size={17} className="spin"/>:verified?<CheckCircle2 size={17} className="png-success-icon"/>:result?<Info size={17}/>:<AlertTriangle size={17}/>}<div><strong>{busy?progress?.message??'Waiting to convert…':result?fidelityTitle:item.status==='cancelled'?'Conversion stopped':'Conversion needs attention'}</strong>{result?<><p>{result.fidelity.differingPixels===null?result.fidelity.reason:`${result.fidelity.differingPixels.toLocaleString()} of ${result.fidelity.totalPixels.toLocaleString()} pixels differ at ${result.width} × ${result.height}.`} {mode==='smooth'&&!verified?'Curves are approximate.':''}</p><p className="icon-verification-context">Saved native-size check{checkedAt?` · ${new Date(checkedAt).toLocaleString()}`:''} · sRGB RGBA8{result.verification?.browser?` · ${result.verification.browser}`:''}</p></>:<p>{item.message||'The original image is saved. Conversion starts automatically when it reaches the front of the queue.'}</p>}</div></div>
        {result&&<div className="png-result-stats"><span><strong>{mode==='embedded'?'Bitmap':mode==='smooth'?result.pathCount?.toLocaleString()??'—':result.rectangleCount?.toLocaleString()??'—'}</strong>{mode==='embedded'?'original bytes':mode==='smooth'?'paths':'merged shapes'}</span><span><strong>{bytesLabel(result.outputBytes)}</strong>SVG size</span><span>{result.engine?.name??modeNames[mode]}{result.engine?.version?` ${result.engine.version}`:''}</span></div>}
        {result?.warnings.map((warning,index)=><p className="png-result-warning" key={index}>{warning}</p>)}
        <div className="png-retry-row">{busy?<button className="button" onClick={()=>{void collection.cancel(item.id);modeSelect.current?.focus();}}><Square size={12}/>Stop this icon</button>:<button className="button" onClick={()=>{void collection.retry(item.id,mode);modeSelect.current?.focus();}}><RefreshCw size={12}/>Convert again</button>}{mode!=='pixels'&&<button className="text-button" onClick={()=>void setMode('pixels')}>Use exact pixel vectors</button>}{mode==='pixels'&&<button className="text-button" onClick={()=>void setMode('smooth')}>Try smooth curves</button>}{mode!=='embedded'&&<button className="text-button" onClick={()=>void setMode('embedded')}>Use embedded bitmap</button>}</div>
      </div>
      {aiOpen&&result&&<AiSvgPanel key={`${item.id}:${item.revision}`} ai={ai} asset={{key:`${item.id}:${item.revision}`,id:item.id,revision:item.revision,name:item.sourceName,kind:'icons',folderId:item.folderId,getSource:async()=>{const source=await collection.getSource(item.id);return source?.slice(0,source.size,sourceFormat==='webp'?'image/webp':'image/png');},getCurrentSvg:async()=>{const output=await collection.getOutput(item.id,item.revision);return output?.text();}}} onSettings={onAiSettings} onSave={collection.saveArtwork} onSaved={onSaved} onClose={()=>setAiOpen(false)}/>}
    </div>}
    <details className="png-about"><summary><Info size={12}/>About fidelity & storage</summary><div><p>Pixel vectors reproduce the decoded pixel grid and remain pixelated when enlarged. Smooth curves fit new outlines and may change pixels, colors, or small details. Compare the actual result before using it. Embedded bitmap retains the original PNG or WebP bytes inside SVG. It is not editable vector artwork.</p><p>“Pixel match verified” requires zero visible RGBA differences after rendering the generated SVG at its native dimensions. Hidden RGB is ignored only when both pixels are fully transparent. Each saved check records its browser and time; it does not certify every browser or color profile. Lossy WebP is compared with its decoded pixels, not the unknown image before compression. Animated PNG and WebP are unsupported; export a still frame first.</p><p>{isSharedWorkspaceEnabled()?'Icons and folders are saved to the private shared workspace. Clearing browser storage does not remove shared files.':'Icons and folders persist in this browser; clearing site data removes them.'} Ordinary conversion runs locally. An explicit AI action sends the selected image, SVG and instructions through your connected provider. Browser storage quota limits the collection. Import up to 100 PNG or static WebP files / 100 MB at a time, up to 20 MB per file, 4096 pixels per side and 4,194,304 pixels. Complex vectors have bounded output; smooth conversion has its own workload limit. ZIP exports contain the ready icons in the current view, up to 128 MB. Use individual downloads or a smaller filtered view for larger collections.</p></div></details>
  </section>;
}
