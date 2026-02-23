import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessConfig, ConfigOptions } from '../types/config.js';
import type { FileHash } from '../types/common.js';
import { DEFAULT_CONFIG, CONFIG_FILENAME } from '../types/config.js';
import { readFileContent, safeWriteFile, computeHash } from './file-ops.js';

export function loadConfig(projectRoot: string): HarnessConfig | null {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  const content = readFileContent(configPath);
  if (!content) return null;
  try {
    return JSON.parse(content) as HarnessConfig;
  } catch {
    return null;
  }
}

export function saveConfig(projectRoot: string, config: HarnessConfig): void {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  config.updatedAt = new Date().toISOString();
  safeWriteFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function createConfig(
  projectRoot: string,
  preset: string,
  modules: string[],
  options: Partial<ConfigOptions> = {},
): HarnessConfig {
  const config: HarnessConfig = {
    ...DEFAULT_CONFIG,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preset,
    modules,
    options: { ...DEFAULT_CONFIG.options, ...options },
    files: {},
  };
  return config;
}

export function updateFileRecord(
  config: HarnessConfig,
  relativePath: string,
  module: string,
  version: string,
  hash: string,
): void {
  config.files[relativePath] = { module, version, hash };
}

export function removeFileRecord(config: HarnessConfig, relativePath: string): void {
  delete config.files[relativePath];
}

export function configExists(projectRoot: string): boolean {
  return existsSync(join(projectRoot, CONFIG_FILENAME));
}
