import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readFileContent, safeWriteFile, ensureDir } from './file-ops.js';
import type {
  WorkflowInstance,
  WorkflowHistory,
  WorkflowEvent,
  ActiveWorkflow,
} from '../types/workflow-engine.js';

const WORKFLOWS_DIR = '.harness/workflows';
const ACTIVE_FILE = 'active.json';
const STATE_FILE = 'state.json';
const HISTORY_FILE = 'history.json';

/**
 * 워크플로우 ID를 생성합니다.
 * 형식: {workflowType}-{YYYYMMDD}-{random4chars}
 */
export function generateWorkflowId(workflowType: string): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${workflowType}-${dateStr}-${rand}`;
}

/**
 * 워크플로우 디렉토리 경로를 반환합니다.
 */
export function getWorkflowDir(projectRoot: string, workflowId: string): string {
  return join(projectRoot, WORKFLOWS_DIR, workflowId);
}

/**
 * 워크플로우 기본 디렉토리 경로를 반환합니다.
 */
export function getWorkflowsBaseDir(projectRoot: string): string {
  return join(projectRoot, WORKFLOWS_DIR);
}

/**
 * 현재 활성 워크플로우 ID를 읽습니다.
 */
export function loadActiveWorkflowId(projectRoot: string): string | null {
  try {
    const activePath = join(projectRoot, WORKFLOWS_DIR, ACTIVE_FILE);
    const content = readFileContent(activePath);
    if (!content) return null;
    const data = JSON.parse(content) as ActiveWorkflow;
    return data.activeWorkflowId ?? null;
  } catch {
    return null;
  }
}

/**
 * 활성 워크플로우 ID를 저장합니다.
 */
export function saveActiveWorkflowId(projectRoot: string, workflowId: string): void {
  const activePath = join(projectRoot, WORKFLOWS_DIR, ACTIVE_FILE);
  const data: ActiveWorkflow = {
    activeWorkflowId: workflowId,
    startedAt: new Date().toISOString(),
  };
  ensureDir(join(projectRoot, WORKFLOWS_DIR));
  safeWriteFile(activePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * 활성 워크플로우를 초기화합니다.
 */
export function clearActiveWorkflow(projectRoot: string): void {
  const activePath = join(projectRoot, WORKFLOWS_DIR, ACTIVE_FILE);
  const data: ActiveWorkflow = { activeWorkflowId: null };
  ensureDir(join(projectRoot, WORKFLOWS_DIR));
  safeWriteFile(activePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * 워크플로우 인스턴스를 읽습니다.
 */
export function loadWorkflowInstance(projectRoot: string, workflowId: string): WorkflowInstance | null {
  try {
    const statePath = join(getWorkflowDir(projectRoot, workflowId), STATE_FILE);
    const content = readFileContent(statePath);
    if (!content) return null;
    return JSON.parse(content) as WorkflowInstance;
  } catch {
    return null;
  }
}

/**
 * 워크플로우 인스턴스를 저장합니다.
 */
export function saveWorkflowInstance(projectRoot: string, instance: WorkflowInstance): void {
  const dir = getWorkflowDir(projectRoot, instance.id);
  ensureDir(dir);
  const statePath = join(dir, STATE_FILE);
  safeWriteFile(statePath, JSON.stringify(instance, null, 2) + '\n');
}

/**
 * 워크플로우 히스토리를 읽습니다.
 */
export function loadWorkflowHistory(projectRoot: string, workflowId: string): WorkflowHistory | null {
  try {
    const historyPath = join(getWorkflowDir(projectRoot, workflowId), HISTORY_FILE);
    const content = readFileContent(historyPath);
    if (!content) return null;
    return JSON.parse(content) as WorkflowHistory;
  } catch {
    return null;
  }
}

/**
 * 히스토리에 이벤트를 추가합니다.
 */
export function appendHistoryEvent(projectRoot: string, workflowId: string, event: WorkflowEvent): void {
  const dir = getWorkflowDir(projectRoot, workflowId);
  ensureDir(dir);
  const historyPath = join(dir, HISTORY_FILE);

  let history: WorkflowHistory;
  try {
    const content = readFileContent(historyPath);
    if (content) {
      history = JSON.parse(content) as WorkflowHistory;
    } else {
      history = { workflowId, events: [] };
    }
  } catch {
    history = { workflowId, events: [] };
  }

  history.events.push(event);
  safeWriteFile(historyPath, JSON.stringify(history, null, 2) + '\n');
}

/**
 * 워크플로우 디렉토리 목록을 시간 역순으로 반환합니다.
 */
export function listWorkflowDirs(projectRoot: string, count = 10): string[] {
  try {
    const baseDir = join(projectRoot, WORKFLOWS_DIR);
    if (!existsSync(baseDir)) return [];

    const dirs = readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({
        name: d.name,
        mtime: statSync(join(baseDir, d.name)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .map((d) => d.name);

    return dirs.slice(0, count);
  } catch {
    return [];
  }
}
