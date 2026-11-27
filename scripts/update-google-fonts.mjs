/**
 * Refresh the locally bundled family-name index from the font catalog served
 * by Google Fonts. Metadata endpoint belongs to fonts.google.com (not the
 * documented developer REST API), so runtime uses the pinned JSON snapshot.
 * Never download, package, or redistribute actual font binaries.
 */
import {writeFile} from 'node:fs/promises';
const url='https://fonts.google.com/metadata/fonts';
const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
if(!response.ok)throw Error('Google Fonts catalog HTTP '+response.status);
let body=await response.text();
body=body.replace(/^\)\]\}'[ \n]*/, '');
const catalog=JSON.parse(body);
if(!Array.isArray(catalog.familyMetadataList)||catalog.familyMetadataList.length<1000)
  throw Error('Unexpected/partial Google Fonts metadata; existing catalog not overwritten');
const fontNames=/^[A-Za-z0-9][A-Za-z0-9 &'()+.,!_-]{0,99}$/;
const fontMap=new Map();
for(const item of catalog.familyMetadataList){
 if(typeof item.family!=='string'||!fontNames.test(item.family))continue;
 const category=typeof item.category==='string' ? item.category : 'Other';
 const popularity=Number.isFinite(item.popularity) ? item.popularity : 100_000;
 fontMap.set(item.family,{family:item.family,category,popularity});
}
if(fontMap.size<1000)throw Error('Catalog contained too few valid names');
const fonts=[...fontMap.values()].sort((a,b)=>a.popularity-b.popularity || a.family.localeCompare(b.family));
const result={source:url,updated:new Date().toISOString().slice(0,10),fonts:fonts.map(({family,category})=>({family,category}))};
await writeFile('public/google-fonts.json',JSON.stringify(result)+'\n');
console.log('Google Fonts families saved: '+fonts.length);
