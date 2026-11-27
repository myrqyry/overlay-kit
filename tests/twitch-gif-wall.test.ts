import {describe,expect,it} from 'vitest';
import {createEmoteWall} from '../src/views';
import type {DisplayMessage} from '../src/chatbus';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';

const gif='https://media2.giphy.com/media/smile/giphy.gif?cid=original&rid=giphy.gif';
const message=(id:string,url=gif,platform='twitch'):DisplayMessage=>({
 id,timestamp:10,platform,sourceId:platform+':example',
 user:{name:'Viewer',username:'viewer',badges:[]},
 parts:[
  {type:'text',text:'See '},
  {type:'media',text:'[A GIF]',alt:'[A GIF]',mediaType:'gif',url},
 ],
});
describe('opt-in Twitch subscriber GIFs in the Emote Wall',()=>{
 it('starts off and exposes a separate Wall option in saved links',()=>{
  expect(DEFAULT_OPTIONS.wallGifs).toBe(false);
  expect(optionsForEditor('wall',true).find(o=>o.key==='wallGifs')).toMatchObject({
   section:'Wall • Artwork',kind:'toggle',
  });
  expect(optionsForEditor('chat',true).some(o=>o.key==='wallGifs')).toBe(false);
  const opts=normalizeOptions({wallGifs:true});
  expect(readOptions('?'+writeOptions(opts,'wall'),'wall').wallGifs).toBe(true);
  expect(writeOptions(opts,'chat')).not.toContain('wallGifs');
 });
 it('keeps GIFs out of the wall by default without losing ordinary emotes',()=>{
  const root=document.createElement('div');document.body.append(root);
  const wall=createEmoteWall(root);
  expect(wall.receive(message('first'))).toBe(0);
  expect(root.querySelector('.overlay-wall-item')).toBeNull();
  wall.dispose();root.remove();
 });
 it('adds bounded GIPHY media when enabled, using the original URL and intrinsic aspect ratio',()=>{
  const root=document.createElement('div');document.body.append(root);
  const wall=createEmoteWall(root,{wallGifs:true,size:64});
  expect(wall.receive(message('first'))).toBe(1);
  const item=root.querySelector<HTMLElement>('.overlay-wall-item')!;
  expect(item?.dataset.wallMedia).toBe('gif');
  const image=item.querySelector<HTMLImageElement>('img')!;
  expect(image.getAttribute('src')).toBe(gif);
  expect(image.style.maxWidth).not.toBe('');
  expect(image.alt).toBe('[A GIF]');
  wall.dispose();root.remove();
 });
 it('ignores GIF media from non-Twitch providers, unsafe hosts and non-GIF images',()=>{
  const root=document.createElement('div');document.body.append(root);
  const wall=createEmoteWall(root,{wallGifs:true});
  expect(wall.receive(message('kick','https://media2.giphy.com/media/a/giphy.gif','kick'))).toBe(0);
  expect(wall.receive(message('bad','https://unsafe.example/gif.gif'))).toBe(0);
  expect(wall.receive(message('http','http://media2.giphy.com/gif.gif'))).toBe(0);
  expect(wall.receive({...message('image'),parts:[{type:'media',text:'Photo',mediaType:'image',url:gif}]})).toBe(0);
  expect(root.querySelector('.overlay-wall-item')).toBeNull();
  wall.dispose();root.remove();
 });
 it('switches on/off for future GIFs without retroactively deleting existing images',()=>{
  const root=document.createElement('div');document.body.append(root);
  const wall=createEmoteWall(root,{wallGifs:false});
  expect(wall.receive(message('zero'))).toBe(0);
  wall.configure({wallGifs:true});
  expect(wall.receive(message('one'))).toBe(1);
  wall.configure({wallGifs:false});
  expect(wall.receive(message('two'))).toBe(0);
  expect(root.querySelectorAll('.overlay-wall-item')).toHaveLength(1);
  wall.clear();
  expect(root.querySelectorAll('.overlay-wall-item')).toHaveLength(0);
  wall.dispose();root.remove();
 });
});
