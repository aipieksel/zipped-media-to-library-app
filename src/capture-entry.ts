import { toBlob } from 'html-to-image';

type BridgeConfig = { channel: string; pagePath: string; origin: string; parentOrigin: string; wrapper: string; known: Record<string,string>; paths: string[] };
declare global { interface Window { __folioConfig: BridgeConfig } }
const config = window.__folioConfig;
const send = (type: string, extra: Record<string,unknown> = {}) => parent.postMessage({ folio: config.channel, type, ...extra }, config.parentOrigin);
const nativeFetch = window.fetch.bind(window);
const requests = new Map<string, { resolve: (value: {blob: Blob; url?: string}) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let requestCount = 0;
let capturing = false;
const pathSet = new Set(config.paths);
const documentUrl = new URL(config.pagePath.split('/').map(encodeURIComponent).join('/'), config.origin);
const resolve = (value: string): {path:string;hash:string} | null => {
  if (!value || /^(data:|blob:|#|mailto:|tel:|javascript:)/i.test(value)) return null;
  try {
    const url = new URL(value, documentUrl); if (url.origin !== config.origin) return null;
    let path=decodeURIComponent(url.pathname.slice(1));
    if(!pathSet.has(path)&&config.wrapper&&pathSet.has(`${config.wrapper}/${path}`))path=`${config.wrapper}/${path}`;
    if(!pathSet.has(path)&&pathSet.has(`${path.replace(/\/$/,'')}/index.html`))path=`${path.replace(/\/$/,'')}/index.html`;
    return {path,hash:url.hash};
  } catch { return null; }
};
const resource = (path: string, kind = 'asset') => new Promise<{blob:Blob;url?:string}>((resolvePromise,reject) => {
  const id = `${++requestCount}`;
  const timer = setTimeout(() => { requests.delete(id); reject(new Error(`Resource timed out: ${path}`)); },12000);
  requests.set(id, {resolve:resolvePromise,reject,timer});
  send('resource', {requestId:id,path,kind});
});

// A page-local storage substitute keeps exported editors usable without exposing the workspace.
function memoryStorage(): Storage {
  const values = new Map<string,string>();
  const storage = { get length() {return values.size;}, key:(n:number)=>[...values.keys()][n]??null, getItem:(k:string)=>values.get(String(k))??null, setItem:(k:string,v:string)=>{values.set(String(k),String(v));}, removeItem:(k:string)=>{values.delete(String(k));}, clear:()=>values.clear() };
  return new Proxy(storage as Storage, {get:(target,key)=>key in target?Reflect.get(target,key):values.get(String(key)),set:(_,key,value)=>{values.set(String(key),String(value));return true;}});
}
for (const key of ['localStorage','sessionStorage'] as const) {
  try { void window[key].length; } catch { try {Object.defineProperty(window,key,{value:memoryStorage(),configurable:true});} catch { /* Browser may prohibit replacing this accessor. */ } }
}

window.fetch = async (input: RequestInfo | URL, options?: RequestInit) => {
  const value = input instanceof Request ? input.url : String(input);
  const local = resolve(value);
  if (!local) return nativeFetch(input, {...options,credentials:'omit'});
  const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return new Response('A static archive has no server endpoint.', {status:405});
  if (options?.signal?.aborted) throw new DOMException('Aborted','AbortError');
  try { const result = await resource(local.path); return new Response(method==='HEAD'?null:result.blob,{status:200,headers:{'Content-Type':result.blob.type}}); }
  catch { return new Response(`File not found in archive: ${local.path}`,{status:404}); }
};

// Dynamically assigned local resources resolve in the same archive, including import.meta.url URLs.
function rewriteAttribute(element: Element, attribute: string, value: string, set: (value:string)=>void) {
  const local = resolve(value);
  if (!local) {set(value);return;}
  const known = config.known[local.path];
  if (known) {set(known+local.hash);return;}
  if (!pathSet.has(local.path)) {set(value);send('warning',{message:`Missing resource: ${local.path}`});return;}
  const kind = element.tagName === 'LINK' ? 'style' : element.tagName === 'SCRIPT' ? 'script' : 'asset';
  void resource(local.path,kind).then(({blob,url})=>set((url??URL.createObjectURL(blob))+local.hash)).catch(()=>send('warning',{message:`Unable to load ${local.path}`}));
}
const originalSetAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function(name: string, value: string) {
  if ((name==='src' && /^(IMG|SCRIPT|SOURCE|VIDEO|AUDIO)$/.test(this.tagName)) || name==='poster' || (name==='href' && this.tagName==='LINK')) {
    rewriteAttribute(this,name,String(value),(next)=>originalSetAttribute.call(this,name,next));
  } else originalSetAttribute.call(this,name,value);
};
for (const [prototype,field] of [[HTMLImageElement.prototype,'src'],[HTMLScriptElement.prototype,'src'],[HTMLLinkElement.prototype,'href'],[HTMLVideoElement.prototype,'poster'],[HTMLSourceElement.prototype,'src']] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype,field);
  if (descriptor?.set && descriptor.get) Object.defineProperty(prototype,field,{...descriptor,set(this:Element,value:string){ rewriteAttribute(this,field,String(value),(next)=>descriptor.set!.call(this,next)); }});
}

window.addEventListener('message', async (event:MessageEvent) => {
  if (event.source !== parent || event.origin !== config.parentOrigin || event.data?.folio !== config.channel) return;
  const message = event.data;
  if (message.type === 'resource-result') {
    const pending=requests.get(message.requestId); if (!pending) return;
    clearTimeout(pending.timer);requests.delete(message.requestId);
    if (message.error) pending.reject(new Error(String(message.error)));
    else if (message.blob instanceof Blob) pending.resolve({blob:message.blob,url:message.url});
    else pending.reject(new Error('Invalid resource response'));
  }
  if (message.type !== 'capture' || capturing) return;
  capturing = true;
  // Offscreen frames can suspend animation callbacks used by image decoding.
  window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 20);
  window.cancelAnimationFrame = id => window.clearTimeout(id);
  const warnings: string[] = [];
  try {
    const delay = Math.max(0,Math.min(Number(message.delay)||700,5000));
    await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,4000))]);
    await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolveImage => {
      const timer=setTimeout(resolveImage,4000);const done=()=>{clearTimeout(timer);resolveImage();};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});
    })));
    await new Promise(resolveDelay=>setTimeout(resolveDelay,delay));
    const broken=Array.from(document.images).filter(img=>!img.complete||!img.naturalWidth).length;
    if (broken) warnings.push(`${broken} image${broken===1?'':'s'} did not finish loading.`);
    if (document.querySelector('video,iframe')) warnings.push('Embedded video and frames may not appear in browser captures.');
    const width = Math.max(1,Math.min(window.innerWidth,1920));
    const fullHeight=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,window.innerHeight);
    const height = message.fullPage ? Math.min(fullHeight,12000) : window.innerHeight;
    if (message.fullPage && fullHeight>12000) warnings.push('This long page was captured to the 12,000 px limit.');
    // Animations freeze only inside this disposable capture frame.
    const freeze=document.createElement('style');freeze.textContent='*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important;transition:none!important}';document.head.append(freeze);
    const blob=await toBlob(document.documentElement,{width,height,pixelRatio:1,canvasWidth:width,canvasHeight:height,backgroundColor:getComputedStyle(document.body).backgroundColor==='rgba(0, 0, 0, 0)'?'#ffffff':getComputedStyle(document.body).backgroundColor,cacheBust:false,preferredFontFormat:'woff2',filter:(node)=>!(node instanceof HTMLScriptElement)});
    if (!blob || blob.size<100) throw new Error('The renderer returned an empty image.');
    send('captured',{blob,width,height,warnings});
  } catch(error) { send('capture-error',{message:error instanceof Error?error.message:'This page could not be captured.'}); }
  finally {capturing=false;}
});

function ready() {
  send('ready',{title:document.title,height:Math.max(document.body?.scrollHeight??0,window.innerHeight)});
  let timer:ReturnType<typeof setTimeout>|undefined;
  new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>send('resize',{height:Math.max(document.body.scrollHeight,window.innerHeight)}),120);}).observe(document.body);
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready,{once:true}); else ready();
document.addEventListener('click',(event)=>{
  const link=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
  if (!link) return;
  const raw=link.getAttribute('href')??'';
  if (raw.startsWith('#')) return;
  const local=resolve(raw);
  if (local) {event.preventDefault();send('navigate',{path:local.path});}
});
document.addEventListener('keydown',(event)=>{
  if (event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey) return;
  const element=event.target as Element;
  if (element?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return;
  if (event.key==='ArrowDown'||event.key==='ArrowUp') {event.preventDefault();send('step',{direction:event.key==='ArrowDown'?1:-1});}
  if (event.key==='Escape') send('focus-tree');
});
window.addEventListener('error',(event)=>{ if(event.message) send('warning',{message:event.message.slice(0,220)}); });
window.addEventListener('unhandledrejection',(event)=>send('warning',{message:String(event.reason?.message??event.reason).slice(0,220)}));
