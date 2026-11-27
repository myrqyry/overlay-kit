/** Single-wall, opt-in physical motion. The collision path owns only the
 * individual CSS translate property; entrance/exit artwork and style filters
 * remain independent. No external physics engine or per-emote RAF loops.
 */
export interface CollisionBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

const RESTITUTION = 0.9;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const contain = (body: CollisionBody, width: number, height: number): void => {
  const maxX = Math.max(0, width - body.width);
  const maxY = Math.max(0, height - body.height);
  if (maxX === 0) { body.x = 0; body.vx = 0; }
  else if (body.x < 0) { body.x = 0; body.vx = Math.abs(body.vx); }
  else if (body.x > maxX) { body.x = maxX; body.vx = -Math.abs(body.vx); }
  if (maxY === 0) { body.y = 0; body.vy = 0; }
  else if (body.y < 0) { body.y = 0; body.vy = Math.abs(body.vy); }
  else if (body.y > maxY) { body.y = maxY; body.vy = -Math.abs(body.vy); }
};

/** Velocity exchange + smallest-axis AABB separation. AABB deliberately uses
 * the rendered rectangular footprint, including wide and tall emote art.
 * Sweep-and-prune on X avoids a full pair search for sparse large walls.
 */
export function advanceWallCollisions(
  bodies: CollisionBody[], width: number, height: number, seconds: number,
): void {
  if (!(width > 0 && height > 0)) return;
  const dt = Number.isFinite(seconds) ? clamp(seconds, 0, 0.05) : 0;
  for (const body of bodies) {
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    contain(body, width, height);
  }

  // Two short passes settle most spawn overlaps without persistent impulses.
  for (let pass = 0; pass < 2; pass++) {
    const sorted = [...bodies].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        if (b.x >= a.x + a.width) break;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const direction = (a.x + a.width / 2 <= b.x + b.width / 2) ? 1 : -1;
          a.x -= overlapX * direction * 0.5;
          b.x += overlapX * direction * 0.5;
          if ((a.vx - b.vx) * direction > 0) {
            const av = a.vx, bv = b.vx;
            a.vx = (av + bv - RESTITUTION * (av - bv)) / 2;
            b.vx = (av + bv + RESTITUTION * (av - bv)) / 2;
          }
        } else {
          const direction = (a.y + a.height / 2 <= b.y + b.height / 2) ? 1 : -1;
          a.y -= overlapY * direction * 0.5;
          b.y += overlapY * direction * 0.5;
          if ((a.vy - b.vy) * direction > 0) {
            const av = a.vy, bv = b.vy;
            a.vy = (av + bv - RESTITUTION * (av - bv)) / 2;
            b.vy = (av + bv + RESTITUTION * (av - bv)) / 2;
          }
        }
      }
    }
    for (const body of bodies) contain(body, width, height);
  }
}

type Tracked = {
  element: HTMLElement;
  body: CollisionBody;
  baseX: number;
  baseY: number;
  ready: boolean;
};
const hash = (value: string) => {
  let result = 2166136261;
  for (const ch of value) result = Math.imul(result ^ ch.charCodeAt(0), 16777619);
  return result >>> 0;
};
const velocity = (id: string, speed: number) => {
  const angle = ((hash(id + ':angle') % 10000) / 10000) * Math.PI * 2;
  const amount = (55 + hash(id + ':velocity') % 35) * speed;
  return { vx: Math.cos(angle) * amount, vy: Math.sin(angle) * amount };
};

export function createWallCollisions(root: HTMLElement) {
  const entries = new Map<string, Tracked>();
  const win = root.ownerDocument.defaultView;
  const media = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let enabled = false;
  let disposed = false;
  let speed = 1;
  let frame: number | undefined;
  let lastTime: number | undefined;
  const stop = () => {
    if (frame !== undefined) win?.cancelAnimationFrame?.(frame);
    frame = undefined;
    lastTime = undefined;
  };
  const reset = () => {
    for (const entry of entries.values()) {
      entry.element.style.translate = '';
      entry.ready = false;
    }
  };
  const canRun = () => !disposed && enabled && !media?.matches
    && entries.size > 0 && root.clientWidth > 0 && root.clientHeight > 0
    && typeof win?.requestAnimationFrame === 'function';
  const schedule = () => {
    if (!canRun() || frame !== undefined) return;
    frame = win!.requestAnimationFrame(tick);
  };
  const tick = (time: number) => {
    frame = undefined;
    if (!canRun()) return;
    const elapsed = lastTime === undefined ? 1 / 60 : (time - lastTime) / 1000;
    lastTime = time;
    const ready: Tracked[] = [];
    for (const entry of entries.values()) {
      if (!entry.element.isConnected && root.isConnected) continue;
      const width = entry.element.offsetWidth, height = entry.element.offsetHeight;
      if (width <= 0 || height <= 0) continue;
      if (!entry.ready) {
        entry.baseX = entry.element.offsetLeft;
        entry.baseY = entry.element.offsetTop;
        entry.body.x = entry.baseX;
        entry.body.y = entry.baseY;
        entry.ready = true;
      }
      entry.body.width = width;
      entry.body.height = height;
      ready.push(entry);
    }
    advanceWallCollisions(ready.map(entry => entry.body), root.clientWidth, root.clientHeight, elapsed);
    for (const entry of ready) {
      const dx = entry.body.x - entry.baseX, dy = entry.body.y - entry.baseY;
      entry.element.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
    }
    schedule();
  };
  const onPreferenceChange = () => {
    stop();
    if (media?.matches) reset();
    else schedule();
  };
  media?.addEventListener?.('change', onPreferenceChange);
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => { if (canRun()) schedule(); }) : undefined;
  let observing = false;

  return {
    track(id: string, element: HTMLElement) {
      if (disposed) return;
      const vector = velocity(id, speed);
      entries.set(id, {
        element,
        body: { x: 0, y: 0, width: 0, height: 0, ...vector },
        baseX: 0, baseY: 0, ready: false,
      });
      schedule();
    },
    relocate(id: string) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.element.style.translate = '';
      entry.ready = false;
      schedule();
    },
    untrack(id: string, preserveExitPosition = false) {
      const entry = entries.get(id);
      if (!entry) return;
      // Expiring visuals keep their last physical position until the separate
      // artwork exit completes. Moderation/removal clears the transform.
      if (!preserveExitPosition) entry.element.style.translate = '';
      entries.delete(id);
      if (!entries.size) stop();
    },
    setSpeed(nextSpeed: number) {
      const next = clamp(Number.isFinite(nextSpeed) ? nextSpeed : 1, 0.25, 4);
      if (next === speed) return;
      for (const entry of entries.values()) {
        entry.body.vx *= next / speed;
        entry.body.vy *= next / speed;
      }
      speed = next;
    },
    setEnabled(next: boolean) {
      if (disposed || enabled === next) return;
      enabled = next;
      stop();
      reset();
      // Do not add even a passive resize observer to default CSS paths.
      if (next && observer && !observing) { observer.observe(root); observing = true; }
      else if (!next && observing) { observer?.disconnect(); observing = false; }
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      reset();
      entries.clear();
      if (observing) observer?.disconnect();
      observing = false;
      media?.removeEventListener?.('change', onPreferenceChange);
    },
  };
}
