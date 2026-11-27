import {describe,it,expect} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor,isOptionApplicable} from '../src/options';
import {createChatFeed} from '../src/views';
import {createChatEdgeMask,createChatEdgeTreatment} from '../src/chat-edge-fade';

describe('chat exit edge fade',()=>{
  it('round-trips as a bounded Styling option without changing the default',()=>{
    expect(DEFAULT_OPTIONS.edgeFade).toBe(0);
    const def=optionsForEditor('chat',true).find(option=>option.key==='edgeFade');
    expect(def).toMatchObject({section:'Chat • Styling',kind:'range',min:0,max:40,unit:'%'});
    const settings=normalizeOptions({...DEFAULT_OPTIONS,edgeFade:24});
    const query=writeOptions(settings,'chat');
    expect(query).toContain('edgeFade=24');
    expect(readOptions('?'+query,'chat').edgeFade).toBe(24);
  });

  it('fades the automatic exit edge for stack/strip and disables it for spotlight',()=>{
    const root=document.createElement('div');document.body.append(root);
    const feed=createChatFeed(root,{layout:'stack',vertical:'bottom',edgeFade:20});
    expect(root.dataset.exitEdge).toBe('top');
    expect(root.style.maskImage).toContain('to bottom');
    expect(root.style.maskImage).toContain('20%');

    feed.configure({vertical:'top'});
    expect(root.dataset.exitEdge).toBe('bottom');
    expect(root.style.maskImage).toContain('to top');

    feed.configure({layout:'strip'});
    expect(root.dataset.exitEdge).toBe('left');
    expect(root.style.maskImage).toContain('to right');

    feed.configure({layout:'spotlight'});
    expect(root.dataset.exitEdge).toBe('none');
    expect(root.style.maskImage).toBe('');
    expect(root.style.webkitMaskImage).toBe('');
    feed.dispose();root.remove();
  });
  it('preserves legacy links and round-trips new style, distance, opacity and band settings',()=>{
    const old=readOptions('?edgeFade=24','chat');
    expect(old.edgeFadeStyle).toBe('linear');
    expect(old.edgeFadeUnit).toBe('percent');
    expect(old.edgeFadeOpacity).toBe(0);
    expect(old.edgeFadeHold).toBe(0);
    expect(writeOptions(old,'chat')).toBe('edgeFade=24');
    const settings=normalizeOptions({edgeFadeStyle:'steps',edgeFadeUnit:'pixels',
      edgeFade:24,edgeFadePixels:180,edgeFadeOpacity:25,edgeFadeHold:20,edgeFadeSteps:5});
    expect(readOptions('?'+writeOptions(settings,'chat'),'chat')).toEqual(settings);
    expect(writeOptions(settings,'wall')).toBe('');
    expect(normalizeOptions({edgeFadeStyle:'arbitrary CSS',edgeFadePixels:99999,edgeFadeOpacity:-5,edgeFadeHold:999,edgeFadeSteps:999}))
      .toMatchObject({edgeFadeStyle:'linear',edgeFadePixels:1200,edgeFadeOpacity:0,edgeFadeHold:90,edgeFadeSteps:12});
    expect(isOptionApplicable('edgeFade',settings)).toBe(false);
    expect(isOptionApplicable('edgeFadePixels',settings)).toBe(true);
    expect(isOptionApplicable('edgeFadeSteps',settings)).toBe(true);
    expect(isOptionApplicable('edgeFadeSteps',old)).toBe(false);
    expect(isOptionApplicable('edgeFadeStyle',normalizeOptions({chatLayout:'spotlight'}))).toBe(false);
  });

  it('produces distinct bounded curves, steps and cut with the same endpoints',()=>{
    const styles=['linear','smooth','quick','linger','steps','cut'] as const;
    expect(createChatEdgeMask({edgeFade:20})).toEqual({edge:'top',image:'linear-gradient(to bottom, transparent 0%, #000 20%, #000 100%)'});
    const results=styles.map(edgeFadeStyle=>createChatEdgeMask({edgeFade:20,edgeFadeStyle,edgeFadeOpacity:25,edgeFadeHold:20,edgeFadeSteps:4}));
    expect(new Set(results.map(x=>x.image)).size).toBe(styles.length);
    for(const result of results){
      expect(result.edge).toBe('top');
      expect(result.image).toContain('rgba(0, 0, 0, 0.25) 0%');
      expect(result.image).toContain('#000 20%');
      expect(result.image.endsWith('#000 100%)')).toBe(true);
    }
    const pixels=createChatEdgeMask({layout:'strip',edgeFadeUnit:'pixels',edgeFadePixels:180,edgeFadeStyle:'smooth'});
    expect(pixels.edge).toBe('left');
    expect(pixels.image).toContain('min(100%, 180px)');
    expect(createChatEdgeMask({edgeFade:20,edgeFadeOpacity:100})).toEqual({edge:'none',image:''});
    expect(createChatEdgeMask({edgeFade:20,edgeFadeUnit:'pixels',edgeFadePixels:0})).toEqual({edge:'none',image:''});
    expect(createChatEdgeMask({layout:'spotlight',edgeFade:40})).toEqual({edge:'none',image:''});
  });

  it('hot switches styles, axes and off without replacing any row',()=>{
    const root=document.createElement('div');
    const feed=createChatFeed(root,{edgeFade:25});
    try{
      feed.receive({id:'one',timestamp:1,platform:'twitch',user:{name:'A',badges:[]},parts:[{type:'text',text:'hello'}]});
      const row=root.firstElementChild;
      const time=feed.snapshot()[0]!.enteredAt;
      feed.configure({edgeFadeStyle:'steps',edgeFadeSteps:4,edgeFadeUnit:'pixels',edgeFadePixels:80});
      expect(root.style.maskImage).toContain('min(100%, 80px)');
      expect(root.style.maskImage).toBe(root.style.webkitMaskImage);
      feed.configure({layout:'strip'});
      expect(root.dataset.exitEdge).toBe('left');
      feed.configure({edgeFadePixels:0});
      expect(root.style.maskImage).toBe('');
      expect(root.style.webkitMaskImage).toBe('');
      expect(root.dataset.exitEdge).toBe('none');
      expect(root.firstElementChild).toBe(row);
      expect(feed.snapshot()[0]!.enteredAt).toBe(time);
    }finally{feed.dispose();}
  });

  it('round-trips independent patterned edge treatment configuration',()=>{
    const settings=normalizeOptions({edgeFade:24,edgeFadePattern:'grain',edgeFadePatternSize:10,edgeFadeOpacity:100});
    const query=writeOptions(settings,'chat');
    expect(readOptions('?'+query,'chat')).toEqual(settings);
    expect(query).toContain('edgeFadePattern=grain');
    expect(query).toContain('edgeFadePatternSize=10');
    expect(normalizeOptions({edgeFadePattern:'invalid',edgeFadePatternSize:1000}))
      .toMatchObject({edgeFadePattern:'none',edgeFadePatternSize:24});
    expect(isOptionApplicable('edgeFadePatternSize',settings)).toBe(true);
    expect(isOptionApplicable('edgeFadePatternSize',normalizeOptions({}))).toBe(false);
    expect(writeOptions(settings,'wall')).toBe('');
  });

  it('uses deterministic bounded shape masks independently of the opacity profile',()=>{
    const base={edgeFade:30,edgeFadeOpacity:100,edgeFadePatternSize:8};
    const patterns=['dither','grain','fringe'] as const;
    const results=patterns.map(edgeFadePattern=>createChatEdgeTreatment({...base,edgeFadePattern}));
    expect(new Set(results.map(x=>x.image)).size).toBe(3);
    for(const result of results){
      expect(result.edge).toBe('top');
      expect(result.image).toContain('data:image/svg+xml,');
      expect(result.repeat).toBe('repeat-x, no-repeat');
      expect(result.size).toBe('128px 30%, 100% 100%');
      expect(result.image).toContain('transparent 30%');
      expect(result.image.length).toBeLessThan(20000);
    }
    expect(createChatEdgeTreatment({...base,edgeFadePattern:'grain'})).toEqual(results[1]);
    const mixed=createChatEdgeTreatment({...base,edgeFadeOpacity:0,edgeFadePattern:'grain',layout:'strip',edgeFadeUnit:'pixels',edgeFadePixels:80});
    expect(mixed.size).toBe('100% 100%, min(100%, 80px) 128px, 100% 100%');
    expect(mixed.composite).toBe('intersect, add, add');
    expect(createChatEdgeTreatment({...base,edgeFadePattern:'fringe',layout:'spotlight'}).image).toBe('');
    const fallback=createChatEdgeTreatment({...base,edgeFadePattern:'grain'},false);
    expect(fallback.image).toBe('linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)');
    expect(fallback.composite).toBe('');
    expect(createChatEdgeTreatment({edgeFade:30,edgeFadeStyle:'smooth',edgeFadePattern:'grain'},false).image)
      .toBe(createChatEdgeMask({edgeFade:30,edgeFadeStyle:'smooth'}).image);
  });

  it('clears pattern layers on disable and preserves mounted messages',()=>{
    const root=document.createElement('div');
    const feed=createChatFeed(root,{edgeFade:30,edgeFadePattern:'dither'});
    try{
      feed.receive({id:'one',timestamp:1,platform:'twitch',user:{name:'A',badges:[]},parts:[{type:'text',text:'hello'}]});
      const row=root.firstElementChild;
      expect(root.style.maskImage).toContain('data:image/svg+xml');
      expect(root.style.maskRepeat).toContain('repeat-x');
      feed.configure({edgeFadePattern:'none'});
      expect(root.style.maskImage).toBe('linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)');
      expect(root.style.maskRepeat).toBe('');
      expect(root.style.maskSize).toBe('');
      expect(root.style.maskComposite).toBe('');
      expect(root.firstElementChild).toBe(row);
    }finally{feed.dispose();}
  });

});
