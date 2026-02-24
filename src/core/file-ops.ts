import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { PROTECTED_FILES, PROTECTED_DIRS } from '../types/common.js';

export function computeHash(content: string): string {
  return 'sha256:' + createHash('sha256').update(content).digest('hex');
}

export function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return computeHash(content);
}

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function safeWriteFile(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

export function safeCopyFile(src: string, dest: string, executable?: boolean): void {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  if (executable) {
    chmodSync(dest, 0o755);
  }
}

export function isProtectedPath(relativePath: string): boolean {
  for (const pf of PROTECTED_FILES) {
    if (relativePath === pf || relativePath.startsWith(pf + '/')) return true;
  }
  for (const pd of PROTECTED_DIRS) {
    if (relativePath.startsWith(pd + '/')) return true;
  }
  return false;
}

export function backupFile(filePath: string): string {
  const backupPath = filePath + '.backup';
  if (existsSync(filePath)) {
    copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

export function readFileContent(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
