// Build the demo plugin to public/plugins/demo.js.
// Externalizes nothing (the demo plugin imports types only), so the bundle is
// self-contained and can be served as a static ESM module.
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

await build({
  entryPoints: [resolve(here, 'index.ts')],
  outfile: resolve(root, 'public', 'plugins', 'demo.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  minify: false,
  sourcemap: true,
  logLevel: 'info',
});
