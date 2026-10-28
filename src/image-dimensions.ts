import {getImageMetadata} from './cloud';
import type {HtmlPage} from './types';

export interface ImageDimensions {width:number;height:number}
export type ImageShape='all'|'landscape'|'portrait'|'square'|'unknown';
const learned=new Map<string,ImageDimensions>();
const listeners=new Set<()=>void>();
let revision=0;
let save:((value:Record<string,ImageDimensions>)=>Promise<unknown>)|undefined;
let saveTimer:ReturnType<typeof setTimeout>|undefined;
export function validImageDimensions(value:unknown):value is ImageDimensions {
  if(!value||typeof value!=='object')return false;
  const {width,height}=value as ImageDimensions;
  return [width,height].every(number=>Number.isSafeInteger(number)&&number>0&&number<=65536);
}
export function normalizeImageShape(value:unknown):ImageShape {
  return ['all','landscape','portrait','square','unknown'].includes(value as string)?value as ImageShape:'all';
}
export function imageOrientation(dimensions:ImageDimensions|undefined):Exclude<ImageShape,'all'> {
  if(!validImageDimensions(dimensions))return'unknown';
  return dimensions.width===dimensions.height?'square':dimensions.width>dimensions.height?'landscape':'portrait';
}
export function imageDimensions(item:HtmlPage):ImageDimensions|undefined {
  // Catalogue dimensions describe the original, even when the displayed WebP is smaller.
  const original=item.imageHash?getImageMetadata(item.imageHash):undefined;
  if(validImageDimensions(original))return{width:original.width,height:original.height};
  return learned.get(item.id);
}
export function matchesImageShape(item:HtmlPage,shape:ImageShape):boolean {
  return shape==='all'||imageOrientation(imageDimensions(item))===shape;
}
export function subscribeImageDimensions(listener:()=>void):()=>void {listeners.add(listener);return()=>listeners.delete(listener);}
export function dimensionVersion():number{return revision;}
function announce():void{revision++;for(const listener of listeners)listener();}
export function configureDimensionPersistence(persist:(value:Record<string,ImageDimensions>)=>Promise<unknown>):void{save=persist;}
export function installImageDimensions(value:unknown):void {
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  let changed=false;
  for(const[id,dimensions]of Object.entries(value).slice(0,100000)){
    if(!id||id.length>8192||!validImageDimensions(dimensions)||learned.has(id))continue;
    learned.set(id,{width:dimensions.width,height:dimensions.height});changed=true;
  }
  if(changed)announce();
}
/** Only call with original dimensions or authoritative original metadata. */
export function recordImageDimensions(id:string,width:number,height:number):void {
  if(!id||id.length>8192||!validImageDimensions({width,height}))return;
  const current=learned.get(id);if(current?.width===width&&current.height===height)return;
  if(learned.size>=100000&&!learned.has(id))learned.delete(learned.keys().next().value!);
  learned.set(id,{width,height});announce();
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{void save?.(Object.fromEntries(learned)).catch(()=>undefined);},500);
}
