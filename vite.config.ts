import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
  esbuild: { legalComments: 'inline' },
  build: {
    outDir: 'dist-demo',
    rollupOptions: {
      output: {
        // Rollup can remove upstream comments before esbuild sees the chunk.
        // Reproduce the original headers only in chunks containing GSAP.
        banner: chunk => Object.keys(chunk.modules).some(id => id.includes('/node_modules/gsap/'))
          ? ['gsap-core.js', 'CSSPlugin.js'].map(file => {
              const header = readFileSync(here('node_modules/gsap/'+file),'utf8').match(/\/\*![\s\S]*?\*\//)?.[0];
              if (!header) throw new Error('GSAP copyright header missing: '+file);
              return header;
            }).join('\n')
          : '',
      },
      input: { editor: here('index.html'), wall: here('wall.html'), chat: here('chat.html'), avatars: here('avatars.html'), events: here('events.html') },
    },
  },
  test: { environment: 'jsdom' },
});
