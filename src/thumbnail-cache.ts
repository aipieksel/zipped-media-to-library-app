export const THUMBNAIL_MAX_ENTRIES=200;
export const THUMBNAIL_MAX_BYTES=32*1024*1024;
export const THUMBNAIL_MAX_FILE_BYTES=256*1024;
export function thumbnailEvictions(entries:readonly {key:string;bytes:number;lastUsedAt:number}[]):string[]{
  let bytes=entries.reduce((sum,entry)=>sum+entry.bytes,0),count=entries.length;
  const removed:string[]=[];
  for(const entry of [...entries].sort((a,b)=>a.lastUsedAt-b.lastUsedAt||a.key.localeCompare(b.key))){
    if(count<=THUMBNAIL_MAX_ENTRIES&&bytes<=THUMBNAIL_MAX_BYTES)break;
    removed.push(entry.key);count--;bytes-=entry.bytes;
  }
  return removed;
}
