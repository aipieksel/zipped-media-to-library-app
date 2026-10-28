import test from 'node:test';
import assert from 'node:assert/strict';
import {observeCanvasSize} from '../src/components/useCanvasGrid';

test('canvas observer measures the body content box, responds to sidebar resize and disconnects',()=>{
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),previousObserver=Object.getOwnPropertyDescriptor(globalThis,'ResizeObserver');
  const body={clientWidth:800,clientHeight:600},sizes:number[][]=[];
  let trigger:(entries:any[])=>void=()=>{},observed:unknown,disconnected=false;
  try{
    Object.defineProperty(globalThis,'window',{configurable:true,value:{getComputedStyle:()=>({paddingLeft:'8px',paddingRight:'8px',paddingTop:'4px',paddingBottom:'4px'})}});
    Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class{constructor(callback:any){trigger=callback;}observe(target:unknown){observed=target;}disconnect(){disconnected=true;}}});
    const stop=observeCanvasSize(body as HTMLElement,(width,height)=>sizes.push([width,height]));
    assert.deepEqual(sizes,[[784,592]]);assert.equal(observed,body);
    trigger([{target:{},contentRect:{width:1,height:1}},{target:body,contentRect:{width:464,height:592}}]);
    assert.deepEqual(sizes.at(-1),[464,592]);
    stop();assert.equal(disconnected,true);
  }finally{
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else delete(globalThis as any).window;
    if(previousObserver)Object.defineProperty(globalThis,'ResizeObserver',previousObserver);else delete(globalThis as any).ResizeObserver;
  }
});
test('canvas resize fallback remeasures and removes its listener without retaining a gallery',()=>{
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),previousObserver=Object.getOwnPropertyDescriptor(globalThis,'ResizeObserver');
  const body={clientWidth:300,clientHeight:200},sizes:number[][]=[];
  let resize:()=>void=()=>{},removed=false;
  try{
    Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:undefined});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{getComputedStyle:()=>({paddingLeft:'0',paddingRight:'0',paddingTop:'0',paddingBottom:'0'}),addEventListener:(name:string,callback:()=>void)=>{assert.equal(name,'resize');resize=callback;},removeEventListener:(name:string,callback:()=>void)=>{assert.equal(name,'resize');assert.equal(callback,resize);removed=true;}}});
    const stop=observeCanvasSize(body as HTMLElement,(width,height)=>sizes.push([width,height]));
    body.clientWidth=500;resize();assert.deepEqual(sizes,[[300,200],[500,200]]);stop();assert.equal(removed,true);
  }finally{
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else delete(globalThis as any).window;
    if(previousObserver)Object.defineProperty(globalThis,'ResizeObserver',previousObserver);else delete(globalThis as any).ResizeObserver;
  }
});
