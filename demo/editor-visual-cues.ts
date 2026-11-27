/** Small, deterministic visual vocabulary for the existing editor manifest. */
import type {OptionSection,OverlayOptions} from '../src/options';
import type {EditorIconName} from './mingcute-icons';

export type CueTone='mint'|'blue'|'gold'|'rose'|'violet'|'cyan';
export interface EditorCue {icon:EditorIconName;tone:CueTone}

const SECTIONS={
 'Chat • Capacity':{icon:'dashboard',tone:'mint'},
 'Chat • Artwork':{icon:'emoji',tone:'rose'},
 'Chat • Content':{icon:'text',tone:'mint'},
 'Chat • Badges':{icon:'badge',tone:'gold'},
 'Chat • Typography':{icon:'font',tone:'violet'},
 'Chat • Layout':{icon:'layout',tone:'cyan'},
 'Chat • Styling':{icon:'palette',tone:'rose'},
 'Chat • Animations':{icon:'magic',tone:'blue'},
 'Chat • Triggers':{icon:'bell',tone:'violet'},
 'Wall • Capacity':{icon:'dashboard',tone:'mint'},
 'Wall • Artwork':{icon:'emoji',tone:'rose'},
 'Wall • Content':{icon:'text',tone:'mint'},
 'Wall • Movement':{icon:'move',tone:'blue'},
 'Wall • Placement':{icon:'layout',tone:'cyan'},
 'Wall • Triggers':{icon:'bell',tone:'violet'},
 'Avatars • Population':{icon:'group',tone:'mint'},
 'Avatars • Content':{icon:'eye',tone:'blue'},
 'Avatars • Behavior':{icon:'sparkles',tone:'rose'},
 'Events • Presentation':{icon:'live',tone:'violet'},
 'Events • Triggers':{icon:'bell',tone:'gold'},
} satisfies Record<OptionSection,EditorCue>;

const OPTIONS={
 showBadges:{icon:'eye',tone:'mint'},
 showPlatformBadges:{icon:'live',tone:'cyan'},
 showSourceBadges:{icon:'profile',tone:'mint'},
 showViewerBadges:{icon:'user',tone:'blue'},
 showRoleBadges:{icon:'shield',tone:'gold'},
 showSubscriberBadges:{icon:'star',tone:'gold'},
 showGifterBadges:{icon:'gift',tone:'rose'},
 showCosmeticBadges:{icon:'sparkles',tone:'violet'},
} satisfies Partial<Record<keyof OverlayOptions,EditorCue>>;

export const sectionCue=(section:OptionSection):EditorCue=>SECTIONS[section];
export const optionCue=(key:keyof OverlayOptions):EditorCue|undefined=>
  OPTIONS[key as keyof typeof OPTIONS];
