import type {TriggerCue,TriggerEffect} from './overlay-triggers';
import {createGoldenCueMotion,PHI} from './golden-motion';
import './trigger-presentation.css';

/**
 * One presentational sibling per Chat/Wall browser source. Nothing here owns
 * messages, connection state, a scene item, or the cue expiration timer.
 */
export function createTriggerPresentation(
  root:HTMLElement,
  options:{onVisual?:(effect:TriggerEffect|null)=>void}={},
){
  const surface=document.createElement('div');
  surface.className='overlay-trigger-surface';
  surface.setAttribute('aria-hidden','true');
  surface.hidden=true;
  root.insertAdjacentElement('afterend',surface);
  let disposed=false;
  return {
    show(cue:TriggerCue|null){
      if(disposed)return;
      surface.replaceChildren();
      if(!cue){
        surface.hidden=true;
        delete surface.dataset.effect;
        delete root.dataset.triggerEffect;
        options.onVisual?.(null);
        return;
      }
      surface.hidden=false;
      surface.dataset.effect=cue.effect;
      root.dataset.triggerEffect=cue.effect;
      const motion=createGoldenCueMotion(cue.durationMs);
      // New element per cue restarts Web Animations correctly even when the
      // same effect is triggered twice in a row. No forced layout/reflow.
      const scene=document.createElement('div');
      scene.className='overlay-trigger-scene';
      scene.dataset.effect=cue.effect;
      scene.style.setProperty('--trigger-enter-ms',motion.enterMs+'ms');
      scene.style.setProperty('--trigger-exit-ms',motion.exitMs+'ms');
      scene.style.setProperty('--trigger-exit-delay-ms',motion.exitDelayMs+'ms');
      scene.style.setProperty('--trigger-pulse-ms',motion.pulseMs+'ms');
      scene.style.setProperty('--trigger-stagger-ms',Math.round(motion.enterMs/PHI)+'ms');
      const caption=document.createElement('div');
      caption.className='overlay-trigger-label';
      caption.textContent=cue.label;
      scene.append(caption);
      if(cue.effect==='confetti'||cue.effect==='rain'){
        const count=cue.effect==='confetti'?22:18;
        for(let i=0;i<count;i++){
          const part=document.createElement('i');
          part.className='overlay-trigger-particle';
          const particle=motion.particle(i,cue.effect);
          part.style.setProperty('--particle-x',particle.x+'%');
          part.style.setProperty('--particle-delay',particle.delayMs+'ms');
          part.style.setProperty('--particle-duration',particle.durationMs+'ms');
          part.style.setProperty('--particle-drift',particle.driftPx+'px');
          part.style.setProperty('--particle-rotation',particle.rotationDeg+'deg');
          part.style.setProperty('--particle-scale',String(particle.scale));
          part.style.setProperty('--particle-color',particle.color);
          part.style.setProperty('--particle-iterations',String(particle.iterations));
          scene.append(part);
        }
      }
      surface.append(scene);
      options.onVisual?.(cue.effect);
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      options.onVisual?.(null);
      delete root.dataset.triggerEffect;
      surface.remove();
    },
  };
}
