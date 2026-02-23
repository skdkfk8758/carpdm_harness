import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'templates');
const dest = resolve(root, 'dist', 'templates');
const presetsSrc = resolve(root, 'presets');
const presetsDest = resolve(root, 'dist', 'presets');

if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('[copy-templates] templates/ → dist/templates/');
}

if (existsSync(presetsSrc)) {
  mkdirSync(presetsDest, { recursive: true });
  cpSync(presetsSrc, presetsDest, { recursive: true });
  console.log('[copy-templates] presets/ → dist/presets/');
}
