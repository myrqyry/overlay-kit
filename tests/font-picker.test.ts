import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createGoogleFontPicker} from '../demo/font-picker';

const catalog=JSON.parse(readFileSync(resolve('public/google-fonts.json'),'utf8'));
describe('searchable Google Fonts UI',()=>{
 it('loads the bundled real catalog, selects, filters, previews, and clears',async()=>{
  const selected:string[]=[];
  const originalFetch=globalThis.fetch;
  vi.stubGlobal('fetch',vi.fn(async()=>({
    ok:true,json:async()=>catalog,
  })));
  const picker=createGoogleFontPicker(name=>selected.push(name));
  document.body.append(picker.element);
  const input=picker.input;
  try{
   input.value='Space Grotesk';
   input.dispatchEvent(new Event('input',{bubbles:true}));
   await vi.waitFor(()=>expect(picker.element.querySelectorAll('[role=option]')).toHaveLength(1));
   (picker.element.querySelector('[role=option]') as HTMLButtonElement).click();
   expect(selected).toEqual(['Space Grotesk']);
   expect(input.value).toBe('Space Grotesk');
   expect(picker.element.querySelector('.font-specimen')?.getAttribute('style')).toContain('Space Grotesk');
   const category=picker.element.querySelector<HTMLSelectElement>('select[aria-label="Font category"]')!;
   category.value='Handwriting';
   category.dispatchEvent(new Event('change',{bubbles:true}));
   await vi.waitFor(()=>expect(Array.from(picker.element.querySelectorAll('.font-result small'))
      .every(el=>el.textContent==='Handwriting')).toBe(true));
   (picker.element.querySelector<HTMLButtonElement>('button[aria-label="Use system font instead of Google Fonts"]'))!.click();
   expect(selected.at(-1)).toBe('');
   expect(input.value).toBe('');
  }finally{picker.element.remove();vi.stubGlobal('fetch',originalFetch);vi.unstubAllGlobals();}
 });
});
