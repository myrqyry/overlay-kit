import { createLiveServer } from './http';
const port = process.env.OVERLAY_PORT ? Number(process.env.OVERLAY_PORT) : 5219;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid OVERLAY_PORT');
const server = await createLiveServer({port,publicOrigin:process.env.OVERLAY_PUBLIC_ORIGIN});
console.log('Overlay Kit live server: '+server.address);
console.log('Sources: '+server.address+'/chat.html, '+server.address+'/wall.html, '+server.address+'/avatars.html, '+server.address+'/events.html');
const shutdown = () => {void server.close().then(()=>process.exit(0));};
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
