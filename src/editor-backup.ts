import {normalizeOptions,OPTIONS_VERSION,type OverlayEditorView,type OverlayOptions} from './options';

export type EditorSettingsState=Record<OverlayEditorView,OverlayOptions>;
export type EditorPresetRecords=Record<OverlayEditorView,Record<string,OverlayOptions>>;

export interface OverlayKitUserSettingsBackup {
  version:typeof OPTIONS_VERSION;
  kind:'overlay-kit-user-settings';
  activeView:OverlayEditorView;
  settings:EditorSettingsState;
  presets:EditorPresetRecords;
}

const VIEWS=['wall','chat','avatars','events'] as const satisfies readonly OverlayEditorView[];
const isObject=(value:unknown):value is Record<string,unknown> =>
  typeof value==='object'&&value!==null&&!Array.isArray(value);

function normalizePresetRecord(value:unknown):Record<string,OverlayOptions>{
  if(!isObject(value))throw new Error('Expected overlay preset records.');
  const result:Record<string,OverlayOptions>={};
  for(const [name,preset] of Object.entries(value)){
    if(!name.trim()||name.length>40)continue;
    try{result[name]=normalizeOptions(preset);}catch{/* skip invalid saved preset */}
  }
  return result;
}

export function createEditorBackup(
  settings:EditorSettingsState,
  presets:EditorPresetRecords,
  activeView:OverlayEditorView,
):OverlayKitUserSettingsBackup{
  return {
    version:OPTIONS_VERSION,
    kind:'overlay-kit-user-settings',
    activeView,
    settings:{
      wall:normalizeOptions(settings.wall),
      chat:normalizeOptions(settings.chat),
      avatars:normalizeOptions(settings.avatars),
      events:normalizeOptions(settings.events),
    },
    presets:{
      wall:normalizePresetRecord(presets.wall),
      chat:normalizePresetRecord(presets.chat),
      avatars:normalizePresetRecord(presets.avatars),
      events:normalizePresetRecord(presets.events),
    },
  };
}

export function parseEditorBackup(value:unknown):OverlayKitUserSettingsBackup{
  if(!isObject(value)||value.version!==OPTIONS_VERSION||value.kind!=='overlay-kit-user-settings')
    throw new Error('Expected an Overlay Kit all user settings backup.');
  // A pre-extraction backup may have its active workspace set to the now
  // standalone game. Accept its remaining views; do not put the game back.
  const legacyPusherActive=value.activeView==='pusher';
  if((!VIEWS.includes(value.activeView as OverlayEditorView)&&!legacyPusherActive)||
    !isObject(value.settings)||!isObject(value.presets))
    throw new Error('Expected overlay settings in the user settings backup.');
  for(const view of VIEWS){
    if(!isObject(value.settings[view])||!isObject(value.presets[view]))
      throw new Error('Expected overlay settings in the user settings backup.');
  }
  return createEditorBackup(
    {
      wall:normalizeOptions(value.settings.wall),
      chat:normalizeOptions(value.settings.chat),
      avatars:normalizeOptions(value.settings.avatars),
      events:normalizeOptions(value.settings.events),
    },
    {
      wall:normalizePresetRecord(value.presets.wall),
      chat:normalizePresetRecord(value.presets.chat),
      avatars:normalizePresetRecord(value.presets.avatars),
      events:normalizePresetRecord(value.presets.events),
    },
    legacyPusherActive?'wall':value.activeView as OverlayEditorView,
  );
}
