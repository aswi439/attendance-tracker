import { build } from 'esbuild';

await build({
  entryPoints: ['src/worker/index.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/index.js',
  minify: false,
  keepNames: true,
  mainFields: ['module', 'main'],
  conditions: ['worker', 'browser', 'import', 'default'],
});
console.log('worker bundled -> dist/index.js');
