/** Deliberate proportions for brief, bounded OBS trigger presentation.
 * These are artistic timing choices derived from φ, not animation "laws".
 * The independent trigger director remains the sole expiration clock.
 */
export const PHI=(1+Math.sqrt(5))/2;
export const GOLDEN_ANGLE_DEG=360/(PHI*PHI);
const INV_PHI=1/PHI;
const fract=(value:number)=>value-Math.floor(value);
const limit=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
const PALETTE=['#e6c896','#9bd6c5','#c2b5db','#ecaeb7','#a4c8da'] as const;
export interface GoldenParticleMotion {
  x:number;
  delayMs:number;
  durationMs:number;
  driftPx:number;
  rotationDeg:number;
  scale:number;
  color:string;
  iterations:number;
}
export function createGoldenCueMotion(duration:number){
  const durationMs=Number.isFinite(duration)?limit(Math.round(duration),2000,12000):6000;
  // 6 seconds -> 334ms arrival + 540ms release. The remaining time
  // holds the effect so it never competes continuously with chat.
  const enterMs=Math.round(limit(durationMs/PHI**6,220,560));
  const exitMs=Math.round(enterMs*PHI);
  const exitDelayMs=durationMs-exitMs;
  const pulseMs=Math.round(enterMs*PHI*PHI);
  return {
    durationMs,enterMs,exitMs,exitDelayMs,pulseMs,
    particle(index:number,kind:'confetti'|'rain'):GoldenParticleMotion {
      const i=Number.isFinite(index)?limit(Math.floor(index),0,32):0;
      // Low-discrepancy irrational spacing avoids visibly uniform columns.
      const phase=fract((i+1)*INV_PHI);
      const theta=(i+1)*GOLDEN_ANGLE_DEG*Math.PI/180;
      const x=Math.round((4+phase*92)*10)/10;
      const delayMs=Math.round(fract((i+1)*INV_PHI*INV_PHI)*pulseMs*INV_PHI);
      const slow=kind==='rain'?1.06:1.0;
      const durationMs=Math.round(limit(pulseMs*PHI*(0.86+(i%5)*.092)*slow,900,3000));
      const driftPx=Math.round(Math.cos(theta)*(24+(i%4)*14));
      const rotationDeg=Math.round(Math.sin(theta)*(kind==='rain'?12:540));
      const scale=Math.round((INV_PHI+(i%3)*INV_PHI*INV_PHI/2)*1000)/1000;
      const color=PALETTE[Math.floor(fract(i*INV_PHI)*PALETTE.length)]!;
      const iterations=Math.min(12,Math.max(1,Math.ceil((durationMs===0?0:Math.max(0,exitDelayMs-delayMs))/durationMs)));
      return {x,delayMs,durationMs,driftPx,rotationDeg,scale,color,iterations};
    },
  };
}
