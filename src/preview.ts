import { uniqueId } from './identity';
import { resolveFileBlob } from './cloud';
import { init, parse } from 'es-module-lexer';
import bridgeSource from './generated/bridge.js?raw';
import type { ArchiveFile, HtmlPage } from './types';

export const ARCHIVE_ORIGIN='https://folio-archive.invalid';
const encodePath=(path:string)=>path.split('/').map(encodeURIComponent).join('/');
const toData=(text:string,mime:string)=>`data:${mime};charset=utf-8;base64,${bytesBase64(new TextEncoder().encode(text))}`;
function bytesBase64(bytes:Uint8Array) {let output='';for(let index=0;index<bytes.length;index+=32768) output+=String.fromCharCode(...bytes.subarray(index,index+32768));return btoa(output);}
const jsonSafe=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export interface PreparedPreview { html:string; channel:string; warnings:string[]; resource:(path:string,kind?:string)=>Promise<{blob:Blob;url?:string}>; }

export async function preparePreview(page:HtmlPage,files:Map<string,ArchiveFile>):Promise<PreparedPreview> {
  const source=files.get(page.path);if(!source) throw new Error('This page is no longer in the workspace. Re-import its ZIP.');
  const warnings=new Set<string>();const dataCache=new Map<string,Promise<string>>();const cssCache=new Map<string,Promise<string>>();
  const topFolders=new Set([...files.keys()].map(path=>path.includes('/')?path.split('/')[0]:''));
  const wrapper=topFolders.size===1?[...topFolders][0]:'';
  const lookup=(reference:string,owner:string):{path:string;hash:string}|null=>{
    if(!reference||/^(#|data:|blob:|mailto:|tel:|javascript:)/i.test(reference)) return null;
    try {
      const url=new URL(reference,`${ARCHIVE_ORIGIN}/${encodePath(owner)}`);if(url.origin!==ARCHIVE_ORIGIN) return null;
      let path=decodeURIComponent(url.pathname.slice(1));
      if(!files.has(path)&&wrapper&&files.has(`${wrapper}/${path}`)) path=`${wrapper}/${path}`;
      if(!files.has(path)&&files.has(`${path.replace(/\/$/,'')}/index.html`)) path=`${path.replace(/\/$/,'')}/index.html`;
      return {path,hash:url.hash};
    } catch {return null;}
  };
  const binary=async(path:string):Promise<string>=>{
    const existing=dataCache.get(path);if(existing) return existing;
    const file=files.get(path);if(!file){warnings.add(`Missing resource: ${path}`);return `${ARCHIVE_ORIGIN}/${encodePath(path)}`;}
    const promise=resolveFileBlob(file).then(blob=>blob.arrayBuffer()).then(buffer=>`data:${file.mime};base64,${bytesBase64(new Uint8Array(buffer))}`);dataCache.set(path,promise);return promise;
  };
  const asset=async(reference:string,owner:string)=>{const local=lookup(reference,owner);return local?(await binary(local.path))+local.hash:reference;};
  const replaceAsync=async(text:string,pattern:RegExp,replacer:(match:RegExpExecArray)=>Promise<string>)=>{
    const matches=[...text.matchAll(pattern)];const changes:string[]=[];
    // Resolve imports serially: parallel sibling CSS branches can await each other in a cycle.
    for(const match of matches) changes.push(await replacer(match));
    let result=text;for(let i=matches.length-1;i>=0;i--){const start=matches[i].index!;result=result.slice(0,start)+changes[i]+result.slice(start+matches[i][0].length);}return result;
  };
  const cssUrls=async(text:string,owner:string)=>replaceAsync(text,/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi,async(match)=>`url("${(await asset(match[1]??match[2]??match[3],owner)).replace(/"/g,'%22')}")`);
  const css=async(path:string,stack:Set<string>=new Set()):Promise<string>=>{
    if(stack.has(path)){warnings.add(`Circular stylesheet import: ${path}`);return '';}
    if(cssCache.has(path)) return cssCache.get(path)!;
    const file=files.get(path);if(!file){warnings.add(`Missing stylesheet: ${path}`);return '';}
    const next=new Set([...stack,path]);
    const promise=(async()=>compileCss(await (await resolveFileBlob(file)).text(),path,next))();
    cssCache.set(path,promise);return promise;
  };
  const compileCss=async(text:string,owner:string,stack:Set<string>=new Set()):Promise<string>=>{
    text=await replaceAsync(text,/@import\s+(?:url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([^;]*);/gi,async(match)=>{
      const local=lookup(match[1]??match[2],owner);if(!local)return match[0];
      const content=await css(local.path,stack);return match[3].trim()?`@media ${match[3]}{${content}}`:content;
    });
    return cssUrls(text,owner);
  };
  const doc=new DOMParser().parseFromString(await (await resolveFileBlob(source)).text(),'text/html');
  const originalBase=doc.querySelector('base[href]')?.getAttribute('href');
  let htmlOwner=page.path;
  if(originalBase){const local=lookup(originalBase,page.path);if(local)htmlOwner=local.path+(originalBase.endsWith('/')?'__base__.html':'');}
  doc.querySelectorAll('base,meta[http-equiv="Content-Security-Policy" i],meta[http-equiv="refresh" i]').forEach(el=>el.remove());
  const base=doc.createElement('base');base.href=`${ARCHIVE_ORIGIN}/${encodePath(htmlOwner)}`;doc.head.prepend(base);
  const importMappings:Record<string,string>=Object.create(null);
  for(const element of doc.querySelectorAll('script[type="importmap"]')){
    try {
      const contents=JSON.parse(element.textContent??'{}');
      for(const [key,value] of Object.entries(contents.imports??{}))if(typeof value==='string'){
        // Import-map targets are based on the document, even when a nested module uses them.
        importMappings[key]=new URL(value,`${ARCHIVE_ORIGIN}/${encodePath(htmlOwner)}`).href;
      }
      if(contents.scopes&&Object.keys(contents.scopes).length)warnings.add('Scoped import maps need a bundled HTML export.');
    }catch{warnings.add('An existing module import map is invalid.');}element.remove();
  }
  await init;
  const modules=new Map<string,string>();const pendingModules=new Map<string,Promise<void>>();
  const moduleId=(path:string)=>`${ARCHIVE_ORIGIN}/${encodePath(path)}`;
  const resolveModule=(name:string,owner:string):{path:string;id:string}|null=>{
    let target=name;
    if(!name.startsWith('.')&&!name.startsWith('/')&&!/^[\w+.-]+:/.test(name)){
      target=importMappings[name]??name;
      if(target===name){const prefix=Object.keys(importMappings).sort((a,b)=>b.length-a.length).find(key=>key.endsWith('/')&&name.startsWith(key));if(prefix)target=importMappings[prefix]+name.slice(prefix.length);else return null;}
    }
    const local=lookup(target,owner);if(!local)return null;
    if(!files.has(local.path)){warnings.add(`Missing module: ${local.path}`);return null;}
    return {path:local.path,id:moduleId(local.path)};
  };
  const transformModule=async(text:string,owner:string):Promise<string>=>{
    const [imports]=parse(text);const replacements:{start:number;end:number;text:string}[]=[];
    for(const entry of imports){
      if(entry.d===-2){if(text.slice(entry.e,entry.e+4)==='.url')replacements.push({start:entry.s,end:entry.e+4,text:JSON.stringify(moduleId(owner))});continue;}
      if(entry.n){const resolved=resolveModule(entry.n,owner);if(resolved){replacements.push({start:entry.s,end:entry.e,text:entry.d>=0?JSON.stringify(resolved.id):resolved.id});queueModule(resolved.path);} }
      else if(entry.d>=0)warnings.add('A computed module import may need a bundled HTML export.');
    }
    let result=text;for(const item of replacements.sort((a,b)=>b.start-a.start))result=result.slice(0,item.start)+item.text+result.slice(item.end);return result;
  };
  const queueModule=(path:string)=>{
    if(pendingModules.has(path))return;
    // Mark before traversal, so cyclic imports produce stable IDs rather than recursive data URLs.
    pendingModules.set(path,Promise.resolve());
    const promise=(async()=>{const file=files.get(path)!;modules.set(path,await transformModule(await (await resolveFileBlob(file)).text(),path));})();pendingModules.set(path,promise);
  };
  const moduleEntries:{element:HTMLScriptElement;path?:string;inline?:string}[]=[];
  for(const element of Array.from(doc.querySelectorAll('script[type="module"]')) as HTMLScriptElement[]){
    const src=element.getAttribute('src');
    if(src){const local=lookup(src,htmlOwner);if(local&&files.has(local.path)){queueModule(local.path);moduleEntries.push({element,path:local.path});}}
    else moduleEntries.push({element,inline:await transformModule(element.textContent??'',htmlOwner)});
  }
  while(true){const count=pendingModules.size;await Promise.all(pendingModules.values());if(count===pendingModules.size)break;}
  for(const [path,text] of modules)importMappings[moduleId(path)]=toData(text,'text/javascript');
  for(const [key,value] of Object.entries(importMappings)){const local=lookup(value,htmlOwner);if(local&&files.has(local.path)&&!value.startsWith('data:'))importMappings[key]=importMappings[moduleId(local.path)]??await binary(local.path);}
  for(const entry of moduleEntries){entry.element.removeAttribute('integrity');if(entry.path)entry.element.src=importMappings[moduleId(entry.path)];else entry.element.textContent=entry.inline??'';}
  if(Object.keys(importMappings).length){const map=doc.createElement('script');map.type='importmap';map.textContent=jsonSafe({imports:importMappings});doc.head.insertBefore(map,base.nextSibling);}
  for(const style of doc.querySelectorAll('style'))style.textContent=await compileCss(style.textContent??'',htmlOwner);
  for(const link of Array.from(doc.querySelectorAll('link[href]'))){
    const ref=link.getAttribute('href')!;const local=lookup(ref,htmlOwner);if(!local)continue;
    if((link.getAttribute('rel')??'').toLowerCase()==='stylesheet'){
      const replacement=doc.createElement('style');replacement.textContent=await css(local.path);if(link.hasAttribute('media'))replacement.setAttribute('media',link.getAttribute('media')!);link.replaceWith(replacement);
    }else if((link.getAttribute('rel')??'').includes('preload')||(link.getAttribute('rel')??'').includes('modulepreload'))link.remove();
    else link.setAttribute('href',await asset(ref,htmlOwner));
  }
  for(const element of Array.from(doc.querySelectorAll('[src],[poster],[srcset],[style],image[href],image[xlink\\:href]'))){
    if(element.tagName==='SCRIPT'&&(element.getAttribute('type')??'').toLowerCase()==='module')continue;
    for(const attr of ['src','poster','href','xlink:href']){
      if(!element.hasAttribute(attr)||(attr==='href'&&element.tagName.toLowerCase()!=='image'))continue;
      if(element.tagName==='IFRAME'){warnings.add('Embedded HTML frames may need to be opened as their own page.');continue;}
      element.setAttribute(attr,await asset(element.getAttribute(attr)!,htmlOwner));element.removeAttribute('integrity');
    }
    if(element.hasAttribute('style'))element.setAttribute('style',await cssUrls(element.getAttribute('style')!,htmlOwner));
    const srcset=element.getAttribute('srcset');if(srcset&&!srcset.trim().startsWith('data:')){
      element.setAttribute('srcset',(await Promise.all(srcset.split(',').map(async(part)=>{const [url,...descriptor]=part.trim().split(/\s+/);return `${await asset(url,htmlOwner)} ${descriptor.join(' ')}`.trim();}))).join(', '));
    }
  }
  for(const anchor of doc.querySelectorAll('a[href]')){
    const raw=anchor.getAttribute('href')!;const local=lookup(raw,htmlOwner);if(local)anchor.setAttribute('href',moduleId(local.path)+local.hash);
  }
  const channel=uniqueId();const known:Record<string,string>=Object.create(null);
  for(const [path,promise] of dataCache)known[path]=await promise;
  const bridge=doc.createElement('script');bridge.textContent=`window.__folioConfig=${jsonSafe({channel,pagePath:htmlOwner,origin:ARCHIVE_ORIGIN,parentOrigin:location.origin,wrapper,known,paths:[...files.keys()]})};\n${bridgeSource}`;
  doc.head.prepend(bridge);
  return {html:'<!doctype html>\n'+doc.documentElement.outerHTML,channel,warnings:[...warnings],resource:async(path,kind='asset')=>{
    if(typeof path!=='string'||path.length>4096||path.includes('\0')||path.startsWith('/')||path.split('/').includes('..'))throw new Error('Invalid archive path.');
    const file=files.get(path);if(!file)throw new Error(`File not found: ${path}`);
    if(kind==='style'){const text=await css(path);return {blob:new Blob([text],{type:'text/css'}),url:toData(text,'text/css')};}
    return {blob:await resolveFileBlob(file)};
  }};
}
