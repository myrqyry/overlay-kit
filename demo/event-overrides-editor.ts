import {
  ALERT_KINDS, EVENT_ACCENTS, EVENT_ENTRANCES, EVENT_EXITS, EVENT_FAMILIES, EVENT_STYLES,
  parseEventOverrides, serializeEventOverrides,
  type AlertKind, type EventOverride, type EventVisualSettings,
} from '../src/event-overrides';

const TYPE_LABELS: Record<AlertKind,string> = {
  subscription:'Subscription', 'gift-subscription':'Gift subscription', raid:'Raid',
  follow:'Follow', cheer:'Cheer', donation:'Donation', 'reward-redemption':'Reward redemption',
};
const FIELDS: readonly {key:keyof EventVisualSettings;label:string;choices?:readonly string[];min?:number;max?:number;step?:number}[] = [
  {key:'style',label:'Appearance',choices:EVENT_STYLES},
  {key:'accent',label:'Accent',choices:EVENT_ACCENTS},
  {key:'fontFamily',label:'Typeface',choices:EVENT_FAMILIES},
  {key:'motion',label:'Entrance',choices:EVENT_ENTRANCES},
  {key:'motionMs',label:'Entrance duration',min:100,max:1500,step:20},
  {key:'exit',label:'Exit',choices:EVENT_EXITS},
  {key:'exitMs',label:'Exit duration',min:100,max:1500,step:20},
  {key:'fontSize',label:'Text size',min:16,max:80,step:1},
];

/** Compact, dependency-free repeater for presentation-only event overrides. */
export function createEventOverridesEditor(onChange:(serialized:string)=>void){
  const element=document.createElement('div');
  element.className='event-overrides-editor';
  let overrides:EventOverride[]=[];
  const emit=()=>onChange(serializeEventOverrides(overrides));

  const field=(labelText:string,control:HTMLElement)=>{
    const label=document.createElement('label');
    label.className='event-override-field';
    const name=document.createElement('span');
    name.textContent=labelText;
    label.append(name,control);
    return label;
  };
  const select=(choices:readonly string[],value:string|undefined,onPick:(next:string)=>void)=>{
    const control=document.createElement('select');
    const inherit=document.createElement('option');
    inherit.value='';inherit.textContent='Inherit base';
    control.append(inherit);
    for(const choice of choices){
      const option=document.createElement('option');
      option.value=choice;
      option.textContent=choice.replace(/-/g,' ').replace(/^./,s=>s.toUpperCase());
      control.append(option);
    }
    control.value=value??'';
    control.addEventListener('change',()=>onPick(control.value));
    return control;
  };
  const numberInput=(value:number|undefined,min:number,max:number,step:number,onPick:(next:number|undefined)=>void)=>{
    const control=document.createElement('input');
    control.type='number';control.min=String(min);control.max=String(max);control.step=String(step);
    control.placeholder='Base';control.value=value===undefined?'':String(value);
    control.addEventListener('change',()=>{
      const parsed=control.value.trim()===''?undefined:Number(control.value);
      onPick(parsed!==undefined&&Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):undefined);
    });
    return control;
  };

  const render=()=>{
    element.replaceChildren();
    const header=document.createElement('div');
    header.className='event-override-header';
    const summary=document.createElement('span');
    summary.textContent=overrides.length?overrides.length+(overrides.length===1?' rule':' rules'):'Using base settings for every event';
    const add=document.createElement('button');
    add.type='button';add.className='event-override-add';add.textContent='Add override';
    add.addEventListener('click',()=>{
      overrides=[...overrides,{kind:'subscription',settings:{}}];
      emit();render();
    });
    header.append(summary,add);
    element.append(header);
    if(!overrides.length){
      const empty=document.createElement('p');
      empty.className='event-override-empty';
      empty.textContent='Add a rule to change appearance or motion for one event type, or for a specific subscription tier.';
      element.append(empty);
      return;
    }
    overrides.forEach((override,index)=>{
      const card=document.createElement('section');
      card.className='event-override-card';
      const top=document.createElement('div');
      top.className='event-override-top';
      const kind=document.createElement('select');
      kind.setAttribute('aria-label','Event type');
      for(const type of ALERT_KINDS){
        const option=document.createElement('option');
        option.value=type;option.textContent=TYPE_LABELS[type];
        kind.append(option);
      }
      kind.value=override.kind;
      kind.addEventListener('change',()=>{
        overrides=overrides.map((item,i)=>i===index?{...item,kind:kind.value as AlertKind}:item);
        emit();render();
      });
      const tier=document.createElement('input');
      tier.type='text';tier.maxLength=32;tier.placeholder='Any tier';tier.value=override.tier??'';
      tier.setAttribute('aria-label','Tier (optional)');
      tier.addEventListener('change',()=>{
        const value=tier.value.trim();
        overrides=overrides.map((item,i)=>{
          if(i!==index)return item;
          const {tier:_old,...rest}=item;
          return value?{...rest,tier:value}:rest;
        });
        emit();render();
      });
      const remove=document.createElement('button');
      remove.type='button';remove.className='event-override-remove';remove.textContent='Remove';
      remove.setAttribute('aria-label','Remove override');
      remove.addEventListener('click',()=>{overrides=overrides.filter((_,i)=>i!==index);emit();render();});
      top.append(field('Event',kind),field('Tier (optional)',tier),remove);
      card.append(top);
      const grid=document.createElement('div');
      grid.className='event-override-grid';
      for(const definition of FIELDS){
        const current=override.settings[definition.key];
        const update=(next:unknown)=>{
          overrides=overrides.map((item,i)=>{
            if(i!==index)return item;
            const settings={...item.settings};
            if(next===undefined||next==='')delete settings[definition.key];
            else (settings as Record<string,unknown>)[definition.key]=next;
            return {...item,settings};
          });
          emit();render();
        };
        const control=definition.choices
          ? select(definition.choices,current as string|undefined,update)
          : numberInput(current as number|undefined,definition.min!,definition.max!,definition.step!,update);
        grid.append(field(definition.label,control));
      }
      card.append(grid);
      element.append(card);
    });
  };

  render();
  return {
    element,
    setValue(value:string){
      overrides=parseEventOverrides(value);
      render();
    },
    dispose(){element.remove();},
  };
}
