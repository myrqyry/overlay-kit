// Offline, deterministic inventory of the installed production dependency graph.
// Retain license and notice text, normalizing line endings and trailing spaces; no runtime download required.
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=(p)=>readFileSync(p,'utf8');
const overrides=JSON.parse(read(join(root,'licenses/upstream/sources.json')));
const args=['list','--prod','--depth','Infinity','--json'];
const graph=JSON.parse(process.env.npm_execpath
 ?execFileSync(process.execPath,[process.env.npm_execpath,...args],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024})
 :execFileSync('pnpm',args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024}));
const packages=new Map();
function walk(node){
 for(const group of ['dependencies','optionalDependencies']){
  for(const dep of Object.values(node[group]??{})){
   if(!dep.path)throw Error('Missing installed package path in pnpm list');
   const p=resolve(dep.path),manifest=JSON.parse(read(join(p,'package.json')));
   const key=manifest.name+'@'+manifest.version;
   const files=readdirSync(p,{withFileTypes:true}).filter(e=>e.isFile()&&/^(licen[cs]e|notice|copying|copyright)(?:[._-]|$)/i.test(e.name)).map(e=>e.name).sort();
   const texts=files.map(name=>[name,read(join(p,name))]);
   const prior=packages.get(key);
   const current={manifest,texts,path:p};
   if(prior&&JSON.stringify(prior.texts)!==JSON.stringify(texts))throw Error('Divergent notice files for '+key);
   if(!prior)packages.set(key,current);
   walk(dep);
  }
 }
}
for(const project of graph)walk(project);
const sort=(a,b)=>a<b?-1:a>b?1:0;
const output=['Overlay Kit — production dependency licenses and notices',
 'Generated from the installed, lockfile-resolved production dependency graph.',
 'Includes installed runtime dependencies and transitive packages, including type-only packages.',
 'Development tools not distributed in runtime output are outside this inventory.',
 'Third-party rights are not changed by Overlay Kit’s Elastic License 2.0.',
 'See NOTICE for first-party and provider artwork boundaries.',
 'Third-party npm implementations are not included in the source distribution.',
 'Upstream fallback notices document the declared terms of installed dependencies.',
 'See docs/release-readiness.md for the source-only distribution boundary.',
 ''];
for(const key of [...packages.keys()].sort(sort)){
 const {manifest,texts,path}=packages.get(key);
 output.push('='.repeat(72),key,'Declared license: '+(manifest.license??'not declared'), '');
 if(manifest.name==='@myrqyry/chatbus'){
  output.push('First-party pinned source snapshot: '+read(join(root,'vendor/chatbus/UPSTREAM_COMMIT')).trim(),
   'Upstream project: https://github.com/myrqyry/chatbus',
   'Original upstream NOTICE:',read(join(root,'vendor/chatbus/NOTICE')).trimEnd(),
   'Original upstream license: vendor/chatbus/LICENSE (identical to root ELv2 LICENSE).','');
  continue;
 }
 if(manifest.name==='gsap'){
  if(manifest.version!=='3.15.0')throw Error('Review GSAP terms for updated version '+manifest.version);
  output.push('Official terms: https://gsap.com/standard-license/','');
  for(const file of ['gsap-core.js','CSSPlugin.js']){
   const header=read(join(path,file)).match(/\/\*![\s\S]*?\*\//)?.[0];
   if(!header||!header.includes('gsap.com/standard-license'))throw Error('Missing GSAP copyright header: '+file);
   output.push(file,header,'');
  }
  continue;
 }
 const override=overrides[key];
 if(!texts.length&&!override)throw Error('Missing license text; review '+key);
 for(const [name,body] of texts)output.push('Installed '+name,body.trimEnd(),'');
 if(override){
  output.push('Provenance: '+override.source,'Status: '+override.status,'');
  for(const name of override.files)output.push(name,read(join(root,'licenses/upstream',name)).trimEnd(),'');
 }
}
output.push('End of production dependency notices.','');
const body=output.join('\n').replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'');
const targets=[['THIRD_PARTY_NOTICES.txt',body],['public/third-party-notices.txt','\uFEFF'+body]];
for(const [name,content] of targets){
 const path=join(root,name);
 if(process.argv.includes('--check')){
  if(read(path)!==content)throw Error(name+' is stale; run pnpm licenses:generate and review');
 }else writeFileSync(path,content);
}
console.log('Production notices: '+packages.size+' package versions; '+(process.argv.includes('--check')?'verified':'generated'));
