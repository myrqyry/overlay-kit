// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readKickClientConfig} from '../server/kick-client';

describe('local-only Kick client configuration',()=>{
 it('loads only owner-private files and never returns a secret in public status',()=>{
  const dir=mkdtempSync(join(tmpdir(),'kick-client-private-'));
  try {
   const path=join(dir,'kick.json');
   writeFileSync(path,JSON.stringify({clientId:'id',clientSecret:'secret'}),{mode:0o600});
   expect(readKickClientConfig(path)).toEqual({clientId:'id',clientSecret:'secret'});
   chmodSync(path,0o644);
   expect(readKickClientConfig(path)).toBeUndefined();
   chmodSync(path,0o600);
   writeFileSync(path,JSON.stringify({clientId:'id',clientSecret:''}));
   expect(readKickClientConfig(path)).toBeUndefined();
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
