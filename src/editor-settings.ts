import {
  DEFAULT_OPTIONS, OPTION_DEFINITIONS, normalizeOptions, readOptions,
  type OverlayOptions, type OverlayEditorView,
} from './options';

export interface RestoredEditorSettings {
  settings: OverlayOptions;
  importedFromUrl: boolean;
  remainingSearch: string;
}

/** Original v1 single-workspace restore contract, retained for existing consumers. */
export function restoreEditorSettings(saved: unknown, search: string): RestoredEditorSettings {
  let settings: OverlayOptions;
  try { settings = normalizeOptions(saved); }
  catch { settings = normalizeOptions(DEFAULT_OPTIONS); }
  const params = new URLSearchParams(search);
  const keys = OPTION_DEFINITIONS.filter(def => params.has(def.query)).map(def => def.query);
  // Treat retired Horizontal Strip links as chat-setting imports, rather
  // than silently ignoring their requested single-line presentation.
  if(params.get('rows')==='single'||params.get('rows')==='double')keys.push('rows');
  if (!keys.length) return {settings, importedFromUrl:false,remainingSearch:params.toString()};
  settings = readOptions(search);
  for (const key of keys) params.delete(key);
  return {settings, importedFromUrl:true, remainingSearch:params.toString()};
}

function rawSettings(input:unknown):Record<string,unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string,unknown>;
  if (record.settings && typeof record.settings === 'object'
      && !Array.isArray(record.settings)) return record.settings as Record<string,unknown>;
  return record;
}

/** Carry historical shared capacity into the independent wall fields. */
export function migrateLegacyWall(input:unknown):OverlayOptions {
  const raw=rawSettings(input);
  return normalizeOptions({...raw,
    wallMax:raw.max ?? raw.wallMax ?? DEFAULT_OPTIONS.wallMax,
    wallTtl:raw.ttl ?? raw.wallTtl ?? DEFAULT_OPTIONS.wallTtl,
    wallSize:raw.size ?? raw.wallSize ?? DEFAULT_OPTIONS.wallSize,
  });
}

interface SeparateSettings {
  chat: OverlayOptions;
  wall: OverlayOptions;
  avatars: OverlayOptions;
  events: OverlayOptions;
  importedFromUrl:boolean;
  importedView?:OverlayEditorView;
  remainingSearch:string;
}

/** Both views are persisted independently. Read legacy storage without rewriting it.
 * Explicit option URLs update only the selected/identified view, once.
 */
export function restoreSeparateSettings(
  legacy:unknown, separate:unknown, search:string, selected:OverlayEditorView='chat',
):SeparateSettings {
  const record=separate && typeof separate==='object' && !Array.isArray(separate)
    ? separate as Record<string,unknown> : {};
  const legacyValid=legacy && typeof legacy==='object' && !Array.isArray(legacy)
    && (legacy as Record<string,unknown>).version === 1;
  const chat=normalizeOptions(record.chat ?? (legacyValid ? legacy : DEFAULT_OPTIONS));
  const wall=record.wall != null ? normalizeOptions(record.wall)
    : legacyValid ? migrateLegacyWall(legacy) : normalizeOptions(DEFAULT_OPTIONS);
  const avatars=normalizeOptions(record.avatars ?? DEFAULT_OPTIONS);
  const events=normalizeOptions(record.events ?? DEFAULT_OPTIONS);
  const params=new URLSearchParams(search);
  const known=OPTION_DEFINITIONS.filter(def=>params.has(def.query));
  const legacyRows=params.get('rows')==='single'||params.get('rows')==='double';
  const hasChat=known.some(def=>def.section.startsWith('Chat •'))||legacyRows;
  const hasWall=known.some(def=>def.section.startsWith('Wall •'));
  const hasAvatars=known.some(def=>def.section.startsWith('Avatars •'));
  const hasEvents=known.some(def=>def.section.startsWith('Events •'));
  if (!known.length&&!legacyRows) return {chat,wall,avatars,events,importedFromUrl:false,remainingSearch:params.toString()};
  // A historic combined URL may contain values for both overlays. Import
  // both rather than allowing one view to silently erase the other's keys.
  if (hasChat) Object.assign(chat,readOptions(search,'chat'));
  if (hasWall) Object.assign(wall,readOptions(search,'wall'));
  if (hasAvatars) Object.assign(avatars,readOptions(search,'avatars'));
  if (hasEvents) Object.assign(events,readOptions(search,'events'));
  for(const def of known) params.delete(def.query);
  if(legacyRows)params.delete('rows');
  const count=[hasChat,hasWall,hasAvatars,hasEvents].filter(Boolean).length;
  const importedView:OverlayEditorView = count===1
    ? hasChat?'chat':hasWall?'wall':hasAvatars?'avatars':'events'
    : selected;
  return {chat,wall,avatars,events,importedFromUrl:true,importedView,remainingSearch:params.toString()};
}
