import gsap from 'gsap';

export type ChatDeletionEffect = 'none' | 'mixed' | 'scribble' | 'crumple';
export type ChatDeletionVisual = Exclude<ChatDeletionEffect, 'none' | 'mixed'>;

export interface DeletionFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  background: string;
  color: string;
  radius: string;
}

/** Capture layout before immediate removal. Never copy user text, images or HTML. */
export function captureDeletionFrame(element: HTMLElement): DeletionFrame | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(rect.left + rect.top)) return null;
  const styles = getComputedStyle(element);
  return {
    left: rect.left, top: rect.top, width: rect.width, height: rect.height,
    background: styles.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'rgba(16,18,27,.85)' : styles.backgroundColor,
    color: styles.color,
    radius: styles.borderRadius,
  };
}

/** Deterministic by message ID, no per-render random effect changes. */
export function chooseDeletionVisual(id: string, effect: ChatDeletionEffect): ChatDeletionVisual {
  if (effect === 'scribble' || effect === 'crumple') return effect;
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return (seed >>> 0) % 2 ? 'scribble' : 'crumple';
}

/** In-flow content-free afterimage that atomically replaces the original DOM.
 * It contains only our DELETED label and vector strokes, never chat content.
 * Cancellation removes its DOM and GSAP timeline for clear/dispose/bursts.
 */
export function mountDeletionGhost(
  original: HTMLElement,
  frame: DeletionFrame,
  visual: ChatDeletionVisual,
  durationMs: number,
  onComplete: () => void,
): () => void {
  const owner = original.ownerDocument;
  const ghost = owner.createElement('div');
  ghost.dataset.chatDeletionGhost = visual;
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'relative', flex: '0 0 auto',
    width: frame.width + 'px', height: frame.height + 'px',
    background: frame.background, color: frame.color,
    borderRadius: frame.radius, zIndex: '1',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    boxSizing: 'border-box', pointerEvents: 'none', overflow: 'hidden',
    willChange: 'transform,opacity', transformOrigin: 'center center',
    font: '700 12px/1.2 system-ui,sans-serif', letterSpacing: '0.09em',
  });
  const label = owner.createElement('span');
  label.textContent = 'DELETED';
  label.style.cssText = 'position:relative;z-index:1;opacity:.85;text-shadow:0 1px 3px #16121f;max-width:100%;overflow:hidden;white-space:nowrap;';
  ghost.append(label);

  // Paths use the bubble's actual pixel dimensions, rather than stretching
  // a fixed viewBox that fattens ink when a message is very wide.
  const w = Math.max(24, frame.width), h = Math.max(16, frame.height);
  const px = Math.min(14, w * .10);
  const x = (n: number) => Number(n.toFixed(2));
  const scribble = [
    ['M',x(px),x(h*.25),'C',x(w*.28),x(h*.30),x(w*.69),x(h*.68),x(w-px),x(h*.74)].join(' '),
    ['M',x(px),x(h*.76),'C',x(w*.35),x(h*.70),x(w*.63),x(h*.32),x(w-px),x(h*.26)].join(' '),
  ];
  const crumple = [
    ['M',x(w*.24),x(h*.22),'Q',x(w*.36),x(h*.41),x(w*.50),x(h*.47)].join(' '),
    ['M',x(w*.77),x(h*.19),'Q',x(w*.61),x(h*.35),x(w*.50),x(h*.47)].join(' '),
    ['M',x(w*.50),x(h*.47),'Q',x(w*.45),x(h*.67),x(w*.38),x(h*.81)].join(' '),
  ];
  const svg = owner.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, {position:'absolute', inset:'0', width:'100%', height:'100%'});
  const paths: SVGPathElement[] = [];
  const lengths: number[] = [];
  const strokeWidth = Math.max(2, Math.min(3.8, h * .065));
  const shapes = visual === 'scribble' ? scribble : crumple;
  const fallbackLengths = visual === 'scribble'
    ? [0, 1].map(() => Math.hypot(w - px * 2, h * .5) * 1.05)
    : [Math.hypot(w * .26, h * .25), Math.hypot(w * .27, h * .28),
      Math.hypot(w * .12, h * .34)].map(length => length * 1.05);
  for (const [index, shape] of shapes.entries()) {
    const path = owner.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', shape);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', String(strokeWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    // CEF and modern browsers provide the true curve length. Fall back to
    // a close geometric estimate if the SVG geometry API is unavailable.
    let measured = 0;
    try { measured = path.getTotalLength?.() ?? 0; } catch { /* fallback below */ }
    const length = Number.isFinite(measured) && measured > 0
      ? measured : fallbackLengths[index]!;
    path.style.strokeDasharray = length + 'px';
    path.style.strokeDashoffset = length + 'px';
    path.dataset.deleteStroke = 'true';
    paths.push(path);
    lengths.push(length);
    svg.append(path);
  }
  ghost.prepend(svg);
  // Replace the actual DOM node before any animation begins. The ghost has
  // none of the message's children, data, username, images, or markup.
  original.replaceWith(ghost);

  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    ghost.remove();
    onComplete();
  };
  const duration = Math.max(120, Math.min(700, durationMs)) / 350;
  const timeline = gsap.timeline({onComplete: finish});
  if (visual === 'scribble') {
    timeline.fromTo(paths, {
      strokeDashoffset: (i: number) => lengths[i],
    }, {
      strokeDashoffset: 0, duration:0.14 * duration,
      stagger:0.07 * duration, ease:'power1.inOut',
    }).to(ghost, {x:5, opacity:0, duration:0.11 * duration,ease:'power2.in'}, '+=0.01');
  } else {
    timeline.fromTo(paths, {
      strokeDashoffset: (i: number) => lengths[i],
    }, {
      strokeDashoffset:0, duration:0.09 * duration,
      stagger:0.025 * duration, ease:'power1.out',
    }).to(ghost, {
      rotation:-9, scale:0.86, duration:0.10 * duration, ease:'power2.in',
    }, '<').to(ghost, {
      rotation:17, scaleX:0.08, scaleY:0.36, opacity:0,
      duration:0.19 * duration, ease:'power3.in',
    });
  }
  return () => {
    if (closed) return;
    closed = true;
    timeline.kill();
    ghost.remove();
  };
}
