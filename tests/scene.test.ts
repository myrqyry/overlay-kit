import { describe, expect, it } from 'vitest';
import { createScene, type SceneClock } from '../src/scene';

function fakeClock() {
  let time = 1000;
  let nextId = 0;
  const pending = new Map<number, { at: number; run: () => void }>();
  const clock: SceneClock = {
    now: () => time,
    setTimeout: (run, ms) => {
      const id = ++nextId;
      pending.set(id, { at: time + ms, run });
      return id;
    },
    clearTimeout: (id) => { pending.delete(id); },
  };
  return { clock, advance(ms: number) {
    const end = time + ms;
    while (true) {
      const next = [...pending].sort((a,b) => a[1].at-b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at;
      pending.delete(next[0]);
      next[1].run();
    }
    time = end;
  }, pending };
}

describe('overlay scene lifecycle', () => {
  it('bounds active elements, evicts oldest, expires entries and reclaims timers', () => {
    const { clock, advance, pending } = fakeClock();
    const root = document.createElement('div');
    const disposed: string[] = [];
    const scene = createScene<string>({
      root, clock, maxActive: 2, ttlMs: 500,
      render(value) {
        const element = document.createElement('span');
        element.textContent = value;
        return { element, dispose: () => { disposed.push(value); } };
      },
    });
    expect(scene.emit({ id: 'a', value: 'A' })).toBe(true);
    expect(scene.emit({ id: 'b', value: 'B' })).toBe(true);
    expect(scene.emit({ id: 'c', value: 'C' })).toBe(true);
    expect(scene.snapshot().map(item => item.id)).toEqual(['b', 'c']);
    expect(root.textContent).toBe('BC');
    expect(disposed).toEqual(['A']);
    advance(500);
    expect(scene.snapshot()).toEqual([]);
    expect(root.textContent).toBe('');
    expect(disposed).toEqual(['A', 'B', 'C']);
    scene.dispose();
    expect(pending.size).toBe(0);
    expect(scene.emit({ id: 'd', value: 'D' })).toBe(false);
  });

  it('rejects duplicates, honors drop-new, and resizes without remounting', () => {
    const { clock } = fakeClock();
    const root = document.createElement('div');
    const scene = createScene({
      root, clock, maxActive: 1, ttlMs: 10_000, overflow: 'drop-new',
      render(value: string) {
        const element = document.createElement('span');
        element.textContent = value;
        return { element };
      },
    });
    expect(scene.emit({ id: 'a', value: 'a' })).toBe(true);
    expect(scene.emit({ id: 'a', value: 'again' })).toBe(false);
    expect(scene.emit({ id: 'b', value: 'b' })).toBe(false);
    scene.configure({ maxActive: 2 });
    expect(scene.emit({ id: 'b', value: 'b' })).toBe(true);
    expect(root.textContent).toBe('ab');
    scene.configure({ maxActive: 1 });
    expect(root.textContent).toBe('b');
    scene.dispose();
  });

  it('opt-in overflow exits preserve logical capacity, cancel TTL timers, and finish by callback', () => {
    const { clock, pending } = fakeClock();
    const root = document.createElement('div');
    const finish = new Map<string, () => void>();
    const stopped: string[] = [];
    const scene = createScene<string>({
      root, clock, maxActive: 1, ttlMs: 20_000, exitOnOverflow: true,
      render(value) {
        const element = document.createElement('span');
        element.textContent = value;
        return {
          element,
          exit(done: () => void) { finish.set(value, done); return () => { stopped.push(value); }; },
        };
      },
    });
    scene.emit({ id: 'a', value: 'a' });
    scene.emit({ id: 'b', value: 'b' });
    expect(scene.snapshot().map(item => item.id)).toEqual(['b']);
    expect(root.textContent).toBe('ab');
    expect(pending.size).toBe(1);
    finish.get('a')!();
    expect(root.textContent).toBe('b');
    expect(stopped).toContain('a');
    scene.dispose();
    expect(pending.size).toBe(0);
  });

  it('can immediately moderate retiring items without killing unrelated active rows', () => {
    const { clock } = fakeClock();
    const root = document.createElement('div');
    const scene = createScene<{owner:string}>({
      root, clock, maxActive: 1, exitOnOverflow: true,
      render(item) {
        const element = document.createElement('span');
        element.textContent = item.owner;
        return { element, exit: () => {} };
      },
    });
    scene.emit({ id:'a', value:{owner:'offender'} });
    scene.emit({ id:'b', value:{owner:'viewer'} });
    expect(root.textContent).toBe('offenderviewer');
    expect(scene.removeMatching(item => item.value.owner === 'offender')).toBe(1);
    expect(root.textContent).toBe('viewer');
    expect(scene.snapshot().map(item => item.id)).toEqual(['b']);
    scene.dispose();
  });

  it('can remove an individual item without harming unrelated DOM', () => {
    const root = document.createElement('div');
    const existing = document.createElement('p');
    root.append(existing);
    const scene = createScene<string>({ root, ttlMs: 1000, render(value) {
      const element = document.createElement('div'); element.textContent = value;
      return { element };
    } });
    scene.emit({ id: 'one', value: 'One' });
    scene.remove('one');
    expect(root.firstChild).toBe(existing);
    expect(root.childElementCount).toBe(1);
    scene.dispose();
    expect(root.firstChild).toBe(existing);
  });
});
