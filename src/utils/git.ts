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

export function listWorktrees(cwd: string): Array<{ path: string; branch: string; bare: boolean }> {
  try {
    const output = execSync('git worktree list --porcelain', { cwd, stdio: 'pipe' }).toString();
    const worktrees: Array<{ path: string; branch: string; bare: boolean }> = [];
    let current: { path: string; branch: string; bare: boolean } = { path: '', branch: '', bare: false };

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: line.slice(9), branch: '', bare: false };
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.bare = true;
      }
    }
    if (current.path) worktrees.push(current);

    return worktrees;
  } catch {
    return [];
  }
}

export function createWorktree(
  cwd: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string = 'main',
): { success: boolean; message: string } {
  try {
    execSync(`git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`, {
      cwd,
      stdio: 'pipe',
    });
    return { success: true, message: `Worktree created: ${worktreePath} (${branchName})` };
  } catch (err) {
    return { success: false, message: `Failed to create worktree: ${String(err)}` };
  }
}

export function removeWorktree(cwd: string, worktreePath: string): { success: boolean; message: string } {
  try {
    execSync(`git worktree remove "${worktreePath}"`, { cwd, stdio: 'pipe' });
    return { success: true, message: `Worktree removed: ${worktreePath}` };
  } catch (err) {
    return { success: false, message: `Failed to remove worktree: ${String(err)}` };
  }
}
