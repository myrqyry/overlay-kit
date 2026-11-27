import {describe,it,expect,vi} from 'vitest';
import {createAccountPanel} from '../demo/account-panel';
function setup(fetcher:typeof fetch){
 const root=document.createElement('div'),notice=document.createElement('p'),feedback=document.createElement('p');
 const navigate=vi.fn();
 const panel=createAccountPanel({root,notice,feedback,fetcher,navigate});
 return {root,notice,feedback,panel,navigate,row:(provider:string)=>root.querySelector<HTMLElement>('[data-provider='+provider+']')!};
}
describe('platform accounts independent of chat source selection',()=>{
 it('explains hosted and preview boundaries without requesting account data',async()=>{
  const fetcher=vi.fn<typeof fetch>();
  const s=setup(fetcher);
  s.panel.setMode('hosted');await s.panel.refresh();
  expect(s.notice.textContent).toContain('local relay');
  expect(s.row('twitch').textContent).toContain('Anonymous IRC');
  expect(s.row('kick').textContent).toContain('anonymous');
  expect(s.row('youtube').textContent).toContain('without sign-in');
  expect(s.row('tiktok').textContent).toContain('No sign-in');
  expect(s.root.querySelectorAll('button')).toHaveLength(0);
  expect(fetcher).not.toHaveBeenCalled();
  s.panel.setMode('preview');expect(s.notice.textContent).toContain('preview');
 });
 it('shows provider-specific configured and connected states, and sends only the chosen account action',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async(path,opts)=>{
   if(path==='/api/oauth/status')return Response.json({mode:'local',configured:{twitch:true,kick:false,youtube:true},connected:{twitch:false,kick:false,youtube:true}});
   expect(path).toBe('/api/oauth/start');
   expect(JSON.parse(String(opts?.body))).toEqual({provider:'twitch'});
   return Response.json({url:'https://example.invalid/authorize'});
  });
  const s=setup(fetcher);
  s.panel.setMode('local');await s.panel.refresh();
  expect(s.row('twitch').querySelector('button')?.textContent).toBe('Sign in');
  expect(s.row('kick').textContent).toContain('App not configured');
  expect(s.row('kick').querySelector('button')).toBeNull();
  expect(s.row('youtube').querySelector('button')?.textContent).toBe('Sign out');
  expect(s.row('tiktok').querySelector('button')).toBeNull();
  s.row('twitch').querySelector('button')!.click();
  await vi.waitFor(()=>expect(s.navigate).toHaveBeenCalledWith('https://example.invalid/authorize'));
  expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('does not present disconnected accounts as known when status fails',async()=>{
  const s=setup(vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:503})));
  s.panel.setMode('local');await s.panel.refresh();
  expect(s.notice.textContent).toContain('Could not read');
  expect(s.root.querySelectorAll('button')).toHaveLength(0);
  expect(s.row('twitch').textContent).toContain('Status unavailable');
 });
 it('signs out only the chosen platform and refreshes account states',async()=>{
  let linked=true;
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async(path,opts)=>{
   if(path==='/api/oauth/status')return Response.json({mode:'local',configured:{twitch:true,kick:true,youtube:true},connected:{twitch:true,kick:false,youtube:linked}});
   expect(path).toBe('/api/oauth/disconnect');
   expect(JSON.parse(String(opts?.body))).toEqual({provider:'youtube'});
   linked=false;return Response.json({connected:{youtube:false}});
  });
  const s=setup(fetcher);
  s.panel.setMode('local');await s.panel.refresh();
  s.row('youtube').querySelector('button')!.click();
  await vi.waitFor(()=>expect(s.row('youtube').querySelector('button')?.textContent).toBe('Sign in'));
  expect(s.row('twitch').querySelector('button')?.textContent).toBe('Sign out');
  expect(s.feedback.textContent).toBe('Account signed out.');
  expect(s.navigate).not.toHaveBeenCalled();
 });

});
