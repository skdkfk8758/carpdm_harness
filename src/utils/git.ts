import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';

export function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getGitRoot(cwd: string): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

export function isWorktree(cwd: string): boolean {
  try {
    const gitDir = execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' }).toString().trim();
    return gitDir.includes('.git/worktrees');
  } catch {
    return false;
  }
}

export function getMainWorktreeRoot(cwd: string): string | null {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', { cwd, stdio: 'pipe' }).toString().trim();
    if (gitCommonDir === '.git') {
      return getGitRoot(cwd);
    }
    return resolve(dirname(gitCommonDir));
  } catch {
    return null;
  }
}
