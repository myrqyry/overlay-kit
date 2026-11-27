import {describe,it,expect,vi} from 'vitest';
import {createPreviewLiveGate} from '../src/preview-live';

describe('preview live gate',()=>{
  it('does not enter live mode merely because a transport connected',()=>{
    const enter=vi.fn();const leave=vi.fn();
    const gate=createPreviewLiveGate({preview:true,onEnter:enter,onLeave:leave});
    gate.connectivityChanged(true);
    expect(gate.isLive()).toBe(false);
    expect(enter).not.toHaveBeenCalled();
  });

  it('enters on first actual live content and restores preview only after all sources disconnect',()=>{
    const enter=vi.fn();const leave=vi.fn();
    const gate=createPreviewLiveGate({preview:true,onEnter:enter,onLeave:leave});
    gate.contentArrived();
    expect(gate.isLive()).toBe(true);
    expect(enter).toHaveBeenCalledTimes(1);
    gate.contentArrived();
    expect(enter).toHaveBeenCalledTimes(1);
    gate.connectivityChanged(true);
    expect(leave).not.toHaveBeenCalled();
    gate.connectivityChanged(false);
    expect(gate.isLive()).toBe(false);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('is inert outside studio preview mode',()=>{
    const enter=vi.fn();const leave=vi.fn();
    const gate=createPreviewLiveGate({preview:false,onEnter:enter,onLeave:leave});
    gate.contentArrived();gate.connectivityChanged(false);
    expect(gate.isLive()).toBe(false);
    expect(enter).not.toHaveBeenCalled();expect(leave).not.toHaveBeenCalled();
  });
});
