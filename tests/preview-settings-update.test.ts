import {describe,it,expect,vi} from 'vitest';
import {updatePreviewFrame,suspendPreviewFrame} from '../src/preview-settings';
import {DEFAULT_OPTIONS} from '../src/options';

describe('studio preview settings updates',()=>{
  it('boots by navigation once, then updates settings in the existing iframe',()=>{
    const postMessage=vi.fn();
    const frame={src:'about:blank',dataset:{},contentWindow:{postMessage}} as unknown as HTMLIFrameElement;
    expect(updatePreviewFrame(frame,'chat.html?preview=1',DEFAULT_OPTIONS,'http://local')).toBe('reload');
    expect(frame.src).toContain('chat.html?preview=1');
    frame.dataset.previewReady='true';
    const previous=frame.src;
    expect(updatePreviewFrame(frame,'chat.html?preview=1&font=31',{...DEFAULT_OPTIONS,font:31},'http://local')).toBe('update');
    expect(frame.src).toBe(previous);
    expect(postMessage).toHaveBeenCalledWith({type:'overlay-kit-preview-settings',settings:{...DEFAULT_OPTIONS,font:31}},'http://local');
  });

  it('discards a suspended runtime and boots fresh with the latest settings on resume',()=>{
    const postMessage=vi.fn();
    const frame={src:'chat.html?preview=1',dataset:{previewReady:'true'},contentWindow:{postMessage}} as unknown as HTMLIFrameElement;
    suspendPreviewFrame(frame);
    expect(frame.src).toBe('about:blank');
    expect(frame.dataset.previewReady).toBe('false');
    suspendPreviewFrame(frame);
    expect(updatePreviewFrame(frame,'chat.html?preview=1&font=42',{...DEFAULT_OPTIONS,font:42},'http://local')).toBe('reload');
    expect(frame.src).toContain('font=42');
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('can explicitly reload when the source identity changes',()=>{
    const postMessage=vi.fn();
    const frame={src:'chat.html?preview=1',dataset:{previewReady:'true'},contentWindow:{postMessage}} as unknown as HTMLIFrameElement;
    expect(updatePreviewFrame(frame,'chat.html?preview=1&channel=next',DEFAULT_OPTIONS,'http://local',true)).toBe('reload');
    expect(frame.src).toContain('channel=next');
    expect(postMessage).not.toHaveBeenCalled();
  });
});
