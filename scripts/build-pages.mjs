import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,[root+'node_modules/vite/bin/vite.js','build','--outDir','dist-pages'],{
 cwd:root,stdio:'inherit',env:{...process.env,VITE_OVERLAY_BROWSER_ONLY:'1'},
});
