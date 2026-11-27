import {
  loadGoogleFont, normalizeGoogleFontFamily, searchGoogleFonts,
  type GoogleFontFamily,
} from '../src/google-fonts';

interface FontCatalog {source:string;updated:string;fonts:GoogleFontFamily[]}
let catalogPromise:Promise<FontCatalog>|null=null;
function getCatalog():Promise<FontCatalog> {
  if(!catalogPromise)catalogPromise=fetch('/google-fonts.json').then(async res=>{
    if(!res.ok)throw Error('Catalog unavailable (HTTP '+res.status+')');
    const raw:unknown=await res.json();
    if(!raw||typeof raw!=='object'||!('fonts' in raw)||
      !Array.isArray(raw.fonts)||raw.fonts.length<1000)
      throw Error('Font catalog invalid');
    return raw as FontCatalog;
  }).catch(error=>{catalogPromise=null;throw error});
  return catalogPromise;
}

export function createGoogleFontPicker(onSelect:(family:string)=>void) {
  const element=document.createElement('div');
  element.className='font-picker';
  const field=document.createElement('input');
  field.type='search';
  field.id='opt-googleFont';
  field.placeholder='Search all Google Fonts…';
  field.autocomplete='off';
  field.spellcheck=false;
  field.setAttribute('aria-label','Search Google Fonts');
  field.setAttribute('role','combobox');
  field.setAttribute('aria-autocomplete','list');
  field.setAttribute('aria-expanded','false');
  field.setAttribute('aria-controls','font-family-results');
  const category=document.createElement('select');
  category.setAttribute('aria-label','Font category');
  for(const name of ['All categories','Sans Serif','Serif','Display','Handwriting','Monospace']) {
    const option=document.createElement('option');
    option.value=name==='All categories'?'':name;
    option.textContent=name;
    category.append(option);
  }
  const filterRow=document.createElement('div');
  filterRow.className='font-filter-row';
  filterRow.append(field,category);
  const list=document.createElement('div');
  list.className='font-results';
  list.id='font-family-results';
  list.setAttribute('role','listbox');
  list.setAttribute('aria-label','Google Fonts matching families');
  list.hidden=true;
  const info=document.createElement('div');
  info.className='font-picker-info';
  info.setAttribute('role','status');
  const chosen=document.createElement('div');
  chosen.className='font-picker-chosen';
  const selectedName=document.createElement('span');
  selectedName.textContent='System font';
  const clear=document.createElement('button');
  clear.type='button';
  clear.textContent='Use system';
  clear.setAttribute('aria-label','Use system font instead of Google Fonts');
  const specimen=document.createElement('div');
  specimen.className='font-specimen';
  specimen.textContent='The quick brown fox 0123456789';
  chosen.append(selectedName,clear);
  element.append(filterRow,list,info,chosen,specimen);
  let data:FontCatalog|null=null;
  let current='';
  let active=false;
  const close=()=>{active=false;list.hidden=true;field.setAttribute('aria-expanded','false')};
  const setValue=(value:string)=>{
    current=normalizeGoogleFontFamily(value);
    field.value=current;
    selectedName.textContent=current || 'System font';
    clear.hidden=!current;
    const valid=loadGoogleFont(current);
    specimen.style.fontFamily=valid ? JSON.stringify(current)+',sans-serif' : 'system-ui,sans-serif';
    info.textContent=data ? data.fonts.length.toLocaleString()+' fonts in catalog' : 'Search Google Fonts';
    close();
  };
  const choose=(name:string)=>{setValue(name);onSelect(current)};
  function render() {
    if(!data)return;
    list.replaceChildren();
    const matches=searchGoogleFonts(data.fonts,field.value,category.value,35);
    if(!matches.length) {
      const empty=document.createElement('p');
      empty.textContent='No matching fonts';
      list.append(empty);
    } else for(const font of matches) {
      const row=document.createElement('button');
      row.type='button';
      row.setAttribute('role','option');
      row.setAttribute('aria-selected',String(font.family===current));
      row.className='font-result';
      const name=document.createElement('span');
      name.textContent=font.family;
      const familyCategory=document.createElement('small');
      familyCategory.textContent=font.category;
      row.append(name,familyCategory);
      row.addEventListener('click',()=>choose(font.family));
      list.append(row);
    }
    list.hidden=false;
    active=true;
    field.setAttribute('aria-expanded','true');
    info.textContent=matches.length+' matching fonts shown (of '+data.fonts.length.toLocaleString()+')';
  }
  async function open() {
    if(!data) {
      info.textContent='Loading Google Fonts catalog…';
      try {data=await getCatalog();}
      catch(error) {
        info.textContent=error instanceof Error?error.message:'Font catalog unavailable';
        return;
      }
    }
    render();
  }
  field.addEventListener('focus',()=>void open());
  field.addEventListener('input',()=>void open());
  category.addEventListener('change',()=>void open());
  field.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();field.value=current;return;}
    if(event.key==='ArrowDown' && active){
      event.preventDefault();
      list.querySelector<HTMLButtonElement>('button')?.focus();
    }
    if(event.key==='Enter' && data) {
      event.preventDefault();
      const exact=data.fonts.find(font=>font.family.toLowerCase()===field.value.trim().toLowerCase());
      if(exact)choose(exact.family);
      else list.querySelector<HTMLButtonElement>('button')?.click();
    }
  });
  list.addEventListener('keydown',event=>{
    const target=event.target;
    if(!(target instanceof HTMLButtonElement))return;
    if(event.key==='Escape'){close();field.focus();return;}
    if(event.key==='ArrowUp'||event.key==='ArrowDown') {
      event.preventDefault();
      const buttons=Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
      const index=buttons.indexOf(target);
      if(event.key==='ArrowDown')buttons[Math.min(index+1,buttons.length-1)]?.focus();
      else if(index<=0)field.focus();
      else buttons[index-1]?.focus();
    }
  });
  clear.addEventListener('click',()=>choose(''));
  const onPointerDown=(event:PointerEvent)=>{
    if(!element.contains(event.target as Node))close();
  };
  document.addEventListener('pointerdown',onPointerDown);
  setValue('');
  return {
    element,input:field,setValue,
    dispose:()=>document.removeEventListener('pointerdown',onPointerDown),
  };
}
