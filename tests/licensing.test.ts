import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(name:string)=>readFileSync(name,'utf8');
describe('distribution attribution',()=>{
 it('serves the same license and notice included in the source',()=>{
  expect(read('public/license.txt')).toBe('\uFEFF'+read('LICENSE'));
  expect(read('public/notice.txt')).toBe('\uFEFF'+read('NOTICE'));
  expect(JSON.parse(read('package.json')).license).toBe('Elastic-2.0');
  expect(read('vendor/chatbus/LICENSE')).toBe(read('LICENSE'));
  expect(JSON.parse(read('vendor/chatbus/package.json')).license).toBe('Elastic-2.0');
  expect(read('THIRD_PARTY_NOTICES.txt')).toContain(read('vendor/chatbus/NOTICE').trimEnd());
  expect(read('public/third-party-notices.txt')).toBe('\uFEFF'+read('THIRD_PARTY_NOTICES.txt'));
  expect(read('THIRD_PARTY_NOTICES.txt')).toContain('GSAP 3.15.0');
  expect(read('THIRD_PARTY_NOTICES.txt')).toContain('Copyright 2008 Google Inc.');
 });
 it('links original project and legal notices in the editor only',()=>{
  const editor=new DOMParser().parseFromString(read('index.html'),'text/html');
  expect(editor.querySelector('a.workbench-brand')?.getAttribute('href')).toBe('https://github.com/myrqyry/overlay-kit');
  expect(editor.querySelector('#project-attribution a[href="./license.txt"]')).not.toBeNull();
  expect(editor.querySelector('#project-attribution a[href="./notice.txt"]')).not.toBeNull();
  expect(editor.querySelector('#project-attribution a[href="./third-party-notices.txt"]')).not.toBeNull();
  for(const file of ['wall.html','chat.html','avatars.html','events.html'])
   expect(read(file)).not.toContain('project-attribution');
 });
});
