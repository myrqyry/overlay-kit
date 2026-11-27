import { isCinematicExit, startCinematicExit } from './wall-cinematics';

export type WallEntrance = 'none' | 'fade' | 'pop' | 'drop' | 'slide' | 'spin' | 'echo-print' | 'impact' | 'assemble' | 'comet' | 'color-bloom' | 'prism-reveal' | 'pigment-wash' | 'unfurl' | 'spring' | 'blur-focus' | 'curtain-wipe' | 'glitch-split' | 'dissolve' | 'split-flap' | 'fold-collapse';
export type WallExit = 'none' | 'fade' | 'shrink' | 'drift' | 'sink' | 'spin' | 'shatter' | 'vortex' | 'fold-away' | 'color-drain' | 'prism-dissolve' | 'afterglow' | 'lift' | 'tumble' | 'flip' | 'spring' | 'blur-out' | 'curtain-close' | 'glitch-split' | 'dissolve' | 'split-flap' | 'fold-collapse';

export function startWallExit(
  visual: HTMLElement, effect: WallExit, durationMs: number, done: () => void,
): () => void {
  const reduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (effect === 'none' || reduced) { done(); return () => {}; }
  if (isCinematicExit(effect)) return startCinematicExit(visual,effect,durationMs,done);
  visual.dataset.wallPhase = 'exiting';
  const name = 'wall-out-' + effect;
  let finished = false;
  let timeout: number | undefined;
  const release = () => {
    visual.removeEventListener('animationend', onEnd);
    if (timeout !== undefined) window.clearTimeout(timeout);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    release();
    done();
  };
  const onEnd = (event: Event) => {
    if (event.target === visual && (event as AnimationEvent).animationName === name) finish();
  };
  visual.addEventListener('animationend', onEnd);
  timeout = window.setTimeout(finish, Math.max(0, durationMs) + 100);
  return () => { finished = true; release(); };
}
