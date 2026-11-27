/** Motion contracts shared by standalone Chat and any consumer of Overlay Kit.
 * CSS lives in chat-motion.css; transforms, opacity and transient visual filters
 * or clips animate; row geometry stays untouched.
 */
import { LETTER_STAGGER_MS } from './letter-motion';
export type ChatEntrance =
  | 'none' | 'rise' | 'slide' | 'scale' | 'slide-right'
  | 'drop' | 'pop' | 'flip' | 'drift' | 'unfurl' | 'soft-land' | 'wave' | 'twist'
  | 'blur-focus' | 'curtain-wipe' | 'glitch-split' | 'dissolve' | 'split-flap' | 'fold-collapse';
export type ChatExit =
  | 'none' | 'fade' | 'slide-left' | 'slide-right'
  | 'sink' | 'shrink' | 'flip' | 'float-away' | 'tuck' | 'wave' | 'twist' | 'spring'
  | 'blur-out' | 'curtain-close' | 'glitch-split' | 'dissolve' | 'split-flap' | 'fold-collapse';

/** Keep the expired row in flow during its composited exit. No geometry reads.
 * Animationend is authoritative, with a deadline for missed CEF events.
 * Caller owns the DOM removal; this callback just signals completion.
 */
export function startChatExit(
  element: HTMLElement, effect: ChatExit, durationMs: number, done: () => void,
): () => void {
  const reduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || (effect === 'none' && (!element.dataset.letterExit || element.dataset.letterExit === 'none'))) {
    done(); return () => {};
  }

  element.dataset.phase = 'exiting';
  const letterExit = element.dataset.letterExit;
  const letterCount = Math.min(120, Number(element.dataset.letterCount) || 0);
  const letterMode = Boolean(letterCount && letterExit && letterExit !== 'none');
  const name = letterMode ? 'chat-letter-out-' + letterExit : 'chat-out-' + effect;
  const lastLetter = letterMode
    ? element.querySelectorAll('.overlay-letter').item(letterCount - 1) : null;
  let finished = false;
  let timeout: number | undefined;
  const release = () => {
    element.removeEventListener('animationend', onEnd);
    if (timeout !== undefined) window.clearTimeout(timeout);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    release();
    done();
  };
  const onEnd = (event: Event) => {
    if (event.target === (lastLetter ?? element) && (event as AnimationEvent).animationName === name) finish();
  };
  element.addEventListener('animationend', onEnd);
  timeout = window.setTimeout(finish,
    Math.max(0, durationMs) + (letterMode ? (letterCount - 1) * LETTER_STAGGER_MS : 0) + 100);
  return () => { finished = true; release(); };
}
