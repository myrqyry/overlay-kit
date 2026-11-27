import type {OverlayLiveEvent} from './live';

const MAX_IGNORED_USERS=64;
const MAX_SERIALIZED_LENGTH=1024;
const HANDLE=/^[a-z0-9_.-]{1,64}$/;

const normalizeHandle=(value:string):string=>{
  const handle=value.trim().replace(/^@+/,'').toLowerCase();
  return HANDLE.test(handle)?handle:'';
};

/** Canonical, bounded comma-separated user handles for URLs/presets. */
export function normalizeIgnoredUsers(value:unknown):string {
  if(typeof value!=='string')return '';
  const seen=new Set<string>();
  const accepted:string[]=[];
  let serializedLength=0;
  for(const raw of value.split(/[,;\n\r]+/)){
    const handle=normalizeHandle(raw);
    if(!handle||seen.has(handle))continue;
    const nextLength=serializedLength+(accepted.length?1:0)+handle.length;
    if(nextLength>MAX_SERIALIZED_LENGTH||accepted.length>=MAX_IGNORED_USERS)break;
    seen.add(handle);
    accepted.push(handle);
    serializedLength=nextLength;
  }
  return accepted.join(',');
}

export function createUserAdmissionFilter(value:unknown) {
  const ignored=new Set(normalizeIgnoredUsers(value).split(',').filter(Boolean));
  return {
    accept(event:OverlayLiveEvent):boolean {
      if(event.type!=='message')return true;
      const identity=normalizeHandle(event.message.user.username??event.message.user.name);
      return !identity||!ignored.has(identity);
    },
    ignored:()=>new Set(ignored),
  };
}
