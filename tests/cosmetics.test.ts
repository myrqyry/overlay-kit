import {describe,it,expect,vi} from 'vitest';
import type {Badge, NamePaint, UserCosmetics} from '@myrqyry/chatbus';
import {createUserCosmeticsResolver, type CosmeticSources} from '../server/cosmetics';

const badge=(provider:'bttv'|'ffz'|'7tv',id:string):Badge=>({
 provider,id,scope:'user',images:[{url:'https://example.net/'+provider+'.png'}],
});
const paint:NamePaint={id:'paint',provider:'7tv',color:0xffff0066,
 gradients:[{function:'LINEAR_GRADIENT',angle:45,stops:[{at:0,color:0xffff0066},{at:1,color:0xff0011ff}]}]};
const cosmetics:UserCosmetics={provider:'7tv',namePaint:paint,badges:[badge('7tv','seven')]};
describe('shared Chatbus identity cosmetics resolver',()=>{
 it('joins BTTV/FFZ and 7TV badges + 7TV name paint in a single cached result',async()=>{
  const sources:CosmeticSources={
   bttv:vi.fn(async()=>({value:[badge('bttv','b')],ok:true})),
   ffz:vi.fn(async()=>({value:[badge('ffz','f')],ok:true})),
   sevenTv:vi.fn(async()=>({value:cosmetics,ok:true})),
  };
  const resolver=createUserCosmeticsResolver(sources,{maxActive:2});
  const result=await resolver.resolve({id:'123',username:'Me'});
  expect(result).toMatchObject({badges:[
   {provider:'bttv',id:'b'},{provider:'ffz',id:'f'},{provider:'7tv',id:'seven'},
  ],namePaint:paint});
  await resolver.resolve({id:'123',username:'Me'});
  expect(sources.bttv).toHaveBeenCalledTimes(1);
  expect(sources.ffz).toHaveBeenCalledTimes(1);
  expect(sources.sevenTv).toHaveBeenCalledTimes(1);
 });
 it('prefers current 7TV v4 layered paint while retaining v3 as a fallback',async()=>{
  const v4Paint={id:'v4',provider:'7tv',layers:[
   {kind:'solid',color:0xff123456,opacity:1},
  ]} as unknown as NamePaint;
  const sources={
   bttv:vi.fn(async()=>({value:[],ok:true})),
   ffz:vi.fn(async()=>({value:[],ok:true})),
   sevenTv:vi.fn(async()=>({value:cosmetics,ok:true})),
   sevenTvV4Paint:vi.fn(async()=>({value:v4Paint,ok:true})),
  } as unknown as CosmeticSources;
  const resolver=createUserCosmeticsResolver(sources,{maxActive:2});
  expect(await resolver.resolve({id:'123',username:'Painted'}))
   .toMatchObject({namePaint:v4Paint});
  expect(sources.sevenTv).toHaveBeenCalledTimes(1);
  expect(sources.sevenTvV4Paint).toHaveBeenCalledTimes(1);
 });

 it('coalesces lookups, bounds concurrency and does not query 7TV without Twitch user ID',async()=>{
  const callbacks:(()=>void)[]=[];
  const bttv=vi.fn((_user:string)=>new Promise<{value:Badge[];ok:boolean}>(resolve=>
    callbacks.push(()=>resolve({value:[],ok:true}))));
  const sources:CosmeticSources={
    bttv,
    ffz:async()=>({value:[],ok:true}),
    sevenTv:vi.fn(async()=>({value:null,ok:true})),
  };
  const resolver=createUserCosmeticsResolver(sources,{maxActive:1,maxQueued:2});
  const one=resolver.resolve({username:'one'});
  const same=resolver.resolve({username:'one'});
  const two=resolver.resolve({username:'two'});
  const three=resolver.resolve({username:'three'});
  const four=resolver.resolve({username:'four'});
  await Promise.resolve();
  expect(bttv).toHaveBeenCalledTimes(1);
  expect(await four).toBeNull();
  callbacks.shift()?.();
  await one;
  await same;
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(bttv).toHaveBeenCalledTimes(2);
  callbacks.shift()?.();
  await two;
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(bttv).toHaveBeenCalledTimes(3);
  callbacks.shift()?.();
  await three;
  expect(sources.sevenTv).not.toHaveBeenCalled();
 });
 it('degrades cosmetics per provider, retries no more than once per failure cooldown and never throws',async()=>{
  const sources:CosmeticSources={
   bttv:vi.fn(async()=>({value:null,ok:false,error:'offline'})),
   ffz:vi.fn(async()=>({value:[badge('ffz','only')],ok:true})),
   sevenTv:vi.fn(async()=>{throw Error('offline')}),
  };
  const resolver=createUserCosmeticsResolver(sources,{maxActive:2});
  expect(await resolver.resolve({id:'123',username:'User'})).toMatchObject({badges:[{provider:'ffz'}]});
  await resolver.resolve({id:'123',username:'User'});
  expect(sources.bttv).toHaveBeenCalledTimes(1);
  expect(sources.sevenTv).toHaveBeenCalledTimes(1);
 });
});
