const MAX_REMOTE_BYTES = 256 * 1024 * 1024;

const IMAGE_MIME_EXTENSIONS: Record<string,string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

export function googleDriveFileId(value:string):string{
  const input=value.trim();
  if(!input)throw new Error('Paste a Google Drive file link.');
  let url:URL;
  try{url=new URL(input);}catch{throw new Error('Enter a valid Google Drive URL.');}
  const host=url.hostname.toLowerCase();
  if(!['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(host))throw new Error('Use a Google Drive file link.');
  if(/\/folders\//i.test(url.pathname))throw new Error('Google Drive folder links are not supported. Open a file and paste its share link instead.');
  const pathMatch=url.pathname.match(/\/file\/d\/([^/]+)/i);
  const id=pathMatch?.[1]??url.searchParams.get('id');
  if(!id||!/^[A-Za-z0-9_-]{10,}$/.test(id))throw new Error('This does not look like a Google Drive file link.');
  return id;
}

export function googleDriveDownloadUrl(value:string):string{
  const id=googleDriveFileId(value);
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
}

export function filenameFromContentDisposition(value:string|null):string|null{
  if(!value)return null;
  const utf=value.match(/filename\*=UTF-8''([^;]+)/i);
  if(utf){
    try{return decodeURIComponent(utf[1]).replace(/[\\/]/g,'_').trim()||null;}catch{/* fall through */}
  }
  const plain=value.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.replace(/[\\/]/g,'_').trim()||null;
}

function sniffExtension(bytes:Uint8Array,mime:string):string|null{
  const normalized=mime.split(';')[0].trim().toLowerCase();
  if(normalized==='application/zip'||normalized==='application/x-zip-compressed')return '.zip';
  if(IMAGE_MIME_EXTENSIONS[normalized])return IMAGE_MIME_EXTENSIONS[normalized];
  if(bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])&&[0x04,0x06,0x08].includes(bytes[3]))return '.zip';
  if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return '.png';
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return '.jpg';
  if(bytes.length>=6&&String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/))return '.gif';
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return '.webp';
  const head=new TextDecoder().decode(bytes.slice(0,512)).trimStart().toLowerCase();
  if(head.startsWith('<svg')||head.startsWith('<?xml')&&head.includes('<svg'))return '.svg';
  return null;
}

function displayName(id:string,headerName:string|null,extension:string):string{
  if(headerName){
    const lower=headerName.toLowerCase();
    if(lower.endsWith('.zip')||Object.values(IMAGE_MIME_EXTENSIONS).some(ext=>lower.endsWith(ext)))return headerName;
    return headerName+extension;
  }
  return `google-drive-${id}${extension}`;
}

export async function fetchGoogleDriveFile(
  value:string,
  onProgress?:(message:string)=>void,
  fetcher:typeof fetch=fetch,
):Promise<File>{
  const id=googleDriveFileId(value);
  const url=googleDriveDownloadUrl(value);
  onProgress?.('Connecting to Google Drive…');
  let response:Response;
  try{
    response=await fetcher(url,{method:'GET',redirect:'follow',credentials:'omit'});
  }catch{
    throw new Error('Google Drive blocked this browser download. Make the file available to anyone with the link and allow downloads, then try again.');
  }
  if(!response.ok)throw new Error(`Google Drive returned HTTP ${response.status}. Check that the link can download the file.`);
  const contentType=(response.headers.get('content-type')||'').toLowerCase();
  if(contentType.includes('text/html')){
    throw new Error('Google Drive returned a web page instead of the file. The file may need permission, a virus-scan confirmation, or downloads may be disabled.');
  }
  const declared=Number(response.headers.get('content-length')||0);
  if(Number.isFinite(declared)&&declared>MAX_REMOTE_BYTES)throw new Error('This Drive file is larger than the 256 MB remote-import limit.');
  if(!response.body)throw new Error('Google Drive returned an empty response.');

  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let received=0;
  while(true){
    const {done,value:chunk}=await reader.read();
    if(done)break;
    if(!chunk)continue;
    received+=chunk.byteLength;
    if(received>MAX_REMOTE_BYTES){
      await reader.cancel();
      throw new Error('This Drive file is larger than the 256 MB remote-import limit.');
    }
    chunks.push(chunk);
    const detail=declared?Math.min(100,Math.round(received/declared*100))+'%':Math.max(1,Math.round(received/1024/1024))+' MB';
    onProgress?.('Downloading from Google Drive · '+detail);
  }
  if(!received)throw new Error('Google Drive returned an empty file.');
  const probe=chunks[0]?.slice(0,512)??new Uint8Array();
  const extension=sniffExtension(probe,contentType);
  if(!extension)throw new Error('The Drive file is not a supported ZIP or image.');
  const headerName=filenameFromContentDisposition(response.headers.get('content-disposition'));
  const name=displayName(id,headerName,extension);
  const parts=chunks.map(chunk=>chunk.buffer.slice(chunk.byteOffset,chunk.byteOffset+chunk.byteLength) as ArrayBuffer);
  const blob=new Blob(parts,{type:contentType.split(';')[0]||undefined});
  return new File([blob],name,{type:blob.type,lastModified:Date.now()});
}
