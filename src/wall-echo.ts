import { gsap } from 'gsap';

const reducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A temporary analog-print afterimage of actual stacked emote artwork.
 * Owns one GSAP timeline and removes all clones at completion/disposal.
 * No globally registered tickers, fixed geometry or cloned event listeners.
 */
export function mountEchoPrint(visual: HTMLElement, artwork: HTMLElement, onFinish?: () => void): () => void {
  if (reducedMotion()) { onFinish?.(); return () => {}; }
  let finished = false;
  const release = () => { if (!finished) { finished = true; onFinish?.(); } };
  const ghosts: HTMLElement[] = [];
  for (let index = 0; index < 3; index++) {
    const ghost = document.createElement('div');
    ghost.className = 'overlay-wall-echo';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.dataset.echoIndex = String(index);
    ghost.append(artwork.cloneNode(true));
    visual.prepend(ghost);
    ghosts.push(ghost);
  }
  // Animate only the real artwork and ephemeral clone transforms.
  const timeline = gsap.timeline({
    onComplete: () => {
      for (const ghost of ghosts) ghost.remove();
      release();
    },
  });
  timeline.fromTo(artwork,
    { autoAlpha: 0, scale: .64, rotation: -8, x: -12 },
    { autoAlpha: 1, scale: 1, rotation: 0, x: 0, duration: .52, ease: 'back.out(2.3)' },
    0,
  );
  ghosts.forEach((ghost, index) => {
    const side = index % 2 ? -1 : 1;
    timeline.fromTo(ghost,
      { opacity: .34 - index * .06, x: 0, y: 0, rotation: 0, scale: .97 + index * .05 },
      { opacity: 0, x: side * (25 + index * 19), y: -19 - index * 11,
        rotation: side * (8 + index * 7), scale: 1.2 + index * .15,
        duration: .8 + index * .16, ease: 'power2.out' },
      index * .07,
    );
  });
  return () => {
    timeline.kill();
    for (const ghost of ghosts) ghost.remove();
    release();
    gsap.killTweensOf(artwork);
    gsap.set(artwork, { clearProps: 'transform,opacity,visibility' });
  };
}
