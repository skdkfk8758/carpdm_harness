import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { isGitRepo } from '../utils/git.js';
import { getPackageVersion, isNewerVersion } from '../utils/version.js';
import { safeWriteFile, readFileContent } from './file-ops.js';

export interface PluginUpdateCheck {
  available: boolean;
  currentVersion: string;
  remoteVersion: string;
  changelog: string[];
  reason?: 'not-git-repo' | 'already-latest' | 'fetch-failed';
}

export interface PluginUpdateResult {
  success: boolean;
  previousRef: string;
  newRef: string;
  rolledBack: boolean;
  buildOutput: string;
  error?: string;
}

export interface PluginUpdateHistoryEntry {
  timestamp: string;
  previousVersion: string;
  newVersion: string;
  previousRef: string;
  newRef: string;
  rolledBack: boolean;
}

export function checkForUpdates(packageRoot: string): PluginUpdateCheck {
  const currentVersion = getPackageVersion();

  if (!isGitRepo(packageRoot)) {
    return {
      available: false,
      currentVersion,
      remoteVersion: '',
      changelog: [],
      reason: 'not-git-repo',
    };
  }

  try {
    execSync('git fetch --tags origin', { cwd: packageRoot, stdio: 'pipe' });
  } catch {
    return {
      available: false,
      currentVersion,
      remoteVersion: '',
      changelog: [],
      reason: 'fetch-failed',
    };
  }

  let remoteVersion: string;
  try {
    const tagOutput = execSync('git tag --sort=-v:refname', {
      cwd: packageRoot,
      stdio: 'pipe',
    }).toString().trim();

    const latestTag = tagOutput.split('\n').find((tag) => /^v\d+\.\d+\.\d+$/.test(tag));

    if (latestTag) {
      remoteVersion = latestTag.replace(/^v/, '');
    } else {
      // fallback: 태그 없으면 origin/main에서 가져오기
      const remotePkg = execSync('git show origin/main:package.json', {
        cwd: packageRoot,
        stdio: 'pipe',
      }).toString().trim();
      remoteVersion = JSON.parse(remotePkg).version || '0.0.0';
    }
  } catch {
    return { available: false, currentVersion, remoteVersion: '', changelog: [], reason: 'fetch-failed' };
  }

  if (!isNewerVersion(currentVersion, remoteVersion)) {
    return {
      available: false,
      currentVersion,
      remoteVersion,
      changelog: [],
      reason: 'already-latest',
    };
  }

  let changelog: string[] = [];
  try {
    const currentTag = `v${currentVersion}`;
    const remoteTag = `v${remoteVersion}`;
    // 현재 버전 태그가 존재하는지 확인
    try {
      execSync(`git rev-parse ${currentTag}`, { cwd: packageRoot, stdio: 'pipe' });
      const logOutput = execSync(`git log ${currentTag}..${remoteTag} --oneline`, {
        cwd: packageRoot,
        stdio: 'pipe',
      }).toString().trim();
      changelog = logOutput.split('\n').filter((line) => line.length > 0);
    } catch {
      // 현재 버전 태그가 없으면 HEAD 기준
      const logOutput = execSync(`git log HEAD..${remoteTag} --oneline`, {
        cwd: packageRoot,
        stdio: 'pipe',
      }).toString().trim();
      changelog = logOutput.split('\n').filter((line) => line.length > 0);
    }
  } catch {
    changelog = [];
  }

  return {
    available: true,
    currentVersion,
    remoteVersion,
    changelog,
  };
}

export function performUpdate(packageRoot: string, targetVersion: string): PluginUpdateResult {
  const previousRef = execSync('git rev-parse HEAD', {
    cwd: packageRoot,
    stdio: 'pipe',
  }).toString().trim();

  execSync(`git checkout v${targetVersion}`, { cwd: packageRoot, stdio: 'pipe' });

  let buildOutput = '';
  try {
    // npm install 추가 (의존성 변경 대응)
    execSync('npm install', { cwd: packageRoot, stdio: 'pipe' });

    buildOutput = execSync('npm run build', {
      cwd: packageRoot,
      stdio: 'pipe',
    }).toString();

    const newRef = execSync('git rev-parse HEAD', {
      cwd: packageRoot,
      stdio: 'pipe',
    }).toString().trim();

    return {
      success: true,
      previousRef,
      newRef,
      rolledBack: false,
      buildOutput,
    };
  } catch (err) {
    try {
      execSync(`git checkout ${previousRef}`, { cwd: packageRoot, stdio: 'pipe' });
      execSync('npm install', { cwd: packageRoot, stdio: 'pipe' });
      execSync('npm run build', { cwd: packageRoot, stdio: 'pipe' });

      return {
        success: false,
        previousRef,
        newRef: previousRef,
        rolledBack: true,
        buildOutput: '',
        error: String(err),
      };
    } catch (rollbackErr) {
      return {
        success: false,
        previousRef,
        newRef: previousRef,
        rolledBack: false,
        buildOutput: '',
        error: `빌드 실패 + 롤백 실패: ${String(err)}`,
      };
    }
  }
}

export function recordUpdateHistory(
  packageRoot: string,
  entry: PluginUpdateHistoryEntry,
): void {
  const historyPath = join(packageRoot, '.harness', 'plugin-update-history.json');
  const existing = readFileContent(historyPath);

  let history: PluginUpdateHistoryEntry[] = [];
  if (existing !== null) {
    try {
      history = JSON.parse(existing);
    } catch {
      history = [];
    }
  }

  history = [entry, ...history].slice(0, 20);

  safeWriteFile(historyPath, JSON.stringify(history, null, 2));
}
