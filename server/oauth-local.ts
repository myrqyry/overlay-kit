import {beginOAuth,exchangeOAuthCode,refreshOAuthToken,type OAuthProvider,type OAuthTokens,type OAuthFetcher} from '@myrqyry/chatbus';
import {readFileSync,writeFileSync,renameSync,chmodSync} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';

type Client={clientId:string;clientSecret?:string};
type Stored={tokens:OAuthTokens;expiresAt:number};
export function createLocalOAuth(options:{file:string;clients:Partial<Record<OAuthProvider,Client>>;fetcher?:OAuthFetcher}){
 const file=resolve(options.file);
 const pending=new Map<OAuthProvider,{state:string;verifier?:string;redirectUri:string;expiresAt:number}>();
 let accounts:Partial<Record<OAuthProvider,Stored>>={};
 try{accounts=JSON.parse(readFileSync(file,'utf8')) as typeof accounts;}catch{/* No prior credentials. */}
 const persist=()=>{
  const temporary=file+'.'+randomBytes(6).toString('hex')+'.tmp';
  writeFileSync(temporary,JSON.stringify(accounts),{mode:0o600,flag:'wx'});
  renameSync(temporary,file);chmodSync(file,0o600);
 };
 const configured=(provider:OAuthProvider)=>{
  const client=options.clients[provider];
  if(!client?.clientId)throw new Error(provider+' OAuth client is not configured');
  return client;
 };
 return {
  configured:()=>({youtube:Boolean(options.clients.youtube?.clientId),
   twitch:Boolean(options.clients.twitch?.clientId&&options.clients.twitch?.clientSecret),
   kick:Boolean(options.clients.kick?.clientId&&options.clients.kick?.clientSecret)}),
  status:()=>({youtube:Boolean(accounts.youtube?.tokens.accessToken),
   twitch:Boolean(accounts.twitch?.tokens.accessToken),kick:Boolean(accounts.kick?.tokens.accessToken)}),
  providerForState:(state:string):OAuthProvider|null=>{
   for(const provider of ['youtube','twitch','kick'] as const){
    const item=pending.get(provider);if(!item||Date.now()>item.expiresAt)continue;
    const a=Buffer.from(item.state);const b=Buffer.from(state);
    if(a.length===b.length&&timingSafeEqual(a,b))return provider;
   }return null;
  },
  async begin(provider:OAuthProvider,redirectUri:string){
   const client=configured(provider);
   const scopes=provider==='youtube'?['https://www.googleapis.com/auth/youtube.readonly']:
    provider==='kick'?['user:read','channel:read','events:subscribe']:['user:read:chat'];
   const request=await beginOAuth({provider,...client,redirectUri,scopes});
   pending.set(provider,{state:request.state,verifier:request.codeVerifier,redirectUri,expiresAt:Date.now()+300_000});
   return {url:request.url,state:request.state};
  },
  async complete(provider:OAuthProvider,state:string,code:string){
   const item=pending.get(provider);pending.delete(provider);
   if(!item||Date.now()>item.expiresAt||!state||!code)throw new Error('OAuth state expired or invalid');
   const expected=Buffer.from(item.state);const received=Buffer.from(state);
   if(expected.length!==received.length||!timingSafeEqual(expected,received))throw new Error('OAuth state mismatch');
   const tokens=await exchangeOAuthCode({provider,...configured(provider),redirectUri:item.redirectUri,code,
    ...(item.verifier?{codeVerifier:item.verifier}:{}),fetcher:options.fetcher});
   accounts[provider]={tokens,expiresAt:Date.now()+(tokens.expiresIn??3600)*1000};persist();
  },
  async accessToken(provider:OAuthProvider){
   const account=accounts[provider];if(!account)return null;
   if(account.expiresAt>Date.now()+60_000)return account.tokens.accessToken;
   if(!account.tokens.refreshToken)return null;
   const next=await refreshOAuthToken({provider,...configured(provider),refreshToken:account.tokens.refreshToken,fetcher:options.fetcher});
   accounts[provider]={tokens:{...next,refreshToken:next.refreshToken??account.tokens.refreshToken},expiresAt:Date.now()+(next.expiresIn??3600)*1000};persist();
   return next.accessToken;
  },
  disconnect(provider:OAuthProvider){delete accounts[provider];pending.delete(provider);persist();},
 };
}
