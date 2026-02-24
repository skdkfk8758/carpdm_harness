import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import type { ModuleDefinition, ModuleFile } from '../types/module.js';
import type { HarnessConfig } from '../types/config.js';
import { getTemplatesDir } from '../utils/paths.js';
import { safeCopyFile, computeFileHash } from './file-ops.js';
import { updateFileRecord } from './config.js';
import { getPackageVersion } from '../utils/version.js';
import { logger } from '../utils/logger.js';

export function getAllModuleFiles(mod: ModuleDefinition): ModuleFile[] {
  return [...mod.commands, ...mod.hooks, ...mod.docs, ...(mod.rules ?? []), ...(mod.agents ?? [])];
}

export interface InstallResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}

export function installModuleFiles(
  mod: ModuleDefinition,
  projectRoot: string,
  config: HarnessConfig,
  dryRun = false,
): InstallResult {
  const result: InstallResult = { installed: [], skipped: [], errors: [] };
  const templatesDir = getTemplatesDir();
  const version = getPackageVersion();

  const allFiles = getAllModuleFiles(mod);

  for (const file of allFiles) {
    const srcPath = join(templatesDir, file.source);
    const destPath = join(projectRoot, file.destination);

    if (!existsSync(srcPath)) {
      result.errors.push(`소스 파일 없음: ${file.source}`);
      continue;
    }

    if (existsSync(destPath)) {
      result.skipped.push(file.destination);
      logger.fileAction('skip', file.destination);
      continue;
    }

    if (!dryRun) {
      safeCopyFile(srcPath, destPath, file.executable);
      const hash = computeFileHash(destPath);
      updateFileRecord(config, file.destination, mod.name, version, hash);
      logger.fileAction('create', file.destination);
    } else {
      logger.fileAction('create', `${file.destination} (dry-run)`);
    }

    result.installed.push(file.destination);
  }

  return result;
}

export function installDocsTemplates(
  mod: ModuleDefinition,
  projectRoot: string,
  docsDir: string,
  config: HarnessConfig,
  dryRun = false,
): InstallResult {
  const result: InstallResult = { installed: [], skipped: [], errors: [] };
  const templatesDir = getTemplatesDir();
  const version = getPackageVersion();

  for (const file of mod.docs) {
    const srcPath = join(templatesDir, file.source);
    const destPath = join(projectRoot, docsDir, file.destination.replace(/^docs\/templates\//, ''));

    if (!existsSync(srcPath)) {
      result.errors.push(`소스 파일 없음: ${file.source}`);
      continue;
    }

    if (existsSync(destPath)) {
      result.skipped.push(destPath);
      continue;
    }

    if (!dryRun) {
      safeCopyFile(srcPath, destPath);
      const hash = computeFileHash(destPath);
      updateFileRecord(config, relative(projectRoot, destPath), mod.name, version, hash);
    }

    result.installed.push(relative(projectRoot, destPath));
  }

  return result;
}
