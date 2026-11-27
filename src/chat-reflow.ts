/** Optional movement of existing rows after DOM-flow changes.
 * Only the individual CSS translate property is animated: per-message
 * entrance/exit can continue to own CSS transform and opacity.
 */
/** Compositor-only, gently decelerating row movement. Duration unchanged. */
export const GOLDEN_REFLOW_EASING='cubic-bezier(.19,.76,.24,1)';

export interface ChatReflowSettings {
  enabled?: boolean;
  durationMs?: number;
}

type Position = { left: number; top: number };
type ActiveAnimation = Pick<Animation, 'cancel'> & Partial<Pick<Animation, 'addEventListener'>>;

export function createChatReflow(root: HTMLElement, initial: ChatReflowSettings = {}) {
  let enabled = initial.enabled ?? false;
  let durationMs = Math.max(100, Math.min(1000, initial.durationMs ?? 240));
  let pendingFrame: number | undefined;
  let previous: Map<HTMLElement, Position> | undefined;
  const animations = new Map<HTMLElement, ActiveAnimation>();

  const permitted = () => enabled
    && (typeof window.matchMedia !== 'function'
      || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    && typeof requestAnimationFrame === 'function';

  const cancelAll = () => {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
    pendingFrame = undefined;
    previous = undefined;
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
  };

  const beforeChange = () => {
    if (!permitted() || previous !== undefined) return;
    previous = new Map();
    // Read all old rectangles together, before changing the DOM.
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) continue;
      const rect = child.getBoundingClientRect();
      previous.set(child, { top: rect.top, left: rect.left });
    }
  };

  const afterChange = () => {
    if (previous === undefined || pendingFrame !== undefined) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined;
      const first = previous;
      previous = undefined;
      if (!first || !permitted()) return;

      // Cancel old offsets in one write phase so the next measurements
      // represent the new natural layout. The starting values captured
      // above preserve the *visually current* position on interruption.
      for (const [element, animation] of animations) {
        animation.cancel();
        animations.delete(element);
      }

      const shifts: { element: HTMLElement; x: number; y: number }[] = [];
      // One batched geometry-read phase; do not re-measure newly inserted rows.
      for (const [element, from] of first) {
        if (element.parentElement !== root || typeof element.animate !== 'function') continue;
        const to = element.getBoundingClientRect();
        const x = from.left - to.left;
        const y = from.top - to.top;
        if (Math.abs(x) >= .5 || Math.abs(y) >= .5) shifts.push({ element, x, y });
      }

      // All compositor writes follow the reads. Existing CSS transform
      // animations on the message bubble remain independent of translate.
      for (const { element, x, y } of shifts) {
        try {
          const animation = element.animate([
            { translate: `${x}px ${y}px` },
            { translate: '0 0px' },
          ], {
            duration: durationMs, easing: GOLDEN_REFLOW_EASING,
            fill: 'none',
          });
          animations.set(element, animation);
          animation.addEventListener?.('finish', () => {
            if (animations.get(element) === animation) animations.delete(element);
          }, { once: true });
        } catch {
          // Unsupported individual translate animations (older OBS CEF)
          // must fall back to ordinary layout, not break message delivery.
        }
      }
    });
  };

  return {
    beforeChange,
    afterChange,
    configure(settings: ChatReflowSettings) {
      if (settings.enabled !== undefined) enabled = settings.enabled;
      if (settings.durationMs !== undefined)
        durationMs = Math.max(100, Math.min(1000, settings.durationMs));
      if (!permitted()) cancelAll();
    },
    dispose: cancelAll,
  };
}
