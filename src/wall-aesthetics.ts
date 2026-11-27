/**
 * Orthogonal wall aesthetic axes. Each modifies presentation only; materials,
 * motion, lifecycle and source emote imagery remain independent.
 */
export const WALL_COLOR_CHOICES = [
  {value:'original',label:'Original color'},
  {value:'soft',label:'Soft / faded'},
  {value:'vivid',label:'Vivid'},
  {value:'monochrome',label:'Monochrome'},
  {value:'warm',label:'Warm pigment'},
] as const;
export const WALL_FINISH_CHOICES = [
  {value:'none',label:'No edge finish'},
  {value:'halo',label:'Soft halo'},
  {value:'relief',label:'Embossed relief'},
] as const;
export type WallColor = (typeof WALL_COLOR_CHOICES)[number]['value'];
export type WallFinish = (typeof WALL_FINISH_CHOICES)[number]['value'];
export function normalizeWallColor(value:unknown):WallColor {
  return WALL_COLOR_CHOICES.find(option=>option.value===value)?.value??'original';
}
export function normalizeWallFinish(value:unknown):WallFinish {
  return WALL_FINISH_CHOICES.find(option=>option.value===value)?.value??'none';
}
/** Only modifies its two attributes and restores nothing outside its scope. */
export function applyWallAesthetics(root:HTMLElement,color:WallColor,finish:WallFinish) {
  const selectedColor=normalizeWallColor(color);
  const selectedFinish=normalizeWallFinish(finish);
  root.dataset.wallColor=selectedColor;
  root.dataset.wallFinish=selectedFinish;
  let disposed=false;
  return {dispose(){
    if(disposed)return;
    disposed=true;
    if(root.dataset.wallColor===selectedColor)delete root.dataset.wallColor;
    if(root.dataset.wallFinish===selectedFinish)delete root.dataset.wallFinish;
  }};
}
