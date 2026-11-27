import { gsap } from 'gsap';

export type CinematicEntrance = 'impact' | 'assemble' | 'comet';
export type CinematicExit = 'shatter' | 'vortex' | 'fold-away';

export const isCinematicEntrance = (value: string): value is CinematicEntrance =>
  value === 'impact' || value === 'assemble' || value === 'comet';
export const isCinematicExit = (value: string): value is CinematicExit =>
  value === 'shatter' || value === 'vortex' || value === 'fold-away';

export const reducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const canFragmentArtwork = (visual: HTMLElement): boolean =>
  Boolean(visual.firstElementChild?.querySelector('img'));

/** Fragments all display the real multilayer artwork, clipped into a fixed
 * 3x3 mosaic. The clip rectangles are static; only compositor properties move.
 * The original media remains unmodified underneath.
 */
function fragmentArtwork(visual: HTMLElement): HTMLElement[] {
  const artwork = visual.firstElementChild;
  if (!(artwork instanceof HTMLElement)) return [];
  const fragments: HTMLElement[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const tile = document.createElement('div');
      tile.className = 'overlay-wall-fragment';
      tile.setAttribute('aria-hidden', 'true');
      tile.dataset.fragmentIndex = String(y * 3 + x);
      const top = y * 100 / 3, left = x * 100 / 3;
      const bottom = (2 - y) * 100 / 3, right = (2 - x) * 100 / 3;
      tile.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}%)`;
      const copied = artwork.cloneNode(true) as HTMLElement;
      copied.removeAttribute('id');
      copied.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      tile.append(copied);
      visual.append(tile);
      fragments.push(tile);
    }
  }
  return fragments;
}

function cleanupEntrance(
  timeline: gsap.core.Timeline, artwork: HTMLElement, auxiliaries: HTMLElement[],
  completed: () => void,
): () => void {
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    timeline.kill();
    auxiliaries.forEach(item => item.remove());
    gsap.set(artwork, { clearProps:'transform,opacity,visibility,transformOrigin' });
    completed();
  };
  timeline.eventCallback('onComplete', release);
  return release;
}

/** GSAP entrance effects own a timeline and ephemeral nodes.
 * Lifecycle disposal or natural expiry cancels the entrance cleanly.
 */
export function mountCinematicEntrance(
  visual: HTMLElement, kind: CinematicEntrance, durationMs: number,
  onComplete: () => void = () => {},
): () => void {
  if (reducedMotion()) { onComplete(); return () => {}; }
  const artwork = visual.firstElementChild;
  if (!(artwork instanceof HTMLElement)) { onComplete(); return () => {}; }
  const duration = Math.min(1.5, Math.max(.1, durationMs / 1000));
  const effects: HTMLElement[] = [];
  const timeline = gsap.timeline({ paused: true });

  if (kind === 'assemble') {
    const fragments = fragmentArtwork(visual);
    effects.push(...fragments);
    gsap.set(artwork, { opacity:0 });
    fragments.forEach((fragment,index) => {
      const x = index % 3 - 1, y = Math.floor(index / 3) - 1;
      timeline.fromTo(fragment,
        { x:x*110 + (y ? 20 : -20), y:y*100 - (x ? 22 : 0),
          rotation:(index % 2 ? 1 : -1)*(18+index*7),
          scale:.65, opacity:0 },
        { x:0, y:0, rotation:0, scale:1, opacity:1,
          duration:duration*.7, ease:'power3.out' },
        (index % 5)*duration*.055);
    });
    // Seamlessly replace the nine aligned pieces with the original.
    timeline.set(artwork,{opacity:1},duration*.95);
  } else if (kind === 'impact') {
    const first = document.createElement('span');
    first.className = 'overlay-wall-impact-ring';
    const second = first.cloneNode(false) as HTMLElement;
    visual.append(first,second);
    effects.push(first,second);
    timeline.fromTo(artwork,
      { autoAlpha:0, scale:1.9, rotation:-8, y:-52 },
      { autoAlpha:1, scale:1, rotation:0, y:0, duration:duration*.6,
        ease:'back.out(2.1)' },0);
    timeline.fromTo(artwork, { scaleX:1.26, scaleY:.72 },
      { scaleX:1,scaleY:1,duration:duration*.35,ease:'elastic.out(1.1,.45)' },
      duration*.6);
    [first,second].forEach((ring,index)=>{
      timeline.fromTo(ring,
        {scale:.4,opacity:.75},
        {scale:2.5 + index*.6,opacity:0,duration:duration*.48,ease:'power2.out'},
        duration*(.4+index*.12));
    });
  } else {
    const streak=document.createElement('span');
    streak.className='overlay-wall-comet-trail';
    visual.append(streak);
    effects.push(streak);
    timeline.fromTo(artwork,
      { x:-155,y:110,rotation:-90,scale:.26,autoAlpha:0 },
      { x:0,y:0,rotation:8,scale:1.12,autoAlpha:1,
        duration:duration*.78,ease:'power4.out' },0);
    timeline.to(artwork,{rotation:0,scale:1,duration:duration*.22,ease:'power2.out'},duration*.78);
    timeline.fromTo(streak,
      {x:-135,y:55,scaleX:2,opacity:.65,rotation:-35},
      {x:-12,y:0,scaleX:.3,opacity:0,rotation:0,duration:duration*.9,ease:'power3.out'},0);
  }
  const stop = cleanupEntrance(timeline, artwork, effects, onComplete);
  timeline.play(0);
  return stop;
}

/** Start a cancellable cinematic exit. Calls done exactly once on completion;
 * scene eviction, moderation and disposal use cancel, not an exit animation.
 */
export function startCinematicExit(
  visual: HTMLElement, kind: CinematicExit, durationMs: number, done: () => void,
): () => void {
  if (reducedMotion()) { done(); return () => {}; }
  const artwork = visual.firstElementChild;
  if (!(artwork instanceof HTMLElement)) { done(); return () => {}; }
  const duration = Math.min(1.5, Math.max(.1,durationMs/1000));
  const timeline = gsap.timeline({paused:true});
  const fragments:HTMLElement[] = [];

  visual.dataset.wallPhase='exiting';
  if (kind === 'shatter') {
    fragments.push(...fragmentArtwork(visual));
    gsap.set(artwork,{opacity:0});
    fragments.forEach((fragment,index)=>{
      const x=index%3-1,y=Math.floor(index/3)-1;
      const direction=(index%2?1:-1);
      timeline.fromTo(fragment,
        {x:0,y:0,rotation:0,opacity:1,scale:1},
        {x:(x*.95+direction*.2)*145,y:y*110-55,
          rotation:direction*(40+index*11),opacity:0,
          scale:.62,duration:duration*.86,ease:'power2.in'},
        index*.018*duration);
    });
  } else if (kind === 'vortex') {
    timeline.to(artwork,{x:62,y:-64,rotation:135,scale:.72,
      duration:duration*.36,ease:'power2.in'},0);
    timeline.to(artwork,{x:-22,y:-150,rotation:900,scale:0,opacity:0,
      duration:duration*.64,ease:'power4.in'},duration*.36);
  } else {
    visual.style.perspective='700px';
    timeline.to(artwork,{
      rotateY:90,rotateX:35,skewY:-10,x:28,scale:.72,opacity:0,
      duration,ease:'power2.inOut',transformOrigin:'100% 50%',
    },0);
  }

  let ended=false;
  const release=()=>{
    if(ended)return;
    ended=true;
    timeline.kill();
    fragments.forEach(item=>item.remove());
    gsap.set(artwork,{clearProps:'transform,opacity,visibility,transformOrigin'});
    visual.style.removeProperty('perspective');
  };
  timeline.eventCallback('onComplete',()=>{
    if(ended)return;
    release();
    done();
  });
  timeline.play(0);
  return release;
}
