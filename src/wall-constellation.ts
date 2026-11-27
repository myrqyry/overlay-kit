import { gsap } from 'gsap';

/** Spring-connected emote field. Coordinates are cached, never read from DOM on a tick. */
export interface FieldPoint {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  anchorX: number; anchorY: number;
}
interface Tracked { point: FieldPoint; element: HTMLElement; initialized: boolean; }

const NEIGHBOR_RADIUS = 240;
const SEPARATION_RADIUS = 78;
const MAX_PARTICLES = 48;
const FRAME_MS = 1000 / 30;

export function integrateField(points: FieldPoint[], dt: number): void {
  const step = Math.max(0, Math.min(dt, .05));
  const accelerations = points.map(point => ({
    x: (point.anchorX - point.x) * 5.5 - point.vx * 3.2,
    y: (point.anchorY - point.y) * 5.5 - point.vy * 3.2,
  }));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!, b = points[j]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= SEPARATION_RADIUS) continue;
      const directionX = distance > .01 ? dx / distance : (a.id < b.id ? -1 : 1);
      const directionY = distance > .01 ? dy / distance : 0;
      const force = 110 * (1 - distance / SEPARATION_RADIUS);
      accelerations[i]!.x += directionX * force;
      accelerations[j]!.x -= directionX * force;
      accelerations[i]!.y += directionY * force;
      accelerations[j]!.y -= directionY * force;
    }
  }
  points.forEach((point, i) => {
    const acceleration = accelerations[i]!;
    point.vx = Math.max(-110, Math.min(110, point.vx + acceleration.x * step));
    point.vy = Math.max(-110, Math.min(110, point.vy + acceleration.y * step));
    point.x += point.vx * step;
    point.y += point.vy * step;
    const fromAnchorX = point.x - point.anchorX;
    const fromAnchorY = point.y - point.anchorY;
    const dist = Math.hypot(fromAnchorX, fromAnchorY);
    if (dist > 100) {
      point.x = point.anchorX + fromAnchorX / dist * 100;
      point.y = point.anchorY + fromAnchorY / dist * 100;
      point.vx *= .6;
      point.vy *= .6;
    }
  });
}

const reducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The only active loop is GSAP's ticker, enabled only for the field mode.
 * Canvas draws filaments behind artwork; layers and Chatbus identities stay untouched.
 */
export function createConstellationField(root: HTMLElement) {
  const tracked = new Map<string, Tracked>();
  const canvas = document.createElement('canvas');
  canvas.className = 'overlay-wall-constellation';
  canvas.setAttribute('aria-hidden', 'true');
  // The regular wall never requests a canvas context. It is opt-in.
  let context: CanvasRenderingContext2D | null = null;
  let enabled = false;
  let ticking = false;
  let elapsed = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  const resize = () => {
    width = root.clientWidth;
    height = root.clientHeight;
    pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
  };
  const draw = (points: FieldPoint[]) => {
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!enabled) return;
    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      let connections = 0;
      // Connect each sprite to its nearest neighbors, not every possible pair.
      const close = points.slice(i + 1).map(other => ({
        other, d: Math.hypot(point.x - other.x, point.y - other.y),
      })).filter(candidate => candidate.d < NEIGHBOR_RADIUS)
        .sort((a, b) => a.d - b.d).slice(0, 2);
      for (const { other, d } of close) {
        const strength = 1 - d / NEIGHBOR_RADIUS;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.quadraticCurveTo(
          (point.x + other.x) / 2,
          (point.y + other.y) / 2 - 14 * strength,
          other.x, other.y,
        );
        context.strokeStyle = `rgba(235,198,153,${(.11 + .38 * strength).toFixed(3)})`;
        context.lineWidth = .6 + strength * 1.3;
        context.stroke();
        connections++;
      }
      if (connections > 0) {
        context.beginPath();
        context.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
        context.fillStyle = 'rgba(255,230,195,.38)';
        context.fill();
      }
    }
  };
  const points = () => [...tracked.values()].filter(entry => entry.initialized)
    .slice(0, MAX_PARTICLES).map(entry => entry.point);

  const step = (dt: number) => {
    const current = points();
    integrateField(current, dt);
    for (const { element, point } of tracked.values()) {
      if (!current.includes(point) || !enabled) continue;
      gsap.set(element, { x: point.x - point.anchorX, y: point.y - point.anchorY });
    }
    draw(current);
  };
  const ticker = (_time: number, deltaTime: number) => {
    if (!enabled || reducedMotion() || tracked.size === 0) return;
    elapsed += Math.min(70, deltaTime);
    if (elapsed < FRAME_MS) return;
    const interval = elapsed;
    elapsed = 0;
    step(interval / 1000);
  };
  const stop = () => {
    if (!ticking) return;
    ticking = false;
    gsap.ticker.remove(ticker);
  };
  const start = () => {
    if (ticking || !enabled || reducedMotion() || tracked.size === 0) return;
    ticking = true;
    gsap.ticker.add(ticker);
  };
  let observer: ResizeObserver | null = null;

  const setEnabled = (value: boolean) => {
    if (enabled === value) return;
    enabled = value;
    if (value) {
      context = canvas.getContext('2d');
      root.prepend(canvas);
      resize();
      if (!observer && typeof ResizeObserver !== 'undefined')
        observer = new ResizeObserver(() => { if (enabled) { resize(); draw(points()); } });
      observer?.observe(root);
      start();
      draw(points());
    } else {
      stop();
      observer?.disconnect();
      observer = null;
      canvas.remove();
      for (const { element, point } of tracked.values()) {
        gsap.set(element, { clearProps: 'x,y' });
        point.x = point.anchorX;
        point.y = point.anchorY;
        point.vx = point.vy = 0;
      }
    }
  };
  return {
    track(id: string, element: HTMLElement) {
      if (tracked.has(id)) return;
      tracked.set(id, {
        point: { id, x: 0, y: 0, vx: 0, vy: 0, anchorX: 0, anchorY: 0 },
        element, initialized: false,
      });
      start();
    },
    anchor(id: string, left: number, top: number, w: number, h: number) {
      const entry = tracked.get(id);
      if (!entry) return;
      const cx = left + w / 2, cy = top + h / 2;
      if (!entry.initialized) {
        entry.initialized = true;
        entry.point.x = cx;
        entry.point.y = cy;
        // New arrivals jostle their near neighbors; zero geometry reads.
        if (enabled && !reducedMotion()) {
          for (const other of tracked.values()) {
            if (!other.initialized || other === entry) continue;
            const dx = other.point.x - cx, dy = other.point.y - cy;
            const dist = Math.hypot(dx, dy);
            if (dist < 280 && dist > .01) {
              other.point.vx += dx / dist * (90 * (1 - dist / 280));
              other.point.vy += dy / dist * (90 * (1 - dist / 280));
            }
          }
        }
      } else {
        entry.point.x += cx - entry.point.anchorX;
        entry.point.y += cy - entry.point.anchorY;
      }
      entry.point.anchorX = cx;
      entry.point.anchorY = cy;
      if (enabled && !ticking) draw(points());
    },
    untrack(id: string) {
      const entry = tracked.get(id);
      if (!entry) return;
      gsap.set(entry.element, { clearProps: 'x,y' });
      tracked.delete(id);
      if (!tracked.size) { stop(); draw([]); }
    },
    setEnabled,
    step,
    dispose() {
      setEnabled(false);
      tracked.clear();
    },
  };
}
