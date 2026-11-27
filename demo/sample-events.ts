import type {SocialSignalV1} from '@myrqyry/chatbus';

/** Explicit synthetic preview data, never a live subscription or follow lookup. */
export function sampleSocialSignal(index:number):SocialSignalV1 {
  const types=['subscription','raid','follow','gift-subscription','cheer'] as const;
  const names=['Mossy','OrbitFox','CloudCat','PenPlotter','PixelSprout'];
  const type=types[index%types.length]!;
  const username=names[index%names.length]!;
  return {
    schemaVersion:1,producer:'chatbus',
    source:{platform:'twitch',channelName:'preview',origin:'test'},
    event:{type,id:'sample-event-'+index,occurredAtMs:Date.now(),receivedAtMs:Date.now()},
    actor:{platform:'twitch',username:username.toLowerCase(),displayName:username},
    ...(type==='raid'?{measurements:{count:42}}
      :type==='gift-subscription'?{measurements:{count:3}}
      :type==='cheer'?{measurements:{bits:150}}:{}),
  };
}
