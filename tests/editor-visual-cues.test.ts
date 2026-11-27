// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {OPTION_DEFINITIONS} from '../src/options';
import {sectionCue,optionCue} from '../demo/editor-visual-cues';
import {hydrateMingcuteIcons} from '../demo/mingcute-icons';

const BADGE_KEYS=['showBadges','showPlatformBadges','showSourceBadges','showViewerBadges',
 'showRoleBadges','showSubscriberBadges','showGifterBadges','showCosmeticBadges'] as const;

describe('MingCute editor visual cues',()=>{
 it('assigns a recognizable icon and restrained tone to every current inspector section',()=>{
  const sections=new Set(OPTION_DEFINITIONS.map(def=>def.section));
  const allowed=new Set(['mint','blue','gold','rose','violet','cyan']);
  for(const section of sections){
   const cue=sectionCue(section);
   expect(cue.icon).toMatch(/^[a-z][a-z\d-]*$/);
   expect(allowed.has(cue.tone)).toBe(true);
  }
  expect(sectionCue('Chat • Badges')).toMatchObject({icon:'badge',tone:'gold'});
  expect(sectionCue('Chat • Typography').icon).toBe('font');
 });
 it('gives each badge type its own semantic icon and tone without assigning unrelated controls',()=>{
  const values=BADGE_KEYS.map(key=>optionCue(key));
  expect(values.every(Boolean)).toBe(true);
  expect(new Set(values.map(x=>x?.icon)).size).toBe(BADGE_KEYS.length);
  expect(optionCue('max')).toBeUndefined();
  expect(optionCue('showSourceBadges')?.icon).toBe('profile');
  expect(optionCue('showGifterBadges')?.icon).toBe('gift');
 });
 it('renders real locally bundled MingCute SVGs with decorative accessibility and no duplicate children',()=>{
  const root=document.createElement('div');
  root.innerHTML='<span data-mingcute="badge"></span><span data-mingcute="gift"></span><span data-mingcute="search"></span>';
  hydrateMingcuteIcons(root);
  const svgs=root.querySelectorAll('svg.mingcute-icon');
  expect(svgs).toHaveLength(3);
  for(const svg of Array.from(svgs)){
   expect(svg.getAttribute('viewBox')).toMatch(/^0 0 /);
   expect(svg.getAttribute('aria-hidden')).toBe('true');
   expect(svg.querySelector('path')).not.toBeNull();
  }
  hydrateMingcuteIcons(root);
  expect(root.querySelectorAll('svg')).toHaveLength(3);
 });
});
