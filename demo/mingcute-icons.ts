import {renderIconBody,type IconDefinition} from '@mingcute/icons';
import {
  BadgeIcon,BellRingingIcon,Chat3Icon,Copy2Icon,DashboardIcon,Delete2Icon,Emoji2Icon,ExternalLinkIcon,
  EyeIcon,FileExportIcon,FileImportIcon,FolderOpenIcon,FontIcon,GiftIcon,GridIcon,Group3Icon,
  LayoutIcon,LinkIcon,LiveIcon,Magic1Icon,MoveIcon,PaletteIcon,ProfileIcon,RefreshAnticlockwise1Icon,RestoreIcon,
  SaveIcon,SearchIcon,Settings3Icon,ShieldIcon,SignalIcon,Sparkles2Icon,StarIcon,TextIcon,
  UnlinkIcon,User1Icon,
} from '@mingcute/icons/core-regular';

const ICONS={
  save:SaveIcon,
  load:FolderOpenIcon,
  delete:Delete2Icon,
  restore:RestoreIcon,
  reset:RefreshAnticlockwise1Icon,
  copy:Copy2Icon,
  import:FileImportIcon,
  export:FileExportIcon,
  compare:GridIcon,
  external:ExternalLinkIcon,
  settings:Settings3Icon,
  link:LinkIcon,
  unlink:UnlinkIcon,
  emoji:Emoji2Icon,
  chat:Chat3Icon,
  group:Group3Icon,
  sparkles:Sparkles2Icon,
  badge:BadgeIcon,
  bell:BellRingingIcon,
  dashboard:DashboardIcon,
  eye:EyeIcon,
  font:FontIcon,
  gift:GiftIcon,
  layout:LayoutIcon,
  live:LiveIcon,
  magic:Magic1Icon,
  move:MoveIcon,
  palette:PaletteIcon,
  profile:ProfileIcon,
  search:SearchIcon,
  shield:ShieldIcon,
  signal:SignalIcon,
  star:StarIcon,
  text:TextIcon,
  user:User1Icon,
} satisfies Record<string,IconDefinition>;

export type EditorIconName=keyof typeof ICONS;

// Two independent passes hydrate static chrome and generated inspector slots.
// Keep resource IDs unique between passes for icons using embedded SVG defs.
let iconSeed=0;

export function hydrateMingcuteIcons(root:ParentNode=document):void{
  const slots=root.querySelectorAll<HTMLElement>('[data-mingcute]');
  for(const slot of Array.from(slots)){
    const name=slot.dataset.mingcute as EditorIconName;
    const definition=ICONS[name];
    if(!definition)continue;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',definition.viewBox);
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    svg.classList.add('mingcute-icon');
    svg.innerHTML=renderIconBody(definition,'overlay-kit-'+name+'-'+iconSeed++);
    slot.replaceChildren(svg);
  }
}
