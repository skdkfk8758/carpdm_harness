import { isWorktree, getGitRoot, getMainWorktreeRoot } from '../utils/git.js';

export interface WorktreeInfo {
  isWorktree: boolean;
  projectRoot: string;
  mainWorktreeRoot: string | null;
}

export function detectWorktree(cwd: string): WorktreeInfo {
  const inWorktree = isWorktree(cwd);
  const projectRoot = getGitRoot(cwd) || cwd;
  const mainRoot = inWorktree ? getMainWorktreeRoot(cwd) : null;

  return {
    isWorktree: inWorktree,
    projectRoot,
    mainWorktreeRoot: mainRoot,
  };
}
