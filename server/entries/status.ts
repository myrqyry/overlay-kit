import type {IncomingMessage,ServerResponse} from 'node:http';
import {hostedChannel,hostedPlatform,normalizeHostedChannel,hostedPlatforms} from '../hosted-channel.js';

export default function status(_req:IncomingMessage,res:ServerResponse){
 const platform=hostedPlatform();
 const channel=normalizeHostedChannel(hostedChannel(),platform);
 res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify({
   service:'overlay-kit-live',
   mode:'hosted',
   websocketPath:'/api/live',
   platform,
   platforms:hostedPlatforms(),
   channel,
 }));
}
