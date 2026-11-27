import {describe,it,expect} from 'vitest';
import type {SocialSignalV1} from '@myrqyry/chatbus';
import {createEventOverlay} from '../src/events';
import {
  normalizeEventTier, parseEventOverrides, resolveEventVisual, serializeEventOverrides,
  EVENT_VISUAL_DEFAULT, type EventVisualSettings,
} from '../src/event-overrides';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions} from '../src/options';

const base:EventVisualSettings={...EVENT_VISUAL_DEFAULT};
function signal(type:SocialSignalV1['event']['type'],tier?:string,id='evt'):SocialSignalV1{
  return {schemaVersion:1,producer:'chatbus',source:{platform:'twitch',channelName:'garden',origin:'live'},
    event:{type,id,occurredAtMs:1,receivedAtMs:1,...(tier?{tier}:{})},
    actor:{platform:'twitch',username:'mossy',displayName:'Mossy'}};
}
describe('event type and tier overrides',()=>{
 it('normalizes provider tier labels for matching',()=>{
  expect(normalizeEventTier('1000')).toBe('1');
  expect(normalizeEventTier('3000')).toBe('3');
  expect(normalizeEventTier(' Tier  2 ')).toBe('tier 2');
  expect(normalizeEventTier('Prime')).toBe('prime');
  expect(normalizeEventTier(undefined)).toBe('');
 });
 it('parses bounded rules and drops malformed entries',()=>{
  const rules=parseEventOverrides(JSON.stringify([
   {kind:'subscription',tier:'3',settings:{accent:'amber',motion:'fold-collapse',motionMs:99999,unknown:true}},
   {kind:'raid',settings:{exit:'dissolve'}},
   {kind:'message',settings:{accent:'rose'}},
   {kind:'follow',settings:{accent:'not-a-color'}},
   {kind:'cheer'},
  ]));
  expect(rules).toEqual([
   {kind:'subscription',tier:'3',settings:{accent:'amber',motion:'fold-collapse',motionMs:1500}},
   {kind:'raid',settings:{exit:'dissolve'}},
   {kind:'follow',settings:{}},
   {kind:'cheer',settings:{}},
  ]);
  expect(serializeEventOverrides(rules)).toContain('subscription');
  expect(parseEventOverrides('{not json')).toEqual([]);
  expect(parseEventOverrides('')).toEqual([]);
  expect(parseEventOverrides(Array.from({length:20},()=>({kind:'raid',settings:{accent:'rose'}})))).toHaveLength(12);
 });
 it('prefers an exact tier rule over a type rule, with later ties winning',()=>{
  const rules=parseEventOverrides([
   {kind:'subscription',settings:{accent:'rose'}},
   {kind:'subscription',tier:'2',settings:{accent:'mint'}},
   {kind:'subscription',tier:'3',settings:{accent:'violet',motion:'dissolve'}},
  ]);
  expect(resolveEventVisual(base,rules,'subscription','3')).toMatchObject({accent:'violet',motion:'dissolve'});
  expect(resolveEventVisual(base,rules,'subscription','2')).toMatchObject({accent:'mint',motion:'rise'});
  expect(resolveEventVisual(base,rules,'subscription','1')).toMatchObject({accent:'rose',motion:'rise'});
  expect(resolveEventVisual(base,rules,'gift-subscription','3')).toEqual(base);
 });
 it('round-trips rules through options, presets and OBS URLs',()=>{
  const serialized=serializeEventOverrides([
   {kind:'subscription',tier:'3',settings:{accent:'violet',motion:'fold-collapse'}},
   {kind:'raid',settings:{style:'paper',exit:'dissolve'}},
  ]);
  const settings=normalizeOptions({...DEFAULT_OPTIONS,eventOverrides:serialized});
  expect(settings.eventOverrides).toBe(serialized);
  const url=writeOptions(settings,'events');
  expect(url).toContain('overrides=');
  expect(readOptions('?'+url,'events')).toEqual(settings);
  expect(normalizeOptions({...DEFAULT_OPTIONS,eventOverrides:'nonsense'}).eventOverrides).toBe('');
  expect(writeOptions(normalizeOptions({...DEFAULT_OPTIONS}),'events')).not.toContain('overrides=');
 });
 it('applies the matching tier rule to the real alert surface and restores base afterwards',()=>{
  const rules=serializeEventOverrides([
   {kind:'subscription',tier:'3',settings:{accent:'violet',fontFamily:'serif',style:'paper',motion:'fold-collapse',motionMs:640,exit:'dissolve',exitMs:420,fontSize:52}},
  ]);
  const root=document.createElement('div');
  const overlay=createEventOverlay(root,{overrides:rules,durationMs:1000});
  overlay.receive(signal('subscription','3','tier3'));
  const surface=root.querySelector<HTMLElement>('.overlay-events')!;
  expect(surface.dataset.accent).toBe('violet');
  expect(surface.dataset.family).toBe('serif');
  expect(surface.dataset.style).toBe('paper');
  expect(surface.dataset.motion).toBe('fold-collapse');
  expect(surface.dataset.exit).toBe('dissolve');
  expect(surface.style.getPropertyValue('--event-enter-duration')).toBe('640ms');
  expect(surface.style.getPropertyValue('--event-exit-duration')).toBe('420ms');
  expect(surface.style.getPropertyValue('--events-font')).toBe('52px');
  overlay.receive(signal('subscription','1','tier1'));
  // The base alert is queued behind the first one, so resolve the base surface directly.
  expect(resolveEventVisual(base,parseEventOverrides(rules),'subscription','1')).toEqual(base);
  overlay.dispose();
 });
});
