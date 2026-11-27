import {createHostedLiveServer} from '../hosted.js';
import {hostedChannel,hostedPlatform} from '../hosted-channel.js';

export default createHostedLiveServer({platform:hostedPlatform(),channel:hostedChannel()});
