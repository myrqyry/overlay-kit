import type {KickRoleArtwork} from '../src/renderers';
// Only explicit local PNGs enter a user's own build. A clean checkout has none.
// no-inline keeps the optional files separate from application JS.
const assets=import.meta.glob<string>('./local-art/kick/{moderator,verified,gift-1,gift-25}.png',{eager:true,query:'?url&no-inline',import:'default'});
export const localKickArtwork:KickRoleArtwork={};
for(const role of ['moderator','verified','gift-1','gift-25'] as const){
 const asset=assets['./local-art/kick/'+role+'.png'];
 if(asset)localKickArtwork[role]=asset;
}
