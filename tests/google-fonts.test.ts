import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {googleFontCssUrl, loadGoogleFont, normalizeGoogleFontFamily, searchGoogleFonts} from '../src/google-fonts';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor} from '../src/options';
import {createChatMessageElement} from '../src/renderers';

const catalog=JSON.parse(readFileSync(resolve('public/google-fonts.json'),'utf8')) as {
  source:string;fonts:{family:string;category:string}[];
};
describe('actual Google Fonts catalog',()=>{
 it('contains all currently snapshotted catalog families with no duplicates',()=>{
   expect(catalog.fonts.length).toBeGreaterThan(1800);
   expect(new Set(catalog.fonts.map(f=>f.family)).size).toBe(catalog.fonts.length);
   expect(catalog.fonts.some(f=>f.family==='Roboto')).toBe(true);
   expect(catalog.fonts.some(f=>f.family==='Noto Sans Egyptian Hieroglyphs')).toBe(true);
   expect(catalog.source).toBe('https://fonts.google.com/metadata/fonts');
 });
 it('searches real names, exposes category filtering, caps results and prefers starts-with',()=>{
   expect(searchGoogleFonts(catalog.fonts,'noto sans',undefined,25).length).toBe(25);
   expect(searchGoogleFonts(catalog.fonts,'roboto').at(0)?.family).toBe('Roboto');
   expect(searchGoogleFonts(catalog.fonts,'handwriting','Handwriting',50).every(f=>f.category==='Handwriting')).toBe(true);
   expect(searchGoogleFonts(catalog.fonts,'qwertynothere')).toEqual([]);
 });
 it('accepts only safe family names and encodes Google CSS2 URLs',()=>{
   expect(normalizeGoogleFontFamily('   Noto Sans JP ')).toBe('Noto Sans JP');
   expect(normalizeGoogleFontFamily('";color:red;')).toBe('');
   expect(normalizeGoogleFontFamily('javascript:alert(1)')).toBe('');
   expect(googleFontCssUrl('Noto Sans JP')).toBe('https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap');
   expect(googleFontCssUrl('bad;"evil')).toBeNull();
 });
 it('loads only selected stylesheet and keeps safe fallback for network failure',()=>{
   expect(loadGoogleFont('Noto Sans JP',document)).toBe(true);
   const link=document.querySelector<HTMLLinkElement>('link[data-google-font-sheet]')!;
   expect(link.href).toContain('family=Noto%20Sans%20JP');
   expect(loadGoogleFont('Noto Sans JP',document)).toBe(true);
   expect(document.querySelectorAll('link[data-google-font-sheet]')).toHaveLength(1);
   expect(loadGoogleFont('',document)).toBe(false);
   expect(document.querySelector('link[data-google-font-sheet]')).toBeNull();
 });
 it('persists the font in query URLs and presets while old presets still normalize',()=>{
   const settings=normalizeOptions({...DEFAULT_OPTIONS,googleFont:'Space Grotesk'});
   const query=writeOptions(settings);
   expect(query).toContain('gfont=Space+Grotesk');
   expect(readOptions('?'+query)).toEqual(settings);
   expect(normalizeOptions({version:1,settings:{font:32}}).googleFont).toBe('');
   expect(normalizeOptions({googleFont:'<svg onload=alert(1)>'}).googleFont).toBe('');
   expect(optionsForEditor('chat',false).map(x=>x.key)).toContain('googleFont');
   expect(optionsForEditor('wall',true).map(x=>x.key)).not.toContain('googleFont');
 });
 it('renders selected typeface into chat CSS and does not alter emote wall',()=>{
   const row=createChatMessageElement({id:'m',timestamp:1,user:{name:'Hello',badges:[]},
      parts:[{type:'text',text:'A little bit of typography'}]},
      {googleFont:'Playfair Display',fontFamily:'serif'});
   expect(row.style.fontFamily).toContain('"Playfair Display"');
   expect(row.style.fontFamily).toContain('Georgia');
   expect(document.querySelector<HTMLLinkElement>('link[data-google-font-sheet]')?.href).toContain('Playfair%20Display');
 });
});
