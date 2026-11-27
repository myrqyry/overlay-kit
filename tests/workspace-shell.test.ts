import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const markup = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
function shell() {
  return new DOMParser().parseFromString(markup, 'text/html');
}

describe('desktop-style overlay workspace shell', () => {
  it('places accessible overlay tabs in the main chrome, not inside settings', () => {
    const doc = shell();
    const tablist = doc.querySelector('header.app-chrome [role=tablist][aria-label="Overlay workspaces"]');
    expect(tablist).not.toBeNull();
    expect(Array.from(tablist!.querySelectorAll('[role=tab]')).map(element => element.id))
      .toEqual(['edit-wall', 'edit-chat', 'edit-avatars', 'edit-events']);
    expect(Array.from(tablist!.querySelectorAll<HTMLElement>('.tab-indicator')).map(element => element.dataset.mingcute))
      .toEqual(['emoji','chat','group','sparkles']);
    expect(Array.from(tablist!.querySelectorAll<HTMLElement>('.workspace-tab')).map(element => element.dataset.view))
      .toEqual(['wall','chat','avatars','events']);
    expect(doc.querySelector('.panel [role=tab]')).toBeNull();
    expect(doc.querySelector('main[role=tabpanel]')?.getAttribute('aria-labelledby')).toBe('edit-wall');
    expect(doc.querySelector('.editor-switcher')).toBeNull();
    expect(doc.querySelector('header.app-chrome .live-session #live-platform')).not.toBeNull();
    expect(Array.from(doc.querySelectorAll('header.app-chrome .live-session #live-platform option')).map(x=>x.getAttribute('value')))
      .toEqual(['twitch','kick','youtube','tiktok']);
    expect(doc.querySelector('header.app-chrome .live-session #live-channel')).not.toBeNull();
    const field=doc.querySelector('.live-session .live-source-field')!;
    expect(field.querySelector('#live-platform[hidden]')).not.toBeNull();
    expect(field.querySelector('#live-platform-trigger[aria-haspopup="menu"][aria-controls="live-platform-menu"]')).not.toBeNull();
    expect(field.querySelector('#live-channel[placeholder="Twitch username"]')).not.toBeNull();
    expect(field.querySelector('#live-toggle')).not.toBeNull();
    expect(field.querySelector('#live-platform-menu[role="menu"][hidden]')).not.toBeNull();
    expect(doc.querySelector('header.app-chrome .live-session #live-toggle[aria-label]')).not.toBeNull();
    expect(doc.querySelector('header.app-chrome .live-session #live-connect')).toBeNull();
    expect(doc.querySelector('header.app-chrome .live-session #live-disconnect')).toBeNull();
    expect(doc.querySelectorAll('header.app-chrome .live-session .live-status-dot')).toHaveLength(0);
    expect(doc.querySelector('#live-source-menu[role=menu][hidden]')).not.toBeNull();
    expect(doc.querySelector('header.app-chrome .live-session #live-sources[aria-label="Connected chat sources"]')).not.toBeNull();
    expect(doc.querySelector('.panel .live-tools')).toBeNull();
    expect(doc.querySelector('.live-session #live-account')).toBeNull();
    expect(doc.querySelector('.chrome-tools #open-accounts[aria-haspopup=dialog]')).not.toBeNull();
    expect(doc.querySelector('dialog#accounts-dialog[aria-labelledby=accounts-title]')).not.toBeNull();
  });

  it('keeps four independent previews, one-focused default, comparison and editor actions', () => {
    const doc = shell();
    expect(doc.querySelectorAll('.preview-grid .preview-card')).toHaveLength(4);
    expect(doc.querySelectorAll('.preview-grid iframe')).toHaveLength(4);
    expect(doc.querySelector('.preview-grid')?.getAttribute('data-compare')).toBe('false');
    expect(doc.querySelector('.preview-grid')?.getAttribute('data-focus')).toBe('wall');
    expect(doc.querySelector('#compare-previews')?.getAttribute('aria-pressed')).toBe('false');
    expect(doc.querySelector('#active-source')).toBeNull();
    expect(doc.querySelector('main > .preview-grid')).not.toBeNull();
    expect(doc.querySelector('main .stage-toolbar, main .stage-footer')).toBeNull();
    expect(doc.querySelector('header .source-copy-chips')).toBeNull();
    expect(doc.querySelector('#workspace-tab-actions[hidden]')).not.toBeNull();
    for(const view of ['wall','chat','avatars','events']){
      const actions=doc.querySelector('#workspace-tab-actions [data-view='+view+']')!;
      expect(actions.querySelector('#'+view+'-url [data-mingcute=copy]')).not.toBeNull();
      expect(actions.querySelector('#enable-'+view+'[role=switch]')).not.toBeNull();
    }
    expect(doc.querySelector('.stage-heading')).toBeNull();
    expect(doc.querySelector('.stage-toolbar .preview-status-chip')).toBeNull();
    expect(doc.querySelector('header #compare-previews.icon-button[aria-label="Compare previews"] [data-mingcute="compare"]')).not.toBeNull();
    expect(doc.querySelectorAll('.preview-card .preview-head')).toHaveLength(0);
    expect(doc.querySelectorAll('.preview-card .preview-card-label')).toHaveLength(4);
    expect(doc.querySelector('#options-root')).not.toBeNull();
    expect(doc.querySelector('#preset-select')).not.toBeNull();
    expect(doc.querySelector('.panel .preset-tools')).toBeNull();
    expect(doc.querySelector('header #open-presets[aria-haspopup=dialog]')).not.toBeNull();
    expect(doc.querySelector('dialog#presets-dialog .preset-tools #preset-select')).not.toBeNull();
    expect(doc.querySelector('dialog#presets-dialog .preset-tools #preset-name')).not.toBeNull();
    expect(doc.querySelector('.preset-tools #load-preset[aria-label="Load preset"]')).not.toBeNull();
    expect(doc.querySelector('.preset-tools #save-preset[aria-label="Save preset"]')).not.toBeNull();
    expect(doc.querySelector('.preset-tools #delete-preset[aria-label="Delete preset"]')).not.toBeNull();
    expect(doc.querySelector('.preset-tools #reset-defaults[aria-label="Reset selected overlay"] [data-mingcute=reset]')).not.toBeNull();
    expect(doc.querySelector('#preset-reset-confirm[hidden] #confirm-reset')).not.toBeNull();
    expect(doc.querySelector('.preset-tools #export-preset')).toBeNull();
    expect(doc.querySelector('.preset-tools #import-preset')).toBeNull();
    expect(doc.querySelector('header.app-chrome #import-all-settings[aria-label="Import all user settings"]')).not.toBeNull();
    expect(doc.querySelector('header.app-chrome #export-all-settings[aria-label="Export all user settings"]')).not.toBeNull();
    expect(doc.querySelector('header.app-chrome #import-all-file[type="file"]')).not.toBeNull();
    expect(doc.querySelector('#send-sample')).not.toBeNull();
    expect(doc.querySelector('#send-burst')).not.toBeNull();
  });

  it('marks only the Emote Wall and Chat previews as enabled in initial HTML',()=>{
    const doc=shell();
    for(const [view,enabled] of Object.entries({
      wall:true,chat:true,avatars:false,events:false,
    })){
      const toggle=doc.querySelector<HTMLInputElement>('#enable-'+view);
      const card=doc.querySelector<HTMLElement>('.preview-card[data-view='+view+']');
      expect(toggle?.checked,view+' toggle').toBe(enabled);
      expect(card?.dataset.enabled,view+' preview').toBe(String(enabled));
      expect(card?.querySelector<HTMLElement>('.preview-disabled')?.hidden,view+' message').toBe(enabled);
    }
  });

  it('provides separate viewport panels for mobile settings and preview', () => {
    const doc = shell();
    expect(doc.querySelector('header button#show-settings')).not.toBeNull();
    expect(doc.querySelector('aside button#show-preview')).not.toBeNull();
    expect(doc.querySelector('aside#overlay-inspector')).not.toBeNull();
    expect(doc.querySelector('.studio')?.getAttribute('data-mobile-panel')).toBe('preview');
  });
});
