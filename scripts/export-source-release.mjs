// Create a history-free source archive from committed, explicitly allowed paths.
// Never reads ignored files, copies .git, rewrites history, or publishes.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const git=(args,encoding='utf8')=>execFileSync('git',args,{cwd:root,encoding,maxBuffer:100*1024*1024});
const destination=process.argv[2];
if(!destination)throw Error('Usage: pnpm release:source /absolute/path/overlay-kit-source.zip');
const out=resolve(destination);
if(out===resolve(root)||out.startsWith(resolve(root)+sep))throw Error('Choose an output path outside the development repository');
if(!out.endsWith('.zip'))throw Error('Destination must end in .zip');
if(git(['status','--porcelain','--untracked-files=normal']).trim())throw Error('Commit reviewed changes before exporting');
const roots=['.github/workflows/pages.yml','.gitignore','AGENTS.md','LICENSE','NOTICE','README.md','TECHNICAL.md','THIRD_PARTY_NOTICES.txt',
 'api','avatars.html','chat.html','demo','docs','events.html','index.html','licenses','package.json','pnpm-lock.yaml',
 'pnpm-workspace.yaml','public','scripts','server','src','tests','tsconfig.json','vendor','vercel.json','vite.config.ts','wall.html'];
const paths=git(['ls-tree','-r','--name-only','-z','HEAD','--',...roots]).split('\0').filter(Boolean);
for(const p of paths){
 if(/(?:^|\/)(?:\.git|\.meristem|node_modules|local-art|\.oauth-accounts\.json|\.live-channel\.json)(?:\/|$)/i.test(p)||
    /(?:^|\/)\.env(?:\.|$)/i.test(p)&&!p.endsWith('.env.example')||
    /\.(?:pem|key|p12|pfx)$/i.test(p)||
    /^public\/assets\/kick-(?:moderator|verified|gift-1|gift-25)\.svg$/i.test(p))
  throw Error('Forbidden release path: '+p);
}
const archive=git(['archive','--format=zip','--prefix=overlay-kit/','HEAD','--',...roots],null);
writeFileSync(out,archive,{flag:'wx'});
console.log('Exported '+paths.length+' tracked files from '+git(['rev-parse','HEAD']).trim()+' to '+out);
