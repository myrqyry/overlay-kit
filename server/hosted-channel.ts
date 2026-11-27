import {normalizeLiveChannel,normalizeLivePlatform,type LivePlatform} from '../src/live-platform';

/** Backward-compatible default room. Individual browser sources can choose
 * Twitch, Kick, YouTube or TikTok explicitly in their own WebSocket URL. */
export function hostedChannel():string {
  return process.env.OVERLAY_TWITCH_CHANNEL??'xqc';
}
/** TikTok is available by default; hosts can explicitly disable it. */
export function hostedPlatforms():LivePlatform[] {
  return process.env.OVERLAY_HOSTED_TIKTOK==='0'
    ? ['twitch','kick','youtube'] : ['twitch','kick','youtube','tiktok'];
}
export function hostedPlatform():LivePlatform {
  const platform=normalizeLivePlatform(process.env.OVERLAY_CHAT_PLATFORM)??'twitch';
  return hostedPlatforms().includes(platform)?platform:'twitch';
}

export function normalizeHostedPlatform(value:unknown):LivePlatform|null {
  return normalizeLivePlatform(value);
}
export function normalizeHostedChannel(value:unknown,platform:LivePlatform='twitch'):string|null {
  return normalizeLiveChannel(value,platform);
}
