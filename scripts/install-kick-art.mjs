// Opt-in installation of PNGs the user has permission to use. No network requests.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const names=['moderator','verified','gift-1','gift-25'];
const dest=fileURLToPath(new URL('../demo/local-art/kick/',import.meta.url));
const source=process.argv[2];
if(!source){
 console.log('Usage: pnpm art:install "/path/to/your/png-folder"\nAccepted filenames: '+names.map(n=>n+'.png').join(', '));
 process.exitCode=1;
}else{
 const signature=Buffer.from([137,80,78,71,13,10,26,10]);
 const files=[];
 for(const name of names){
  const file=resolve(source,name+'.png');
  let bytes;
  try{bytes=await readFile(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(bytes.length<33||bytes.length>1024*1024||!bytes.subarray(0,8).equals(signature)||
    bytes.toString('ascii',12,16)!=='IHDR'||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20)||
    bytes.readUInt32BE(16)>1024||bytes.readUInt32BE(20)>1024)
    throw new Error('Expected a PNG up to 1024×1024 and 1 MiB: '+file);
  files.push([name,bytes]);
 }
 if(!files.length)throw new Error('No accepted PNG filenames found. See docs/kick-badges.md.');
 await mkdir(dest,{recursive:true});
 for(const [name,bytes] of files){
  await writeFile(resolve(dest,name+'.png'),bytes);
  console.log('Installed '+name+'.png');
 }
 console.log('Restart the development server or rebuild with pnpm live. These files are ignored by Git; do not distribute your personal build without permission.');
}
