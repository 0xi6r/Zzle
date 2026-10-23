import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['game.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile: 'dist/game.js',
  minify: true,
});

await cp('index.html', 'dist/index.html');
