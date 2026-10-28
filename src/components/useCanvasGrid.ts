import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {resolveGrid} from '../grid';
import type {GridLayout} from '../grid';

/** Observe the body's content box, including changes caused by a dragged sidebar. */
export function observeCanvasSize(element:HTMLElement,onSize:(width:number,height:number)=>void):()=>void{
  const update=(width:number,height:number)=>onSize(Number.isFinite(width)?Math.max(0,width):0,Number.isFinite(height)?Math.max(0,height):0);
  const measure=()=>{
    const style=window.getComputedStyle(element);
    update(element.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0),element.clientHeight-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0));
  };
  measure();
  if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const observer=new ResizeObserver(entries=>{const entry=entries.find(value=>value.target===element);if(entry)update(entry.contentRect.width,entry.contentRect.height);});
  observer.observe(element);return()=>observer.disconnect();
}

/** Attach to the gallery body only, leaving headings and paging controls outside it. */
export function useCanvasGrid(layout:GridLayout){
  const ref=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:0,height:0});
  useLayoutEffect(()=>{
    const element=ref.current;if(!element)return;
    return observeCanvasSize(element,(width,height)=>setSize(current=>current.width===width&&current.height===height?current:{width,height}));
  },[]);
  const resolved=useMemo(()=>resolveGrid(layout,size.width,size.height),[layout.columns,layout.rows,size.width,size.height]);
  return{ref,resolved,width:size.width,height:size.height};
}
