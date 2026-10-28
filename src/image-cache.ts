import type { HtmlPage, ImageRendition } from './types';

export type ImageVariant = 'thumbnail' | 'preview' | 'original';
export interface ImageSource {
  url: string;
  placeholder?: string;
  width?: number;
  height?: number;
  bytes?: number;
  original: boolean;
  animated?: boolean;
}

/** URLs are same-origin immutable references; normal painting never waits for original Blob validation. */
export function imageSource(item: HtmlPage, metadata: ImageRendition | undefined, variant: ImageVariant): ImageSource | undefined {
  const originalHash = item.imageHash;
  if (!originalHash || !/^[a-f0-9]{64}$/.test(originalHash)) return undefined;
  const original = metadata?.original ?? { archiveId:item.archiveId, path:item.path, mime:item.mime ?? '', size:item.size };
  const requested = variant === 'thumbnail' ? metadata?.thumbnail ?? metadata?.preview : variant === 'preview' ? metadata?.preview ?? metadata?.thumbnail : undefined;
  return {
    url: requested ? `/api/collection/image?hash=${requested}` : `/api/collection/file?archive=${encodeURIComponent(original.archiveId)}&path=${encodeURIComponent(original.path)}&v=${originalHash}`,
    placeholder:metadata?.placeholder,width:metadata?.width,height:metadata?.height,
    bytes:requested ? (requested === metadata?.thumbnail ? metadata.thumbnailBytes : metadata?.previewBytes) : original.size,
    original:!requested,animated:metadata?.animated,
  };
}

/** Explicit decoded image retention is limited by both image count and decoded pixels. */
export class DecodedImageLRU<T> {
  private values = new Map<string, { value:T; pixels:number }>();
  private pixels = 0;
  constructor(readonly maxEntries = 24, readonly maxPixels = 24_000_000) {}
  get(key:string):T|undefined {
    const entry=this.values.get(key);if(!entry)return;
    this.values.delete(key);this.values.set(key,entry);return entry.value;
  }
  set(key:string,value:T,width:number,height:number):void {
    this.delete(key);
    const pixels=Math.max(1,width)*Math.max(1,height);
    if(!Number.isFinite(pixels)||pixels>this.maxPixels)return;
    this.values.set(key,{value,pixels});this.pixels+=pixels;
    while(this.values.size>this.maxEntries||this.pixels>this.maxPixels)this.delete(this.values.keys().next().value!);
  }
  delete(key:string):void {const entry=this.values.get(key);if(entry){this.pixels-=entry.pixels;this.values.delete(key);}}
  get size():number{return this.values.size;}
  get pixelCount():number{return this.pixels;}
}

export interface ObjectUrlLease { url:string; release:()=>void }
interface LocalEntry { url?:string; bytes:number; users:number; pending:Promise<void> }

/** Keep active local Blob URLs valid, and revoke only evicted URLs with no remaining consumer. */
export class LocalImageURLCache {
  private entries=new Map<string,LocalEntry>();
  constructor(readonly maxEntries=48,readonly maxBytes=64*1024*1024,
    private create:(blob:Blob)=>string=blob=>URL.createObjectURL(blob),
    private revoke:(url:string)=>void=url=>URL.revokeObjectURL(url)){}
  async acquire(key:string,load:()=>Promise<Blob>):Promise<ObjectUrlLease>{
    let entry=this.entries.get(key);
    if(!entry){
      entry={bytes:0,users:0,pending:Promise.resolve()};
      const owned=entry;
      owned.pending=load().then(blob=>{owned.bytes=blob.size;owned.url=this.create(blob);}).catch(error=>{this.entries.delete(key);throw error;});
      this.entries.set(key,owned);
    }
    entry.users++;this.entries.delete(key);this.entries.set(key,entry);
    try{await entry.pending;}catch(error){entry.users--;throw error;}
    this.prune();let released=false;
    return{url:entry.url!,release:()=>{if(released)return;released=true;entry!.users--;this.prune();}};
  }
  private prune():void{
    let bytes=0;for(const entry of this.entries.values())bytes+=entry.bytes;
    for(const[key,entry]of this.entries){
      if(this.entries.size<=this.maxEntries&&bytes<=this.maxBytes)break;
      if(entry.users||!entry.url)continue;
      this.revoke(entry.url);bytes-=entry.bytes;this.entries.delete(key);
    }
  }
  get size():number{return this.entries.size;}
}

interface QueueJob { key:string;priority:number;run:(signal:AbortSignal)=>Promise<unknown>;resolve:()=>void;cancelled:boolean;controller:AbortController }
/** Two speculative workers, with queued current-selection requests ahead of neighbors. */
export class ImagePrefetchQueue {
  private active=0;
  private waiting:QueueJob[]=[];
  private jobs=new Map<string,{promise:Promise<void>;job:QueueJob}>();
  constructor(readonly concurrency=2){}
  enqueue(key:string,run:(signal:AbortSignal)=>Promise<unknown>,priority=1):Promise<void>{
    const existing=this.jobs.get(key);
    if(existing&&!existing.job.controller.signal.aborted){existing.job.priority=Math.min(existing.job.priority,priority);this.waiting.sort((a,b)=>a.priority-b.priority);return existing.promise;}
    if(existing)this.jobs.delete(key);
    let resolve=()=>{};const promise=new Promise<void>(done=>{resolve=done;});
    const job={key,run,priority,resolve,cancelled:false,controller:new AbortController()};this.jobs.set(key,{promise,job});this.waiting.push(job);this.waiting.sort((a,b)=>a.priority-b.priority);this.drain();return promise;
  }
  cancelQueuedExcept(keys:ReadonlySet<string>):void{
    for(const[key,{job}]of this.jobs)if(!keys.has(key))job.controller.abort();
    this.waiting=this.waiting.filter(job=>{if(keys.has(job.key))return true;job.cancelled=true;job.resolve();if(this.jobs.get(job.key)?.job===job)this.jobs.delete(job.key);return false;});
  }
  private drain():void{
    while(this.active<this.concurrency&&this.waiting.length){
      const job=this.waiting.shift()!;if(job.cancelled)continue;
      this.active++;
      void Promise.resolve().then(()=>job.run(job.controller.signal)).catch(()=>undefined).finally(()=>{this.active--;if(this.jobs.get(job.key)?.job===job)this.jobs.delete(job.key);job.resolve();this.drain();});
    }
  }
  get activeCount():number{return this.active;}
  get queuedCount():number{return this.waiting.length;}
}

export const localImageURLs=new LocalImageURLCache();
export const decodedImages=new DecodedImageLRU<HTMLImageElement>();
export const imagePrefetchQueue=new ImagePrefetchQueue(2);
const decoding=new Map<string,Promise<void>>();

export function rememberDecodedImage(url:string,image:HTMLImageElement):void{
  decodedImages.set(url,image,image.naturalWidth,image.naturalHeight);
}
export function warmImage(url:string,priority:'high'|'low'='low',signal?:AbortSignal):Promise<void>{
  if(signal?.aborted)return Promise.reject(new DOMException('Image prefetch cancelled.','AbortError'));
  if(decodedImages.get(url))return Promise.resolve();
  const pending=decoding.get(url);if(pending)return pending;
  if(typeof Image==='undefined')return Promise.resolve();
  const image=new Image();image.decoding='async';image.fetchPriority=priority;
  let abort=()=>{};
  const promise=new Promise<void>((resolve,reject)=>{
    abort=()=>{image.onload=null;image.onerror=null;image.src='';reject(new DOMException('Image prefetch cancelled.','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    image.onload=()=>{
      void (async()=>{
        // load can precede decoding; only retain a warmed bitmap once decode has completed.
        if(typeof image.decode==='function')await image.decode();
        if(signal?.aborted)throw new DOMException('Image prefetch cancelled.','AbortError');
        rememberDecodedImage(url,image);resolve();
      })().catch(reject);
    };
    image.onerror=()=>reject(new Error('Image preview could not be decoded.'));
    image.src=url;
  }).finally(()=>{signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;decoding.delete(url);});
  decoding.set(url,promise);return promise;
}


export function imageIsPaintReady(paintedURL:string,requestedURL:string|undefined):boolean{
  return Boolean(requestedURL&&paintedURL===requestedURL);
}

export function neighborPrefetchPlan(currentId:string,nearbyItems:HtmlPage[],resolve:(item:HtmlPage)=>ImageSource|undefined){
  const targets=nearbyItems.filter(item=>item.id!==currentId).slice(0,4).map(item=>({item,source:resolve(item)}));
  const key=(target:typeof targets[number])=>target.source?.url??`local:${target.item.id}`;
  // References and layout rerenders do not change a fetch plan: immutable URLs / local IDs do.
  return{targets,keys:targets.map(key),signature:JSON.stringify([currentId,...targets.map(key)])};
}

export interface ImageVirtualRow {kind:'images';items:HtmlPage[];key:string;height:number;top:number}
export interface ImageHeaderRow {kind:'header';label:string;key:string;height:number;top:number}
export type GalleryRow=ImageVirtualRow|ImageHeaderRow;
export interface ImageMonthGroup {key:string;label:string;items:HtmlPage[]}

/** Fixed row geometry keeps the mounted gallery proportional to the viewport, not the collection. */
export function buildImageRows(items:HtmlPage[],columns:number,cardHeight:number,groups?:ImageMonthGroup[]):GalleryRow[]{
  const count=Math.max(1,Math.floor(columns));const rows:GalleryRow[]=[];let top=0;
  const append=(values:HtmlPage[],prefix:string)=>{
    for(let index=0;index<values.length;index+=count){rows.push({kind:'images',items:values.slice(index,index+count),key:`${prefix}:${index}`,height:cardHeight,top});top+=cardHeight;}
  };
  if(groups){for(const group of groups){rows.push({kind:'header',label:group.label,key:`month:${group.key}`,height:36,top});top+=36;append(group.items,group.key);}}
  else append(items,'images');return rows;
}
export function visibleImageRows(rows:GalleryRow[],scrollTop:number,height:number,overscan=2):GalleryRow[]{
  if(!rows.length)return[];
  const bottom=Math.max(0,scrollTop)+Math.max(1,height);
  let low=0,high=rows.length;
  while(low<high){const middle=(low+high)>>1;if(rows[middle].top+rows[middle].height<scrollTop)low=middle+1;else high=middle;}
  const start=Math.max(0,low-overscan);let end=low;
  while(end<rows.length&&rows[end].top<=bottom)end++;
  return rows.slice(start,Math.min(rows.length,end+overscan));
}
