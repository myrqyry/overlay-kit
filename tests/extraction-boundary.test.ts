import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {DEFAULT_OPTIONS,OPTION_DEFINITIONS,optionsForEditor} from '../src/options';
import {DEFAULT_PREVIEW_ENABLED} from '../src/preview-enabled';
import {parseEditorBackup} from '../src/editor-backup';

describe('Overlay Kit after Emote Pusher becomes a separate project',()=>{
 it('keeps only the four intended overlay views and no pusher controls',()=>{
   expect(Object.keys(DEFAULT_PREVIEW_ENABLED).sort()).toEqual(['avatars','chat','events','wall']);
   expect(OPTION_DEFINITIONS.filter(x=>x.section.startsWith('Pusher •'))).toHaveLength(0);
   expect(Object.keys(DEFAULT_OPTIONS).filter(x=>x.startsWith('pusher'))).toHaveLength(0);
   expect(optionsForEditor('chat',true).some(x=>x.key.startsWith('pusher'))).toBe(false);
 });
 it('removes the fifth tab and its browser source files',()=>{
   const html=readFileSync('index.html','utf8');
   expect(html).not.toContain('edit-pusher');
   expect(html).not.toContain('pusher-preview');
   for(const path of ['src/pusher-engine.ts','src/pusher-view.ts','src/pusher-camera.ts','src/pusher.css','pusher.html']){
     expect(existsSync(path),path).toBe(false);
   }
 });
 it('imports old five-view backups even when Coin Pusher was the active editor',()=>{
   const views=['wall','chat','avatars','events'];
   const settings=Object.fromEntries(views.map(view=>[view,{}]));
   const presets=Object.fromEntries(views.map(view=>[view,{}]));
   const result=parseEditorBackup({version:1,kind:'overlay-kit-user-settings',
     activeView:'pusher',settings:{...settings,pusher:{pusherTilt:48}},
     presets:{...presets,pusher:{SomeOldSetting:{}}}});
   expect(result.activeView).toBe('wall');
   expect(Object.keys(result.settings).sort()).toEqual([...views].sort());
 });
 it('accepts an older exported backup with a surplus pusher record without reinserting it',()=>{
   const views=['wall','chat','avatars','events'];
   const settings=Object.fromEntries(views.map(v=>[v,{}]));
   const presets=Object.fromEntries(views.map(v=>[v,{}]));
   const backup=parseEditorBackup({version:1,kind:'overlay-kit-user-settings',activeView:'chat',
     settings:{...settings,pusher:{pusherSpeed:2}},
     presets:{...presets,pusher:{}},
   });
   expect(Object.keys(backup.settings).sort()).toEqual(views.sort());
   expect(backup.settings).not.toHaveProperty('pusher');
 });
});
