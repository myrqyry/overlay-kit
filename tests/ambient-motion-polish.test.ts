import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {GOLDEN_REFLOW_EASING} from '../src/chat-reflow';
import {DEFAULT_OPTIONS} from '../src/options';

const wall=readFileSync('src/wall-motion.css','utf8');
const chat=readFileSync('src/chat-motion.css','utf8');
describe('golden proportion polish across the main Wall and Chat motions',()=>{
 it('keeps existing user defaults, duration controls and their opt-outs',()=>{
   expect(DEFAULT_OPTIONS.motion).toBe('float');
   expect(DEFAULT_OPTIONS.wallEnter).toBe('none');
   expect(DEFAULT_OPTIONS.enter).toBe('rise');
   expect(DEFAULT_OPTIONS.letterEnter).toBe('none');
   expect(DEFAULT_OPTIONS.smoothReflow).toBe(false);
   expect(chat).toContain('[data-enter="none"]');
   expect(wall).toContain('[data-motion="float"]');
   expect(chat).toContain('[data-letter-enter="typewriter"]');
   expect(chat).toContain('prefers-reduced-motion: reduce');
   expect(wall).toContain('prefers-reduced-motion: reduce');
   expect(wall).toMatch(/@media\s*\(prefers-reduced-motion: reduce\)[\s\S]*?\.overlay-wall-item\[data-motion="float"\]/);
 });
 it('gives continuous emote movement coherent φ-positioned path anchors and quieter turns',()=>{
   expect(wall).toContain('--wall-ambient-ease:');
   expect(wall).toMatch(/@keyframes wall-float\s*\{[^}]*0%/s);
   expect(wall).toMatch(/@keyframes wall-float[\s\S]*?38\.2%/);
   expect(wall).toMatch(/@keyframes wall-float[\s\S]*?61\.8%/);
   expect(wall).toContain('var(--wall-ambient-ease)');
   expect(wall).toContain('var(--wall-enter-ease)');
   expect(wall).toContain('var(--wall-exit-ease)');
 });
 it('refines chat row and letter arrivals/exits without overriding animation identities',()=>{
   expect(chat).toContain('--chat-enter-ease:');
   expect(chat).toContain('--chat-exit-ease:');
   expect(chat).toContain('--chat-letter-ease:');
   expect(chat).toContain('var(--chat-letter-ease)');
   expect(chat).toMatch(/@keyframes chat-in-rise\s*\{[\s\S]*?61\.8%/);
   expect(chat).toMatch(/@keyframes chat-in-pop\s*\{[\s\S]*?61\.8%/);
   expect(chat).toMatch(/@keyframes chat-letter-in-soft-land\s*\{[\s\S]*?61\.8%/);
   expect(chat).toContain('animation: none !important');
 });
 it('adds a smooth golden reflow easing without changing row geometry',()=>{
   expect(GOLDEN_REFLOW_EASING).toBe('cubic-bezier(.19,.76,.24,1)');
 });
});
