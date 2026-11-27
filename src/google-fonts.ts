/** Google Fonts CSS2 font-loader and catalog helpers. Family names are data,
 * never raw CSS/URLs. Catalog is checked into public/ for offline browsing. */
export interface GoogleFontFamily {family:string;category:string}
const SAFE_FAMILY=/^[A-Za-z0-9][A-Za-z0-9 &'()+.,!_-]{0,99}$/;
export function normalizeGoogleFontFamily(input:unknown):string {
  return typeof input==='string' && SAFE_FAMILY.test(input.trim()) ? input.trim() : '';
}
export function googleFontCssUrl(input:unknown):string|null {
  const family=normalizeGoogleFontFamily(input);
  if(!family)return null;
  const params=new URLSearchParams({family,display:'swap'});
  return 'https://fonts.googleapis.com/css2?'+params.toString();
}
/** Excludes fonts that don't match the typed name rather than suggesting a
 * vaguely similar-but-different substitute. Original snapshot order is popular-first. */
export function searchGoogleFonts(
  fonts:readonly GoogleFontFamily[],term:string,category?:string,limit=40,
):GoogleFontFamily[] {
  const q=term.trim().toLowerCase();
  const list=fonts.filter(item=>(!category || item.category===category) &&
    item.family.toLowerCase().includes(q));
  if(q)list.sort((a,b)=>{
    const ap=a.family.toLowerCase().startsWith(q) ? 0 : 1;
    const bp=b.family.toLowerCase().startsWith(q) ? 0 : 1;
    return ap-bp;
  });
  return list.slice(0,Math.max(0,Math.min(100,limit)));
}
/** A single stylesheet per source document; swapping choices replaces it. */
export function loadGoogleFont(familyName:string,doc:Document=document):boolean {
  const url=googleFontCssUrl(familyName);
  const previous=doc.querySelector<HTMLLinkElement>('link[data-google-font-sheet]');
  if(!url) {previous?.remove();return false;}
  const localUrl=new URL('/api/fonts/css?family='+encodeURIComponent(normalizeGoogleFontFamily(familyName)),doc.baseURI).href;
  if(previous?.href===localUrl || previous?.href===url)return true;
  const sheet=doc.createElement('link');
  sheet.rel='stylesheet';
  sheet.dataset.googleFontSheet='true';
  // OBS/Chromium can have no direct external network even when the host
  // can fetch fonts. The local Chatbus relay supplies a bounded CSS/font
  // proxy; Vite-only preview falls back to Google's normal CSS endpoint.
  sheet.href=import.meta.env.VITE_OVERLAY_BROWSER_ONLY==='1'?url:'/api/fonts/css?family='+encodeURIComponent(normalizeGoogleFontFamily(familyName));
  sheet.onerror=()=>{if(sheet.href!==url)sheet.href=url};
  if(previous)previous.replaceWith(sheet);
  else doc.head.append(sheet);
  return true;
}
