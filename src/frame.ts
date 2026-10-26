import type { PreparedPreview } from './preview';
export interface FrameHandlers {ready?:(height:number)=>void;resize?:(height:number)=>void;warning?:(message:string)=>void;navigate?:(path:string)=>void;step?:(direction:number)=>void;focusTree?:()=>void;captured?:(message:{blob:Blob;width:number;height:number;warnings:string[]})=>void;captureError?:(message:string)=>void;}
/** Accept only messages from this exact isolated frame and generation. */
export function attachFrameBridge(frame:HTMLIFrameElement,prepared:PreparedPreview,handlers:FrameHandlers) {
  let active=true;let inFlight=0;
  const receive=async(event:MessageEvent)=>{
    if(!active||event.source!==frame.contentWindow||event.data?.folio!==prepared.channel||typeof event.data?.type!=='string')return;
    const message=event.data;
    switch(message.type){
      case 'ready':handlers.ready?.(Number(message.height)||900);break;
      case 'resize':handlers.resize?.(Math.max(100,Math.min(Number(message.height)||900,50000)));break;
      case 'warning':if(typeof message.message==='string')handlers.warning?.(message.message.slice(0,300));break;
      case 'navigate':if(typeof message.path==='string'&&message.path.length<4096)handlers.navigate?.(message.path);break;
      case 'step':if(message.direction===1||message.direction===-1)handlers.step?.(message.direction);break;
      case 'focus-tree':handlers.focusTree?.();break;
      case 'capture-error':handlers.captureError?.(String(message.message).slice(0,300));break;
      case 'captured':
        if(message.blob instanceof Blob&&message.blob.type==='image/png'&&message.blob.size>100&&message.blob.size<50*1024*1024&&Number.isInteger(message.width)&&message.width>0&&message.width<=1920&&Number.isInteger(message.height)&&message.height>0&&message.height<=12000)
          handlers.captured?.({blob:message.blob,width:message.width,height:message.height,warnings:Array.isArray(message.warnings)?message.warnings.filter((item:unknown)=>typeof item==='string').slice(0,30):[]});
        else handlers.captureError?.('The page returned an invalid capture.');
        break;
      case 'resource':{
        if(typeof message.requestId!=='string'||message.requestId.length>100||typeof message.path!=='string'||!['asset','style','script',undefined].includes(message.kind))return;
        const reply=(payload:Record<string,unknown>)=>{if(active)frame.contentWindow?.postMessage({folio:prepared.channel,type:'resource-result',requestId:message.requestId,...payload},'*');};
        if(inFlight>=20){reply({error:'Too many simultaneous resource requests.'});return;}
        inFlight++;
        try {reply(await prepared.resource(message.path,message.kind));}catch(error){reply({error:error instanceof Error?error.message:'Resource unavailable'});}finally{inFlight--;}
        break;
      }
    }
  };
  window.addEventListener('message',receive);
  return ()=>{active=false;window.removeEventListener('message',receive);};
}
