import type { CaptureOptions } from './capture';
import type { PreparedPreview } from './preview';
import type { GalleryThumbnail, HtmlPage, Snapshot } from './types';

export const HTML_THUMBNAIL_OPTIONS:Readonly<CaptureOptions>=Object.freeze({width:1280,height:800,fullPage:false,delay:250});
export const HTML_THUMBNAIL_WIDTH=360;
export const HTML_THUMBNAIL_RENDERER=1;
export const MAX_HTML_THUMBNAIL_BYTES=256*1024;

export function htmlThumbnailKey(page:HtmlPage):string{
  return JSON.stringify(['folio-html-thumbnail',HTML_THUMBNAIL_RENDERER,page.id,page.archiveId,page.path,page.size,HTML_THUMBNAIL_OPTIONS,HTML_THUMBNAIL_WIDTH,'image/webp']);
}
export type HtmlThumbnailStatus='idle'|'queued'|'preparing'|'capturing'|'ready'|'error';
export interface HtmlThumbnailState{key:string;pageId:string;status:HtmlThumbnailStatus;thumbnail?:GalleryThumbnail;error?:string}
export interface HtmlThumbnailAdapters{
  read:(key:string)=>Promise<GalleryThumbnail|undefined>;
  prepare:(page:HtmlPage)=>Promise<PreparedPreview>;
  capture:(page:HtmlPage,prepared:PreparedPreview,options:CaptureOptions,signal:AbortSignal)=>Promise<Snapshot>;
  encode:(page:HtmlPage,key:string,snapshot:Snapshot,signal:AbortSignal)=>Promise<GalleryThumbnail>;
  write:(record:GalleryThumbnail)=>Promise<boolean>;
}
interface JobEntry{page:HtmlPage;key:string;state:HtmlThumbnailState;listeners:Set<(state:HtmlThumbnailState)=>void>;queued:boolean;controller?:AbortController}

function validThumbnail(value:GalleryThumbnail|undefined,key:string,pageId:string):value is GalleryThumbnail{
  return Boolean(value&&value.key===key&&value.pageId===pageId&&value.blob instanceof Blob&&value.blob.type==='image/webp'&&value.blob.size>0&&value.blob.size<=MAX_HTML_THUMBNAIL_BYTES&&Number.isInteger(value.width)&&value.width>0&&value.width<=HTML_THUMBNAIL_WIDTH&&Number.isInteger(value.height)&&value.height>0&&value.height<=HTML_THUMBNAIL_WIDTH);
}

/** Exactly one automatic job includes cache read, uncancelable preparation, rendering and encoding. */
export class HtmlThumbnailService{
  private entries=new Map<string,JobEntry>();
  private failures=new Map<string,string>();
  private queue:JobEntry[]=[];
  private active?:JobEntry;
  private paused=false;
  constructor(private adapters:HtmlThumbnailAdapters,private maxRecords=200,private maxBytes=32*1024*1024){}

  watch(page:HtmlPage,listener:(state:HtmlThumbnailState)=>void):()=>void{
    const key=htmlThumbnailKey(page);let entry=this.entries.get(key);
    if(!entry){const failure=this.failures.get(key);entry={page,key,listeners:new Set(),queued:false,state:{key,pageId:page.id,status:failure?'error':'idle',error:failure}};this.entries.set(key,entry);}
    entry.listeners.add(listener);this.touch(entry);listener(entry.state);
    if(entry.state.status==='idle'||entry.controller?.signal.aborted)this.enqueue(entry);
    return()=>{
      entry!.listeners.delete(listener);
      if(!entry!.listeners.size){
        entry!.controller?.abort();
        if(entry!.queued){entry!.queued=false;this.queue=this.queue.filter(job=>job!==entry);}
        if(!entry!.state.thumbnail&&!this.failures.has(key)&&this.active!==entry)this.entries.delete(key);
      }
      this.prune();
    };
  }
  retry(page:HtmlPage):void{
    const key=htmlThumbnailKey(page);this.failures.delete(key);const entry=this.entries.get(key);if(!entry)return;
    this.setState(entry,{key,pageId:page.id,status:'idle'});this.enqueue(entry);
  }
  setPaused(paused:boolean):void{
    if(this.paused===paused)return;this.paused=paused;
    if(paused&&this.active){this.active.controller?.abort();this.enqueue(this.active);}
    if(!paused)this.drain();
  }
  getState(page:HtmlPage):HtmlThumbnailState|undefined{return this.entries.get(htmlThumbnailKey(page))?.state;}
  get activeCount():number{return this.active?1:0;}
  get queuedCount():number{return this.queue.filter(entry=>entry.queued&&entry.listeners.size>0).length;}
  private touch(entry:JobEntry):void{this.entries.delete(entry.key);this.entries.set(entry.key,entry);}
  private setState(entry:JobEntry,state:HtmlThumbnailState):void{
    entry.state=state;this.touch(entry);
    for(const listener of entry.listeners){try{listener(state);}catch{/* A removed UI consumer cannot break the shared queue. */}}
  }
  private enqueue(entry:JobEntry):void{
    if(!entry.listeners.size||entry.queued||entry.state.status==='ready'||this.failures.has(entry.key))return;
    if(this.active===entry&&!entry.controller?.signal.aborted)return;
    entry.queued=true;this.queue.push(entry);this.setState(entry,{key:entry.key,pageId:entry.page.id,status:'queued'});this.drain();
  }
  private drain():void{
    if(this.active||this.paused)return;
    let entry:JobEntry|undefined;
    while(this.queue.length){const candidate=this.queue.shift()!;if(candidate.queued&&candidate.listeners.size){entry=candidate;break;}}
    if(!entry)return;
    entry.queued=false;const controller=new AbortController();entry.controller=controller;this.active=entry;
    void this.run(entry,controller).finally(()=>{
      if(entry!.controller===controller)entry!.controller=undefined;
      if(this.active===entry)this.active=undefined;
      if(!entry!.queued&&entry!.state.status!=='ready'&&entry!.state.status!=='error')entry!.state={key:entry!.key,pageId:entry!.page.id,status:'idle'};
      if(!entry!.listeners.size&&!entry!.state.thumbnail&&!this.failures.has(entry!.key))this.entries.delete(entry!.key);
      this.prune();this.drain();
    });
  }
  private async run(entry:JobEntry,controller:AbortController):Promise<void>{
    const signal=controller.signal;const stopped=()=>signal.aborted||!entry.listeners.size;
    try{
      const cached=await this.adapters.read(entry.key).catch(()=>undefined);
      if(stopped())return;
      if(validThumbnail(cached,entry.key,entry.page.id)){this.setState(entry,{key:entry.key,pageId:entry.page.id,status:'ready',thumbnail:cached});return;}
      this.setState(entry,{key:entry.key,pageId:entry.page.id,status:'preparing'});
      // Do not race this promise against abort. Its permit stays held until preparation truly settles.
      const prepared=await this.adapters.prepare(entry.page);
      if(stopped())return;
      this.setState(entry,{key:entry.key,pageId:entry.page.id,status:'capturing'});
      const snapshot=await this.adapters.capture(entry.page,prepared,{...HTML_THUMBNAIL_OPTIONS},signal);
      if(stopped())return;
      const record=await this.adapters.encode(entry.page,entry.key,snapshot,signal);
      if(stopped())return;
      if(!validThumbnail(record,entry.key,entry.page.id))throw new Error('The renderer did not produce a bounded WebP preview.');
      // The DB writer checks source-page existence atomically. Quota/cache failure is nonfatal.
      await this.adapters.write(record).catch(()=>false);
      if(stopped())return;
      this.setState(entry,{key:entry.key,pageId:entry.page.id,status:'ready',thumbnail:record});
    }catch(error){
      if(stopped())return;
      const message=(error instanceof Error?error.message:'This page could not be rendered.').slice(0,400);
      this.failures.set(entry.key,message);this.setState(entry,{key:entry.key,pageId:entry.page.id,status:'error',error:message});
    }
  }
  private prune():void{
    let count=this.entries.size,bytes=0;for(const entry of this.entries.values())if(entry.state.thumbnail)bytes+=entry.state.thumbnail.blob.size;
    for(const[key,entry]of this.entries){
      if(count<=this.maxRecords&&bytes<=this.maxBytes)break;
      if(entry.listeners.size||this.active===entry)continue;
      count--;bytes-=entry.state.thumbnail?.blob.size??0;this.entries.delete(key);this.failures.delete(key);
    }
  }
}

function aborted(signal:AbortSignal):void{if(signal.aborted)throw new DOMException('Thumbnail cancelled','AbortError');}

export function htmlThumbnailDimensions(width:number,height:number):{width:number;height:number}{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('The captured image is empty.');
  const scale=Math.min(HTML_THUMBNAIL_WIDTH/width,HTML_THUMBNAIL_WIDTH/height,1);
  return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export function htmlThumbnailPngDimensions(header:Uint8Array):{width:number;height:number}{
  const signature=[137,80,78,71,13,10,26,10];
  if(header.byteLength<24||signature.some((byte,index)=>header[index]!==byte)||header[8]!==0||header[9]!==0||header[10]!==0||header[11]!==13||header[12]!==73||header[13]!==72||header[14]!==68||header[15]!==82)throw new Error('The captured preview is not a valid PNG.');
  const view=new DataView(header.buffer,header.byteOffset,header.byteLength);
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width>16384||height>16384||width*height>16*1024*1024)throw new Error('The captured preview exceeds the decode bounds.');
  return{width,height};
}

async function encodeThumbnail(page:HtmlPage,key:string,snapshot:Snapshot,signal:AbortSignal):Promise<GalleryThumbnail>{
  aborted(signal);
  // Inspect only the fixed PNG header before allocating a decoded bitmap.
  htmlThumbnailPngDimensions(new Uint8Array(await snapshot.blob.slice(0,24).arrayBuffer()));
  aborted(signal);
  let drawable:CanvasImageSource,width:number,height:number,close=()=>{};
  if(typeof createImageBitmap==='function'){
    const bitmap=await createImageBitmap(snapshot.blob);drawable=bitmap;width=bitmap.width;height=bitmap.height;close=()=>bitmap.close();
  }else{
    const url=URL.createObjectURL(snapshot.blob),image=new Image();
    try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('The captured image could not be decoded.'));image.src=url;});}
    catch(error){URL.revokeObjectURL(url);throw error;}
    drawable=image;width=image.naturalWidth;height=image.naturalHeight;close=()=>URL.revokeObjectURL(url);
  }
  try{
    aborted(signal);if(!width||!height)throw new Error('The captured image is empty.');
    const{width:outputWidth,height:outputHeight}=htmlThumbnailDimensions(width,height);
    const canvas=document.createElement('canvas');canvas.width=outputWidth;canvas.height=outputHeight;
    const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot create a thumbnail canvas.');
    context.drawImage(drawable,0,0,outputWidth,outputHeight);
    let blob:Blob|null=null;
    for(const quality of [.72,.5,.3]){
      aborted(signal);blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
      if(blob?.type==='image/webp'&&blob.size>0&&blob.size<=MAX_HTML_THUMBNAIL_BYTES)break;
    }
    aborted(signal);if(!blob||blob.type!=='image/webp'||!blob.size||blob.size>MAX_HTML_THUMBNAIL_BYTES)throw new Error('This browser could not create a small WebP preview.');
    const now=Date.now();return{key,pageId:page.id,blob,width:outputWidth,height:outputHeight,createdAt:now,lastUsedAt:now};
  }finally{close();}
}

const defaultAdapters:HtmlThumbnailAdapters={
  read:async key=>(await import('./db')).getGalleryThumbnail(key),
  prepare:async page=>{
    const[{getArchiveFiles},{preparePreview}]=await Promise.all([import('./db'),import('./preview')]);
    return preparePreview(page,await getArchiveFiles(page.archiveId));
  },
  capture:async(page,prepared,options,signal)=>(await import('./capture')).capturePreparedPage(page,prepared,options,signal),
  encode:encodeThumbnail,
  write:async record=>(await import('./db')).putGalleryThumbnail(record),
};
export const htmlThumbnails=new HtmlThumbnailService(defaultAdapters);
