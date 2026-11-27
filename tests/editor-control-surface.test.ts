import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('editor control surface visual contract',()=>{
 it('uses tactile full-bodied sliders, switch toggles, and a sticky inspector search',()=>{
  const css=readFileSync('demo/styles.css','utf8');
  const tokens=readFileSync('demo/expressive-ui/tokens.css','utf8');
  expect(css).toContain('.option-row input[type=range]');
  expect(css).toContain('height:var(--eui-slider-rail)');
  expect(tokens).toContain('--eui-slider-rail: 20px');
  expect(tokens).toContain('--eui-slider-thumb: 20px');
  expect(css).toContain('--range-progress');
  expect(css).toContain('.toggle-option input[type=checkbox]');
  expect(css).toContain('appearance:none');
  expect(css).toContain('.option-tools {');
  expect(css).toContain('position:sticky');
  expect(css).toContain(".workspace-header {grid-column:1 / -1;grid-row:3;");
  expect(css).toContain(".workspace-tab-actions");
  expect(css).not.toContain(".source-copy-chips");
  expect(css).not.toContain(".stage-toolbar");
 });
 it('renders section summaries as scope-aware titles instead of repeated manifest strings',()=>{
  const source=readFileSync('demo/studio.ts','utf8');
  expect(source).toContain("section.dataset.scope = scope.toLowerCase()");
  expect(source).toContain("summaryTitle.className = 'option-section-title'");
  expect(source).toContain("summaryTitle.textContent = title");
 });
});
