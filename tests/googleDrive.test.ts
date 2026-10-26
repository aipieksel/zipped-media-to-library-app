import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGoogleDriveFile,filenameFromContentDisposition,googleDriveDownloadUrl,googleDriveFileId} from '../src/googleDrive';

test('Google Drive file links resolve common share formats',()=>{
  const id='1AbCdEfGhIjKlMnOpQrStUvWxYz_12345';
  assert.equal(googleDriveFileId(`https://drive.google.com/file/d/${id}/view?usp=sharing`),id);
  assert.equal(googleDriveFileId(`https://drive.google.com/open?id=${id}`),id);
  assert.equal(googleDriveFileId(`https://drive.usercontent.google.com/download?id=${id}&export=download`),id);
  assert.match(googleDriveDownloadUrl(`https://drive.google.com/file/d/${id}/view`),new RegExp(id));
});

test('Google Drive parser rejects folders, other hosts and malformed links',()=>{
  assert.throws(()=>googleDriveFileId('https://drive.google.com/drive/folders/12345678901234567890'),/folder links/i);
  assert.throws(()=>googleDriveFileId('https://example.com/file/d/12345678901234567890'),/Google Drive/i);
  assert.throws(()=>googleDriveFileId('not a url'),/valid Google Drive URL/i);
});

test('content-disposition filename supports UTF-8 and quoted names',()=>{
  assert.equal(filenameFromContentDisposition("attachment; filename*=UTF-8''Banner%20Pack.zip"),'Banner Pack.zip');
  assert.equal(filenameFromContentDisposition('attachment; filename="Hero Pack.zip"'),'Hero Pack.zip');
  assert.equal(filenameFromContentDisposition(null),null);
});

test('Drive downloader returns a File that keeps a usable ZIP filename',async()=>{
  const id='1AbCdEfGhIjKlMnOpQrStUvWxYz_12345';
  const bytes=new Uint8Array([0x50,0x4b,0x03,0x04,1,2,3,4]);
  const fetcher=async()=>new Response(bytes,{
    status:200,
    headers:{
      'content-type':'application/octet-stream',
      'content-length':String(bytes.byteLength),
      'content-disposition':'attachment; filename="Banner Collection"',
    },
  });
  const progress:string[]=[];
  const file=await fetchGoogleDriveFile(`https://drive.google.com/file/d/${id}/view`,message=>progress.push(message),fetcher as typeof fetch);
  assert.equal(file.name,'Banner Collection.zip');
  assert.equal(file.size,bytes.byteLength);
  assert.ok(progress.some(message=>message.includes('Google Drive')));
});

test('Drive downloader rejects HTML permission pages and oversized responses',async()=>{
  const link='https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_12345/view';
  await assert.rejects(fetchGoogleDriveFile(link,undefined,(async()=>new Response('<html>login</html>',{status:200,headers:{'content-type':'text/html'}})) as typeof fetch),/web page instead of the file/i);
  await assert.rejects(fetchGoogleDriveFile(link,undefined,(async()=>new Response(new Uint8Array([0x50,0x4b,0x03,0x04]),{status:200,headers:{'content-type':'application/zip','content-length':String(257*1024*1024)}})) as typeof fetch),/larger than the 256 MB/i);
});
