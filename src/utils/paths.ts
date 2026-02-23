import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getPackageRoot(): string {
  // dist/index.js에서 실행되므로 한 단계 위
  return resolve(__dirname, '..');
}

export function getTemplatesDir(): string {
  return join(getPackageRoot(), 'templates');
}

export function getPresetsDir(): string {
  return join(getPackageRoot(), 'presets');
}

export function getGlobalCommandsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return join(home, '.claude', 'commands');
}

export function getProjectRoot(cwd?: string): string {
  return cwd || process.cwd();
}

export function getConfigPath(projectRoot: string): string {
  return join(projectRoot, 'carpdm-harness.config.json');
}

export function configExists(projectRoot: string): boolean {
  return existsSync(getConfigPath(projectRoot));
}
