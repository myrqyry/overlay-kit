/** Text-only grapheme animation; emote artwork, badges and media stay untouched.
 * Bounded to avoid hundreds of compositor layers during spam/bursts.
 */
export type LetterEnter = 'none' | 'fade' | 'rise' | 'pop' | 'scramble' | 'slide' | 'drop' | 'flip' | 'twist' | 'wave' | 'spring' | 'drift' | 'soft-land' | 'typewriter' | 'split-flap' | 'stagger-fade' | 'blur-focus' | 'curtain-wipe' | 'glitch-split' | 'dissolve' | 'fold-collapse' | 'gravity-drop';
export type LetterExit = 'none' | 'fade' | 'sink' | 'scatter' | 'slide' | 'flip' | 'shrink' | 'twist';
export const MAX_ANIMATED_LETTERS=120;
export const LETTER_STAGGER_MS=14;

const graphemes=(text:string):string[] => {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)]
      .map(part=>part.segment);
  }
  return Array.from(text);
};

/** Decorate only text nodes in chat message parts. Does not use innerHTML.
 * Group short words so normal word wrapping is retained.
 */
export function decorateChatLetters(content:HTMLElement, scramble=false, typewriter=false):number {
  const targets:Text[]=[];
  const visit=(node:Node) => {
    if (node.nodeType===Node.TEXT_NODE) { targets.push(node as Text); return; }
    if (node instanceof Element && (node.tagName==='IMG' || node.classList.contains('overlay-emote'))) return;
    for(const child of Array.from(node.childNodes)) visit(child);
  };
  visit(content);
  const all=targets.map(text=>graphemes(text.data));
  const count=all.reduce((n,chars)=>n+chars.filter(char=>typewriter || !/^\s+$/u.test(char)).length,0);
  if (count>MAX_ANIMATED_LETTERS || count===0) return 0;

  let index=0;
  for (let i=0;i<targets.length;i++) {
    const text=targets[i]!;
    const group=document.createDocumentFragment();
    const chars=all[i]!;
    let word=document.createElement('span');
    word.className='overlay-letter-word';
    const flush=()=>{if(word.childNodes.length)group.append(word); word=document.createElement('span');word.className='overlay-letter-word';};
    for(const char of chars) {
      if (/^\s+$/u.test(char)) {
        flush();
        if (typewriter) {
          const space=document.createElement('span');
          space.className='overlay-typewriter-step overlay-typewriter-space';
          space.textContent=char;
          space.style.setProperty('--letter-index',String(index++));
          group.append(space);
        } else group.append(document.createTextNode(char));
        continue;
      }
      const glyph=document.createElement('span');
      glyph.className=typewriter?'overlay-letter overlay-typewriter-step':'overlay-letter';
      if (scramble && /^[\p{Script=Latin}0-9]$/u.test(char)) {
        // The source grapheme remains the only real text node, which keeps
        // textContent, copyable text, and line measurements stable.
        const real=document.createElement('span');
        real.className='overlay-letter-real';
        real.textContent=char;
        glyph.dataset.scrambleReady='true';
        glyph.append(real);
      } else glyph.textContent=char;
      glyph.style.setProperty('--letter-index',String(index++));
      word.append(glyph);
      if (word.childNodes.length > 32) word.classList.add('overlay-letter-word-long');
    }
    flush();
    text.replaceWith(group);
  }
  return index;
}


/** A short, deterministic "signal acquisition" effect for Latin letters and
 * digits. The real text never changes and still determines glyph width.
 * Single timer per chat row, at most 120 graphemes, no persistent animation.
 */
export function startLetterScramble(
  row: HTMLElement, durationMs: number, onFinish?: () => void,
): () => void {
  const win = row.ownerDocument.defaultView;
  const reduced = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const letters = Array.from(row.querySelectorAll<HTMLElement>('.overlay-letter[data-scramble-ready]'));
  if (!win || reduced || letters.length === 0) return () => undefined;

  const symbols = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789?/#*+=';
  const duration = Math.max(120, Math.min(1200, durationMs));
  const started = Date.now();
  let timer: number | undefined;
  let stopped = false;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) win.clearTimeout(timer);
    // Removing attributes reveals the preserved, real characters instantly.
    for (const letter of letters) {
      delete letter.dataset.scrambling;
      delete letter.dataset.scramble;
    }
    onFinish?.();
  };

  const glyphAt = (index: number, step: number) =>
    symbols[(index * 17 + step * 11 + step * step * 3) % symbols.length]!;

  letters.forEach((letter, index) => {
    letter.dataset.scrambling = 'true';
    letter.dataset.scramble = glyphAt(index, 0);
  });

  const tick = () => {
    if (stopped) return;
    const elapsed = Date.now() - started;
    let waiting = false;
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i]!;
      if (!letter.dataset.scrambling) continue;
      const progress = elapsed - i * LETTER_STAGGER_MS;
      if (progress >= duration) {
        delete letter.dataset.scrambling;
        delete letter.dataset.scramble;
        continue;
      }
      waiting = true;
      const step = Math.max(0, Math.floor(progress / 55));
      const next = glyphAt(i, step);
      if (letter.dataset.scramble !== next) letter.dataset.scramble = next;
    }
    if (waiting) timer = win.setTimeout(tick, 45);
    else cleanup();
  };
  timer = win.setTimeout(tick, 45);
  return cleanup;
}

/** Shared cadence for the CSS reveal and its visual caret. The existing
 * 'Letter entrance duration' control chooses 30–110ms per grapheme. */
export function typewriterStepMs(durationMs: number): number {
  const bounded = Number.isFinite(durationMs) ? Math.max(120, Math.min(1200, durationMs)) : 320;
  return Math.max(30, Math.min(110, Math.round(bounded / 6)));
}

/** Reveals the actual glyphs/spaces in flow instead of hiding with opacity.
 * Unrevealed content occupies zero layout width, so a compact link or later
 * word cannot force blank lines before typing reaches it. All real text nodes
 * are retained for textContent, and the caret is presentation-only.
 *
 * The row owns one bounded timer; each tick catches up with wall-clock elapsed
 * time after background throttling. New chat messages never reset this clock.
 */
export function startLetterTypewriter(row: HTMLElement, durationMs: number, onFinish?: () => void): () => void {
  const win = row.ownerDocument.defaultView;
  const reduced = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const steps = Array.from(row.querySelectorAll<HTMLElement>('.overlay-message-content .overlay-typewriter-step'));
  const revealAll = () => {
    for (const step of steps) step.style.removeProperty('display');
  };
  if (!win || reduced || steps.length === 0) {
    revealAll();
    return () => undefined;
  }
  const caret = row.ownerDocument.createElement('span');
  caret.className = 'overlay-typewriter-caret';
  caret.setAttribute('aria-hidden', 'true');

  // The exported renderer may be used without a ChatFeed lifecycle. Only
  // hide glyphs once this timer owner exists, avoiding permanently invisible
  // standalone messages or early-render failures.
  for (const step of steps) step.style.display = 'none';
  const cadence = typewriterStepMs(durationMs);
  const started = Date.now();
  let shown = 0;
  let timer: number | undefined;
  let stopped = false;
  const revealThrough = (count: number) => {
    while (shown < count) {
      const step = steps[shown++]!;
      step.style.removeProperty('display');
      step.after(caret);
    }
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) win.clearTimeout(timer);
    revealAll();
    caret.remove();
    onFinish?.();
  };
  const tick = () => {
    if (stopped) return;
    const elapsed = Math.max(0, Date.now() - started);
    revealThrough(Math.min(steps.length, 1 + Math.floor(elapsed / cadence)));
    if (shown === steps.length) {
      stop();
    } else {
      timer = win.setTimeout(tick, Math.max(1, cadence - elapsed % cadence));
    }
  };
  revealThrough(1);
  timer = win.setTimeout(tick, cadence);
  return stop;
}
