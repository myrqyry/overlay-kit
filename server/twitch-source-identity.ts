import {fetchTwitchUserIdentity,type TwitchPublicIdentity} from '@myrqyry/chatbus';

/** Preserve the stream owner's selected color with their public portrait.
 * Never substitute the color from a different chatter in this channel.
 */
export async function loadTwitchSourcePortrait(
 login:string,
 lookup:(login:string)=>Promise<TwitchPublicIdentity|null>=fetchTwitchUserIdentity,
):Promise<{url:string;color?:string}|null>{
 const identity=await lookup(login);
 if(!identity?.avatarUrl)return null;
 return {url:identity.avatarUrl,...(identity.chatColor?{color:identity.chatColor}:{})};
}
