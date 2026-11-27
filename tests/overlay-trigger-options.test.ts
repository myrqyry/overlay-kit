import {describe,expect,it} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor} from '../src/options';
describe('editable command/event trigger rules',()=>{
 it('keeps a distinct view-specific trigger editor for Chat and Wall',()=>{
  expect(DEFAULT_OPTIONS.wallTriggerRules).toBe('');
  expect(DEFAULT_OPTIONS.chatTriggerRules).toBe('');
  expect(optionsForEditor('chat',true).find(def=>def.key==='chatTriggerRules')).toMatchObject({kind:'trigger-rules',section:'Chat • Triggers'});
  expect(optionsForEditor('wall',true).find(def=>def.key==='wallTriggerRules')).toMatchObject({kind:'trigger-rules',section:'Wall • Triggers'});
  expect(optionsForEditor('events',true).some(def=>def.key==='wallTriggerRules')).toBe(false);
 });
 it('round-trips only allowed view effects, safe commands and events in URLs and presets',()=>{
  const settings=normalizeOptions({
   wallTriggerRules:'!hype -> confetti @any 7s\nraid -> spotlight 8s\n!retro -> phosphor @mods 7s',
   chatTriggerRules:'!retro -> paper @mods 7s\nsubscription -> pulse 5s',
  });
  expect(settings.wallTriggerRules).not.toContain('phosphor');
  expect(settings.chatTriggerRules).toContain('paper');
  const url=writeOptions(settings,'wall');
  expect(url).toContain('wallTriggers=');
  expect(url).not.toContain('chatTriggerRules');
  expect(readOptions('?'+url,'wall').wallTriggerRules).toBe(settings.wallTriggerRules);
  expect(readOptions('?'+writeOptions(settings,'chat'),'chat').chatTriggerRules).toBe(settings.chatTriggerRules);
 });
});
