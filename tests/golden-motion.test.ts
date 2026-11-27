import {describe,expect,it} from 'vitest';
import {PHI,GOLDEN_ANGLE_DEG,createGoldenCueMotion} from '../src/golden-motion';

describe('golden motion choreography for overlay trigger cues',()=>{
 it('derives positive entrance/release arcs from phi and fits all supported lifetimes',()=>{
  expect(PHI).toBeCloseTo(1.61803398875,9);
  expect(GOLDEN_ANGLE_DEG).toBeCloseTo(137.507764,4);
  for(const duration of [2000,4000,6000,12000]){
   const motion=createGoldenCueMotion(duration);
   expect(motion.enterMs).toBeGreaterThanOrEqual(200);
   expect(motion.exitMs/motion.enterMs).toBeCloseTo(PHI,1);
   expect(motion.exitDelayMs+motion.exitMs).toBe(duration);
   expect(motion.exitDelayMs).toBeGreaterThan(motion.enterMs);
   expect(motion.pulseMs).toBeGreaterThan(motion.enterMs);
  }
 });
 it('lays confetti across the width using golden-angle offsets rather than stripes',()=>{
  const motion=createGoldenCueMotion(6000);
  const particles=Array.from({length:22},(_,i)=>motion.particle(i,'confetti'));
  expect(particles.map(p=>p.x).every(x=>x>=4&&x<=96)).toBe(true);
  const columns=new Set(particles.map(p=>Math.round(p.x)));
  expect(columns.size).toBeGreaterThanOrEqual(20);
  expect(Math.min(...particles.map(p=>p.delayMs))).toBeGreaterThanOrEqual(0);
  expect(Math.max(...particles.map(p=>p.delayMs))).toBeLessThanOrEqual(motion.pulseMs);
  expect(new Set(particles.map(p=>p.color)).size).toBeGreaterThanOrEqual(4);
  expect(particles.every(p=>p.durationMs>=900&&p.durationMs<=3000)).toBe(true);
  expect(particles.every(p=>p.iterations>=1&&p.iterations<=12)).toBe(true);
 });
 it('bounds malicious or invalid durations and never creates NaN style values',()=>{
  for(const duration of [-Infinity,NaN,-999,0,1500,12000,9999999]){
   const motion=createGoldenCueMotion(duration);
   expect(motion.durationMs).toBeGreaterThanOrEqual(2000);
   expect(motion.durationMs).toBeLessThanOrEqual(12000);
   for(const value of Object.values(motion.particle(5,'rain'))){
    if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
   }
  }
 });
});
