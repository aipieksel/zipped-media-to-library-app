import { useEffect,useRef,useState } from 'react';
import { LoaderCircle,Camera,FileCode2,AlertCircle,ZoomIn } from 'lucide-react';
import type { HtmlPage,Snapshot } from '../types';
import { getArchiveFiles } from '../db';
import { preparePreview } from '../preview';
import { attachFrameBridge } from '../frame';

interface Props {page:HtmlPage;mode:'live'|'snapshot';snapshot?:Snapshot;viewport:number;fit:boolean;reloadKey:number;onStep:(direction:number)=>void;onNavigate:(path:string)=>void;onCapture:()=>void;busy:boolean;onWarnings:(warnings:string[])=>void;}
export function PreviewPane(props:Props){
  const {page,mode,snapshot,viewport,fit,reloadKey,onCapture,busy}=props;
  const containerRef=useRef<HTMLDivElement>(null);const frameRef=useRef<HTMLIFrameElement>(null);const latest=useRef(props);latest.current=props;
  const [size,setSize]=useState({width:1000,height:760});const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');const [error,setError]=useState('');const [imageUrl,setImageUrl]=useState('');
  useEffect(()=>{const element=containerRef.current;if(!element)return;const observer=new ResizeObserver(entries=>{const bounds=entries[0].contentRect;setSize({width:bounds.width,height:bounds.height});});observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!snapshot){setImageUrl('');return;}const url=URL.createObjectURL(snapshot.blob);setImageUrl(url);return()=>URL.revokeObjectURL(url);},[snapshot]);
  useEffect(()=>{
    let cancelled=false;let detach=()=>{};let timer:ReturnType<typeof setTimeout>|undefined;
    setStatus('loading');setError('');latest.current.onWarnings([]);
    void (async()=>{
      const prepared=await preparePreview(page,await getArchiveFiles(page.archiveId));if(cancelled)return;
      const frame=frameRef.current;if(!frame)return;
      const warnings=[...prepared.warnings];latest.current.onWarnings(warnings);
      detach=attachFrameBridge(frame,prepared,{ready:()=>{clearTimeout(timer);setStatus('ready');},warning:(warning)=>{if(warnings.length<30&&!warnings.includes(warning)){warnings.push(warning);latest.current.onWarnings([...warnings]);}},navigate:(path)=>latest.current.onNavigate(path),step:direction=>latest.current.onStep(direction),focusTree:()=>document.querySelector<HTMLElement>('[data-page-id][aria-selected="true"]')?.focus()});
      frame.srcdoc=prepared.html;
      timer=setTimeout(()=>{if(!cancelled)setStatus('ready');},10000);
    })().catch(error=>{if(!cancelled){setError(error instanceof Error?error.message:'Could not open this page.');setStatus('error');}});
    return()=>{cancelled=true;detach();clearTimeout(timer);};
  },[page.id,reloadKey]);
  const available=Math.max(200,size.width);const scale=fit?Math.min(1,available/viewport):1;const displayHeight=Math.max(300,size.height/scale);
  return <div className="preview-canvas" ref={containerRef}>
    <div className="page-frame-wrap" style={{display:mode==='live'?'block':'none',width:viewport*scale,height:displayHeight*scale}}>
      <iframe ref={frameRef} className="page-frame" title={`Live preview: ${page.label}`} sandbox="allow-scripts" referrerPolicy="no-referrer" style={{width:viewport,height:displayHeight,transform:`scale(${scale})`,transformOrigin:'top left'}}/>
      {status==='loading'&&<div className="preview-loading"><LoaderCircle className="spin" size={20}/><span>Opening {page.label}…</span></div>}
      {status==='error'&&<div className="preview-error"><AlertCircle/><h3>Couldn’t open this page</h3><p>{error}</p></div>}
    </div>
    {mode==='snapshot'&&(snapshot?<div className="snapshot-view" style={{maxWidth:fit?'100%':'none',width:fit?Math.min(snapshot.width,available):snapshot.width}}><img src={imageUrl} alt={`Screenshot of ${page.label}`} /><div className="snapshot-caption"><Camera size={14}/>{snapshot.width} × {snapshot.height}<span>Captured {new Date(snapshot.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</span></div>{snapshot.warnings.length>0&&<div className="capture-note"><AlertCircle size={16}/>{snapshot.warnings.join(' ')}</div>}</div>:<div className="canvas-empty"><div className="empty-icon"><Camera size={24}/></div><h2>No screenshot yet</h2><p>Open Settings to capture this page<br/>or a whole collection.</p></div>)}
    {mode==='live'&&status==='ready'&&<span className="canvas-size"><FileCode2 size={12}/>{viewport} px{fit&&scale<1&&<><ZoomIn size={12}/>{Math.round(scale*100)}%</>}</span>}
  </div>;
}
