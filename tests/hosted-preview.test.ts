import { describe, expect, it, vi } from 'vitest';
import { createHostedPreviewSession } from '../src/hosted-preview';

describe('hosted editor Disconnect is scoped to its own preview sockets', () => {
  it('starts once, stops once, can reconnect, and never sends channel-control requests', () => {
    const disposers: ReturnType<typeof vi.fn>[] = [];
    const open = vi.fn(() => {
      const dispose = vi.fn();
      disposers.push(dispose);
      return {dispose};
    });
    const states: boolean[] = [];
    const session = createHostedPreviewSession(open, state => states.push(state));
    expect(session.enabled).toBe(false);
    session.connect();
    session.connect();
    expect(open).toHaveBeenCalledTimes(1);
    expect(session.enabled).toBe(true);
    session.disconnect();
    session.disconnect();
    expect(disposers[0]).toHaveBeenCalledOnce();
    expect(session.enabled).toBe(false);
    session.connect();
    expect(open).toHaveBeenCalledTimes(2);
    session.dispose();
    expect(disposers[1]).toHaveBeenCalledOnce();
    expect(states).toEqual([true, false, true, false]);
  });
  it('starts studio iframes blank so a paused tab cannot connect before editor settings initialize',async()=>{
    const {readFileSync}=await import('node:fs');
    const {resolve}=await import('node:path');
    const html=readFileSync(resolve(import.meta.dirname,'../index.html'),'utf8');
    expect(html).toMatch(/id="wall-preview"[^>]*src="about:blank"/);
    expect(html).toMatch(/id="chat-preview"[^>]*src="about:blank"/);
    expect(html).toMatch(/id="events-preview"[^>]*src="about:blank"/);
  });
  it('closes the WebSocket on navigation without persisting a false Disconnect',()=>{
    const dispose=vi.fn(),onChange=vi.fn();
    const session=createHostedPreviewSession(()=>({dispose}),onChange);
    session.connect();
    expect(onChange).toHaveBeenCalledWith(true);
    session.dispose({notify:false});
    expect(dispose).toHaveBeenCalledOnce();
    expect(session.enabled).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('does not leave the session enabled if opening a socket throws', () => {
    const session = createHostedPreviewSession(() => { throw new Error('unavailable'); }, () => {});
    expect(() => session.connect()).toThrow('unavailable');
    expect(session.enabled).toBe(false);
  });
});
