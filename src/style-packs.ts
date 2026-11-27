/**
 * Trusted locally installed chat style packs. Both Chat and Wall share the
 * same lifecycle registry; their look and editor options remain independent.
 */
import {createLocalStyleRegistry,type LocalStylePack} from './style-pack-registry';
export type ChatStylePack=LocalStylePack;
export type BuiltinChatStyle='plain'|'paper'|'phosphor';
const builtins:readonly ChatStylePack[]=Object.freeze([
 Object.freeze({id:'plain',name:'Classic',description:'Clean, unobtrusive chat bubbles with the original appearance.'}),
 Object.freeze({id:'paper',name:'Paper',description:'Warm notebook paper, pencil edges and quiet paper grain.'}),
 Object.freeze({id:'phosphor',name:'Phosphor',description:'Soft amber-green analog terminal with subtle phosphor glow.'}),
]);
const registry=createLocalStyleRegistry('chatStyle',builtins);
export const listChatStylePacks=registry.list;
export const getChatStylePack=registry.get;
export const registerChatStylePack=registry.register;
export const applyChatStylePack=registry.apply;
