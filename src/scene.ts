/** One owner per overlay root. No global timers, listeners or animation loops. */
export interface SceneClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}
const browserClock: SceneClock = {
  now: () => performance.now(),
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: id => window.clearTimeout(id),
};

export type OverflowPolicy = 'evict-oldest' | 'drop-new';
export interface SceneConfig {
  maxActive: number;
  ttlMs: number;
  overflow: OverflowPolicy;
}
export interface SceneOptions<T> extends Partial<SceneConfig> {
  root: HTMLElement;
  clock?: SceneClock;
  beforeDomChange?: () => void;
  afterDomChange?: () => void;
  /** Animate capacity evictions through the normal exit lifecycle. Off by default
   * so non-wall scenes preserve their established immediate eviction behavior. */
  exitOnOverflow?: boolean;
  render(value: T, id: string): {
    element: HTMLElement;
    dispose?: () => void;
    /** Called for natural expiry, and for capacity eviction when enabled.
     * Moderation, clear, and dispose remain immediate. */
    exit?: (done: () => void) => void | (() => void);
  };
}
export interface SceneItem<T> {
  id: string;
  value: T;
  enteredAt: number;
}
interface InternalItem<T> extends SceneItem<T> {
  element: HTMLElement;
  timer: number;
  dispose?: () => void;
  exit?: (done: () => void) => void | (() => void);
  exitCleanup?: () => void;
}
const check = (config: SceneConfig): void => {
  if (!Number.isSafeInteger(config.maxActive) || config.maxActive < 1 || config.maxActive > 10000)
    throw new RangeError('maxActive must be an integer from 1 to 10000');
  if (!Number.isFinite(config.ttlMs) || config.ttlMs < 1 || config.ttlMs > 3_600_000)
    throw new RangeError('ttlMs must be between 1 and 3600000');
  if (config.overflow !== 'evict-oldest' && config.overflow !== 'drop-new')
    throw new RangeError('Invalid overflow policy');
};

export function createScene<T>(options: SceneOptions<T>) {
  const clock = options.clock ?? browserClock;
  let config: SceneConfig = {
    maxActive: options.maxActive ?? 80,
    ttlMs: options.ttlMs ?? 15000,
    overflow: options.overflow ?? 'evict-oldest',
  };
  check(config);
  const active = new Map<string, InternalItem<T>>();
  // Expiring visuals keep their layout slot during exit but are no longer live
  // events. Moderation and disposal must still be able to destroy them.
  const exiting = new Map<string, InternalItem<T>>();
  let disposed = false;

  const remove = (id: string): boolean => {
    const item = active.get(id) ?? exiting.get(id);
    if (!item) return false;
    active.delete(id);
    exiting.delete(id);
    clock.clearTimeout(item.timer);
    item.exitCleanup?.();
    options.beforeDomChange?.();
    item.element.remove();
    options.afterDomChange?.();
    item.dispose?.();
    return true;
  };
  const expire = (id: string): void => {
    const item = active.get(id);
    if (!item) return;
    if (!item.exit) { remove(id); return; }
    active.delete(id);
    clock.clearTimeout(item.timer);
    exiting.set(id, item);
    const cleanup = item.exit(() => { remove(id); });
    // An exit callback may finish synchronously (e.g. reduced motion).
    if (exiting.has(id)) {
      if (cleanup) item.exitCleanup = cleanup;
    } else cleanup?.();
    // Never let exit animations create an unbounded second queue.
    while (exiting.size > config.maxActive) {
      const oldest = exiting.keys().next().value;
      if (oldest === undefined) break;
      remove(oldest);
    }
  };
  const retireOverflow = (id: string): void => {
    if (options.exitOnOverflow) expire(id);
    else remove(id);
  };
  const trim = () => {
    while (active.size > config.maxActive) {
      const oldest = active.keys().next().value;
      if (oldest === undefined) break;
      retireOverflow(oldest);
    }
    while (exiting.size > config.maxActive) {
      const oldest = exiting.keys().next().value;
      if (oldest === undefined) break;
      remove(oldest);
    }
  };
  return {
    emit(event: { id: string; value: T }): boolean {
      if (disposed || !event.id || active.has(event.id) || exiting.has(event.id)) return false;
      if (active.size >= config.maxActive) {
        if (config.overflow === 'drop-new') return false;
        const oldest = active.keys().next().value;
        if (oldest !== undefined) retireOverflow(oldest);
      }
      const view = options.render(event.value, event.id);
      const enteredAt = clock.now();
      options.beforeDomChange?.();
      options.root.append(view.element);
      options.afterDomChange?.();
      const timer = clock.setTimeout(() => { expire(event.id); }, config.ttlMs);
      active.set(event.id, { ...event, ...view, enteredAt, timer });
      return true;
    },
    remove,
    /** Immediate moderation of live AND already-retiring items. */
    removeMatching(matches: (item: SceneItem<T>) => boolean): number {
      let count = 0;
      for (const item of [...active.values(), ...exiting.values()]) {
        if (matches(item) && remove(item.id)) count++;
      }
      return count;
    },
    has(id:string):boolean { return active.has(id); },
    /** Refresh lifetime and/or move the existing live element to newest. */
    touch(id:string, settings:{refresh?:boolean;bump?:boolean}):boolean {
      if(disposed)return false;
      const item=active.get(id);
      if(!item)return false;
      if(settings.refresh){
        clock.clearTimeout(item.timer);
        item.timer=clock.setTimeout(()=>expire(id),config.ttlMs);
      }
      if(settings.bump){
        options.beforeDomChange?.();
        active.delete(id);active.set(id,item);
        options.root.append(item.element);
        options.afterDomChange?.();
      }
      return true;
    },
    /** In-place mutation preserves the existing element, lifetime and effects. */
    patch(id:string, edit:(value:T,element:HTMLElement)=>void):boolean {
      if(disposed)return false;
      const item=active.get(id);
      if(!item)return false;
      edit(item.value,item.element);
      return true;
    },
    clear(): void { for (const id of [...active.keys(), ...exiting.keys()]) remove(id); },
    configure(patch: Partial<SceneConfig>): void {
      if (disposed) return;
      const next = { ...config, ...patch };
      check(next);
      config = next;
      trim();
    },
    config(): SceneConfig { return { ...config }; },
    snapshot(): SceneItem<T>[] {
      return [...active.values()].map(({ id, value, enteredAt }) => ({ id, value, enteredAt }));
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const id of [...active.keys(), ...exiting.keys()]) remove(id);
    },
  };
}
export type OverlayScene<T> = ReturnType<typeof createScene<T>>;
