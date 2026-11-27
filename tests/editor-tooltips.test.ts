import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('inspector help as hover or keyboard-focus tooltips',()=>{
  it('keeps all manifest descriptions available without inline helper rows',()=>{
    const source=readFileSync('demo/studio.ts','utf8');
    const css=readFileSync('demo/styles.css','utf8');
    expect(source).not.toContain("const detail = document.createElement('small')");
    expect(source).toContain("help.className = 'option-help-trigger'");
    expect(source).toContain("tooltip.className = 'option-help-tooltip'");
    expect(source).toContain("tooltip.textContent = def.hint");
    expect(source).toContain("help.tabIndex = 0");
    expect(source).toContain("control.setAttribute('aria-describedby', tooltip.id)");
    expect(css).toContain('.option-help-trigger:hover .option-help-tooltip');
    expect(css).toContain('.option-help-trigger:focus-visible .option-help-tooltip');
    expect(css).toContain('.option-help-tooltip');
  });
});
