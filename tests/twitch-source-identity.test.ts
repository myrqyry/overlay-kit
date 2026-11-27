import {describe,expect,it} from 'vitest';
import {loadTwitchSourcePortrait} from '../server/twitch-source-identity';
const url='https://static-cdn.jtvnw.net/jtv_user_pictures/alpha-profile_image-600x600.png';
describe('source portrait profile projection',()=>{
 it('keeps the broadcaster color with their own avatar without a second fetch',async()=>{
  const lookup=async()=>({avatarUrl:url,chatColor:'#68BE62'});
  expect(await loadTwitchSourcePortrait('alpha',lookup))
   .toEqual({url,color:'#68BE62'});
 });
 it('keeps a neutral fallback when the owner has not set chat color',async()=>{
  expect(await loadTwitchSourcePortrait('alpha',async()=>({avatarUrl:url,chatColor:null})))
   .toEqual({url});
  expect(await loadTwitchSourcePortrait('alpha',async()=>null)).toBeNull();
  expect(await loadTwitchSourcePortrait('alpha',async()=>({avatarUrl:null,chatColor:'#68BE62'})))
   .toBeNull();
 });
});
