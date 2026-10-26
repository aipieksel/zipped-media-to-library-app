import { getArchiveFiles } from './db';
import { preparePreview } from './preview';
import { attachFrameBridge } from './frame';
import type { HtmlPage, Snapshot } from './types';
export interface CaptureOptions {width:number;height:number;fullPage:boolean;delay:number;}
export const DEFAULT_CAPTURE:CaptureOptions={width:1440,height:900,fullPage:false,delay:1000};
export async function capturePage(page:HtmlPage,options:CaptureOptions,signal:AbortSignal):Promise<Snapshot>{
  if(signal.aborted)throw new DOMException('Capture cancelled','AbortError');
  const prepared=await new Promise<Awaited<ReturnType<typeof preparePreview>>>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Capture cancelled','AbortError'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);reject(new Error('Page preparation timed out. This export may contain a circular or unusually large resource graph.'));},20000);
    signal.addEventListener('abort',abort,{once:true});
    void getArchiveFiles(page.archiveId).then(files=>preparePreview(page,files)).then(resolve,reject).finally(()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);});
  });
  if(signal.aborted)throw new DOMException('Capture cancelled','AbortError');
  return new Promise<Snapshot>((resolve,reject)=>{
    const frame=document.createElement('iframe');frame.title=`Capturing ${page.label}`;frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    Object.assign(frame.style,{position:'fixed',left:'0',top:'0',opacity:'0.001',zIndex:'-1',width:`${options.width}px`,height:`${options.height}px`,border:'0',pointerEvents:'none'});
    document.body.append(frame);
    let finished=false;let started=false;let detach:()=>void=()=>{};
    const cleanup=()=>{clearTimeout(timeout);detach();frame.remove();signal.removeEventListener('abort',abort);};
    const fail=(error:Error)=>{if(finished)return;finished=true;cleanup();reject(error);};
    const abort=()=>fail(new DOMException('Capture cancelled','AbortError'));
    const timeout=setTimeout(()=>fail(new Error('Capture timed out after 35 seconds. Try a shorter delay or another page.')),35000);
    signal.addEventListener('abort',abort,{once:true});
    detach=attachFrameBridge(frame,prepared,{
      ready:()=>{if(started)return;started=true;frame.contentWindow?.postMessage({folio:prepared.channel,type:'capture',...options},'*');},
      captureError:message=>fail(new Error(message)),
      captured:async(result)=>{
        try {
          const png=new Uint8Array(await result.blob.slice(0,8).arrayBuffer());
          if([137,80,78,71,13,10,26,10].some((value,index)=>png[index]!==value))throw new Error('The page returned invalid image bytes.');
          if(finished||signal.aborted)return;
          finished=true;cleanup();resolve({pageId:page.id,blob:result.blob,width:result.width,height:result.height,createdAt:Date.now(),warnings:[...new Set([...prepared.warnings,...result.warnings])]});
        }catch(error){fail(error instanceof Error?error:new Error('Invalid image.'));}
      }
    });
    frame.srcdoc=prepared.html;
  });
}
