/** Shared trusted-local style registry for independently styled overlay views.
 * It never fetches code, accepts remote CSS, or mutates scene ownership.
 */
export interface LocalStylePack {
  readonly id:string;
  readonly name:string;
  readonly description:string;
  readonly mount?:(root:HTMLElement)=>void|(()=>void);
}
const validId=/^[a-z][a-z0-9-]{0,39}$/;

export function createLocalStyleRegistry<T extends LocalStylePack>(
  dataKey:'chatStyle'|'wallStyle',builtins:readonly T[],
) {
  const custom=new Map<string,T>();
  const read=(id:string):T|undefined=>validId.test(id)
    ? builtins.find(item=>item.id===id)??custom.get(id)
    : undefined;
  return {
    list:():readonly T[]=>[...builtins,...custom.values()],
    get:read,
    register(pack:T):()=>void {
      if(!validId.test(pack.id))throw new Error('Invalid style pack ID');
      if(!pack.name.trim()||!pack.description.trim())
        throw new Error('Style packs need names and descriptions');
      if(read(pack.id))throw new Error('Duplicate style pack ID: '+pack.id);
      const stored=Object.freeze({...pack}) as T;
      custom.set(pack.id,stored);
      return ()=>{if(custom.get(pack.id)===stored)custom.delete(pack.id);};
    },
    apply(root:HTMLElement,id:string):{dispose():void} {
      const pack=read(id)??builtins[0];
      if(!pack)throw new Error('No default style pack');
      root.dataset[dataKey]=pack.id;
      let released=false;
      let cleanup:void|(()=>void);
      try {cleanup=pack.mount?.(root);}
      catch(error) {delete root.dataset[dataKey];throw error;}
      return {dispose(){
        if(released)return;
        released=true;
        try{cleanup?.();}finally{
          if(root.dataset[dataKey]===pack.id)delete root.dataset[dataKey];
        }
      }};
    },
  };
}
