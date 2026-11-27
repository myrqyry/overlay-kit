import {describe,expect,it,vi} from 'vitest';
import {createTriggerPresentation} from '../src/trigger-presentation';
describe('bounded overlay special-effect presentation',()=>{
 it('applies an effects-only overlay without changing existing chat rows or layout',()=>{
  vi.useFakeTimers();
  try{
   const root=document.createElement('main');
   root.id='overlay-root';
   const row=document.createElement('div');row.className='overlay-chat-message';root.append(row);
   document.body.append(root);
   const onVisual=vi.fn();
   const presentation=createTriggerPresentation(root,{onVisual});
   presentation.show({effect:'confetti',label:'!hype · Alice',key:'!hype',durationMs:6000});
   expect(root.dataset.triggerEffect).toBe('confetti');
   expect(document.querySelector('.overlay-trigger-surface')?.parentElement).toBe(document.body);
   expect(document.querySelectorAll('.overlay-trigger-particle').length).toBeGreaterThan(0);
   expect(document.querySelectorAll('.overlay-trigger-particle').length).toBeLessThanOrEqual(24);
   expect(root.firstElementChild).toBe(row);
   expect(document.querySelector('.overlay-trigger-label')?.textContent).toBe('!hype · Alice');
   presentation.show(null);
   expect(root.dataset.triggerEffect).toBeUndefined();
   expect(document.querySelectorAll('.overlay-trigger-particle')).toHaveLength(0);
   presentation.dispose();
   expect(document.querySelectorAll('.overlay-trigger-surface')).toHaveLength(0);
   root.remove();
  }finally{vi.useRealTimers();}
 });
 it('gives each cue a fresh golden-proportioned animation scene and deterministic particles',()=>{
   const root=document.createElement('main');root.id='overlay-root';document.body.append(root);
   const presentation=createTriggerPresentation(root);
   const cue={effect:'confetti' as const,label:'!hype',key:'!hype',durationMs:6000};
   presentation.show(cue);
   const surface=document.querySelector<HTMLElement>('.overlay-trigger-surface')!;
   const first=surface.querySelector<HTMLElement>('.overlay-trigger-scene')!;
   expect(first).toBeTruthy();
   expect(first.style.getPropertyValue('--trigger-enter-ms')).toMatch(/\d+ms/);
   expect(first.style.getPropertyValue('--trigger-exit-delay-ms')).toMatch(/\d+ms/);
   const particles=Array.from(surface.querySelectorAll<HTMLElement>('.overlay-trigger-particle'));
   expect(particles).toHaveLength(22);
   expect(new Set(particles.map(p=>p.style.getPropertyValue('--particle-x'))).size).toBe(22);
   expect(new Set(particles.map(p=>p.style.getPropertyValue('--particle-color'))).size).toBeGreaterThanOrEqual(4);
   expect(particles.every(p=>p.style.getPropertyValue('--particle-iterations')!=='')).toBe(true);
   presentation.show(cue);
   const second=surface.querySelector('.overlay-trigger-scene');
   expect(second).not.toBe(first);
   expect(surface.querySelectorAll('.overlay-trigger-scene')).toHaveLength(1);
   expect(root.dataset.triggerEffect).toBe('confetti');
   presentation.show(null);
   expect(surface.querySelectorAll('.overlay-trigger-scene')).toHaveLength(0);
   presentation.dispose();root.remove();
 });
 it('style cues notify the existing view, and restore base on expiration',()=>{
  const root=document.createElement('main');document.body.append(root);
  const visual=vi.fn();
  const presentation=createTriggerPresentation(root,{onVisual:visual});
  presentation.show({effect:'paper',label:'!paper',key:'!paper',durationMs:5000});
  expect(visual).toHaveBeenLastCalledWith('paper');
  expect(root.dataset.triggerEffect).toBe('paper');
  presentation.show(null);
  expect(visual).toHaveBeenLastCalledWith(null);
  presentation.dispose();root.remove();
 });
});
