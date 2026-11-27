/** A badge's source images are ordered by providers for transport purposes,
 * not by render quality. Prefer the highest resolution actually advertised.
 * Never guess missing CDN paths or substitute unrelated badge versions.
 */
export interface BadgeImageCandidate {
  url:string;
  scale?:number;
  width?:number;
}
export function bestBadgeImageUrl(images:readonly BadgeImageCandidate[]|undefined):string|undefined {
  let best:string|undefined;
  let largest=-1;
  for(const image of images??[]){
    if(typeof image.url!=='string'||!image.url)continue;
    const density=Number.isFinite(image.scale)&&image.scale!>0
      ? image.scale!*18
      : Number.isFinite(image.width)&&image.width!>0?image.width!:0;
    if(best===undefined||density>largest){best=image.url;largest=density;}
  }
  return best;
}
