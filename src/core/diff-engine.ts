import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPatch } from 'diff';
import type { FileChange, FileStatus } from '../types/common.js';
import type { HarnessConfig } from '../types/config.js';
import { getTemplatesDir } from '../utils/paths.js';
import { computeFileHash, computeHash } from './file-ops.js';
import { getAllModules } from './module-registry.js';

export function analyzeChanges(
  config: HarnessConfig,
  projectRoot: string,
): FileChange[] {
  const changes: FileChange[] = [];
  const templatesDir = getTemplatesDir();
  const modules = getAllModules();

  for (const [relativePath, fileRecord] of Object.entries(config.files)) {
    const destPath = join(projectRoot, relativePath);
    const mod = modules[fileRecord.module];
    if (!mod) continue;

    // 모든 파일 (commands + hooks + docs) 중 해당 destination 찾기
    const allFiles = [...mod.commands, ...mod.hooks, ...mod.docs];
    const modFile = allFiles.find(f => f.destination === relativePath);
    if (!modFile) continue;

    const srcPath = join(templatesDir, modFile.source);
    if (!existsSync(srcPath)) continue;

    const templateHash = computeFileHash(srcPath);
    const installedHash = fileRecord.hash;

    if (!existsSync(destPath)) {
      // 파일이 삭제됨 - 사용자가 의도적으로 삭제한 것
      continue;
    }

    const currentHash = computeFileHash(destPath);

    const status = classifyFileStatus(installedHash, currentHash, templateHash);

    if (status !== 'UNCHANGED') {
      changes.push({
        relativePath,
        status,
        currentHash,
        templateHash,
        module: fileRecord.module,
      });
    }
  }

  return changes;
}

function classifyFileStatus(
  installedHash: string,
  currentHash: string,
  templateHash: string,
): FileStatus {
  const userModified = installedHash !== currentHash;
  const templateChanged = installedHash !== templateHash;

  if (!userModified && !templateChanged) return 'UNCHANGED';
  if (!userModified && templateChanged) return 'UPSTREAM_CHANGED';
  if (userModified && !templateChanged) return 'USER_MODIFIED';
  return 'CONFLICT';
}

export function generateDiff(
  projectRoot: string,
  relativePath: string,
  templateSourcePath: string,
): string {
  const currentPath = join(projectRoot, relativePath);
  const templatesDir = getTemplatesDir();
  const srcPath = join(templatesDir, templateSourcePath);

  const currentContent = existsSync(currentPath)
    ? readFileSync(currentPath, 'utf-8')
    : '';
  const newContent = existsSync(srcPath)
    ? readFileSync(srcPath, 'utf-8')
    : '';

  return createPatch(relativePath, currentContent, newContent, 'current', 'new');
}
