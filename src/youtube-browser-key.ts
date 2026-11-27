/** This is a browser-visible, website-restricted API identifier, NOT a
 * confidential OAuth secret. Persist only on explicit user action. */
export const YOUTUBE_KEY_STORAGE='myrqyry-overlay-kit-youtube-restricted-key-v1';
const CHANGE='overlay-kit-youtube-key-changed';
export function normalizeBrowserYouTubeApiKey(value:unknown):string|undefined{
 const key=typeof value==='string'?value.trim():'';
 return /^AIza[A-Za-z0-9_-]{30,100}$/.test(key)?key:undefined;
}
export function readBrowserYouTubeApiKey():string|undefined{
 try{return normalizeBrowserYouTubeApiKey(localStorage.getItem(YOUTUBE_KEY_STORAGE));}catch{return;}
}
export function saveBrowserYouTubeApiKey(value:string):void{
 const key=normalizeBrowserYouTubeApiKey(value);
 if(!key)throw Error('Enter a valid Google API key (starts with AIza).');
 localStorage.setItem(YOUTUBE_KEY_STORAGE,key);
 window.dispatchEvent(new Event(CHANGE));
}
export function forgetBrowserYouTubeApiKey():void{
 localStorage.removeItem(YOUTUBE_KEY_STORAGE);
 window.dispatchEvent(new Event(CHANGE));
}
export function watchBrowserYouTubeKey(callback:()=>void):()=>void{
 const storage=(event:StorageEvent)=>{if(event.key===YOUTUBE_KEY_STORAGE||event.key===null)callback();};
 window.addEventListener(CHANGE,callback);window.addEventListener('storage',storage);
 return ()=>{window.removeEventListener(CHANGE,callback);window.removeEventListener('storage',storage);};
}
