import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readFileContent, safeWriteFile, ensureDir } from './file-ops.js';

/**
 * OMC 상태 파일을 읽습니다.
 */
export function readOmcState(projectRoot: string, mode: string): Record<string, unknown> | null {
  try {
    const statePath = join(projectRoot, '.omc', 'state', `${mode}-state.json`);
    const content = readFileContent(statePath);
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 현재 활성화된 OMC 모드를 반환합니다.
 */
export function getActiveOmcMode(projectRoot: string): string | null {
  try {
    const stateDir = join(projectRoot, '.omc', 'state');
    if (!existsSync(stateDir)) return null;

    const files = readdirSync(stateDir).filter((f) => f.endsWith('-state.json'));

    for (const file of files) {
      const content = readFileContent(join(stateDir, file));
      if (!content) continue;

      try {
        const state = JSON.parse(content) as Record<string, unknown>;
        if (state.active === true) {
          // 파일명에서 모드명 추출: "autopilot-state.json" → "autopilot"
          return file.replace('-state.json', '');
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * OMC 프로젝트 메모리를 읽습니다.
 */
export function readOmcProjectMemory(projectRoot: string): Record<string, unknown> | null {
  try {
    const memoryPath = join(projectRoot, '.omc', 'project-memory.json');
    const content = readFileContent(memoryPath);
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * OMC 프로젝트 메모리를 저장합니다.
 */
export function writeOmcProjectMemory(projectRoot: string, data: Record<string, unknown>): void {
  try {
    const memoryPath = join(projectRoot, '.omc', 'project-memory.json');
    ensureDir(join(projectRoot, '.omc'));
    safeWriteFile(memoryPath, JSON.stringify(data, null, 2) + '\n');
  } catch {
    // 쓰기 실패는 무시
  }
}

/**
 * OMC 노트패드 내용을 읽습니다.
 */
export function readOmcNotepad(projectRoot: string): string | null {
  try {
    const notepadPath = join(projectRoot, '.omc', 'notepad.md');
    return readFileContent(notepadPath);
  } catch {
    return null;
  }
}

/**
 * OMC state에 워크플로우 상태를 기록합니다.
 * .omc/state/workflow-state.json으로 저장.
 */
export function writeOmcWorkflowState(
  projectRoot: string,
  data: Record<string, unknown>,
): void {
  try {
    const statePath = join(projectRoot, '.omc', 'state', 'workflow-state.json');
    ensureDir(join(projectRoot, '.omc', 'state'));
    safeWriteFile(statePath, JSON.stringify(data, null, 2) + '\n');
  } catch {
    // 쓰기 실패는 무시
  }
}

/**
 * OMC state에서 워크플로우 상태를 읽습니다.
 */
export function readOmcWorkflowState(
  projectRoot: string,
): Record<string, unknown> | null {
  try {
    const statePath = join(projectRoot, '.omc', 'state', 'workflow-state.json');
    const content = readFileContent(statePath);
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * OMC 글로벌 설정에서 버전 정보를 추출합니다.
 */
export function getOmcVersion(): string | null {
  try {
    const configPath = join(homedir(), '.claude', '.omc-config.json');
    const content = readFileContent(configPath);
    if (!content) return null;

    const config = JSON.parse(content) as Record<string, unknown>;
    return typeof config.version === 'string' ? config.version : null;
  } catch {
    return null;
  }
}
