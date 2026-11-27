import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

const css=readFileSync('src/chat-motion.css','utf8');
const block=(name:string)=>{
  const start=css.indexOf(`@keyframes ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  let depth=0,end=-1;
  for(let i=css.indexOf('{',start);i<css.length;i++){
    if(css[i]==='{')depth++;
    else if(css[i]==='}' && --depth===0){end=i+1;break;}
  }
  expect(end).toBeGreaterThan(start);
  return css.slice(start,end);
};

describe('letter entrance visual clarity',()=>{
  it('reserves opacity animation for the explicit Fade entrance',()=>{
    expect(block('chat-letter-in-fade')).toContain('opacity:0');
    for(const effect of ['rise','pop','slide','drop','flip','twist','wave','spring','drift','soft-land']){
      expect(block(`chat-letter-in-${effect}`),effect).not.toMatch(/opacity\s*:/);
    }
  });
});
