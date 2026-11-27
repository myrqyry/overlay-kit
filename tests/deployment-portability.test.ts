import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const project=resolve(import.meta.dirname,'..');
const json=(path:string)=>JSON.parse(readFileSync(resolve(project,path),'utf8')) as Record<string,unknown>;

describe('self-contained cloud deployment',()=>{
  it('installs Chatbus from a pinned, reviewable in-repository snapshot',()=>{
    const pkg=json('package.json');
    const dependencies=pkg.dependencies as Record<string,string>;
    expect(dependencies['@myrqyry/chatbus']).toBe('file:vendor/chatbus');
    const vendored=json('vendor/chatbus/package.json');
    expect(vendored.name).toBe('@myrqyry/chatbus');
    expect(existsSync(resolve(project,'vendor/chatbus/src/index.ts'))).toBe(true);
    const sha=readFileSync(resolve(project,'vendor/chatbus/UPSTREAM_COMMIT'),'utf8').trim();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    const lock=readFileSync(resolve(project,'pnpm-lock.yaml'),'utf8');
    expect(lock).toContain('file:vendor/chatbus');
    expect(lock).not.toContain('file:../chatbus');
  });
  it('pins static three-page Vite output for Vercel without importing a long-running local server',()=>{
    const cfg=json('vercel.json');
    expect(cfg).toMatchObject({framework:'vite',outputDirectory:'dist-demo',
      buildCommand:'pnpm build',installCommand:'pnpm install --frozen-lockfile'});
    for(const file of ['index.html','chat.html','wall.html'])expect(existsSync(resolve(project,file))).toBe(true);
    expect(existsSync(resolve(project,'server/start.ts'))).toBe(true);
    const buildPermissions=readFileSync(resolve(project,'pnpm-workspace.yaml'),'utf8');
    expect(buildPermissions).toMatch(/allowBuilds:\s*\n\s*esbuild: true/);
  });
});
