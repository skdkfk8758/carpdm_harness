/**
 * Ralph-Todo Loop 비즈니스 로직
 *
 * Ralph Wiggum 알고리즘과 todo 태스크 실행을 통합하여
 * 에이전트가 각 태스크를 자동 반복하고 완료 시 다음 태스크로 전환합니다.
 *
 * 핵심 메커니즘:
 * - 완료 판단: todo.md의 [x] 체크 기반 (매 iteration마다 재파싱)
 * - 상태 파일: ralph-todo-state.json (기존 Ralph와 독립)
 * - session-end 훅에서 인라인으로 호출
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { todoSearchPaths } from './project-paths.js';
import { omcStatePath, omcGlobalStatePath } from './omc-compat.js';
import type {
  RalphTodoTask,
  RalphTodoState,
  RalphTodoParseResult,
  RalphTodoStartOptions,
} from '../types/ralph-todo.js';

// ============================================================
// 상수
// ============================================================

const DEFAULT_TASK_MAX_ITERATIONS = 15;
const DEFAULT_GLOBAL_MAX_ITERATIONS = 100;

// ============================================================
// Todo 파싱
// ============================================================

/**
 * todo.md를 파싱하여 체크박스 항목을 추출합니다.
 * 기존 implementation-readiness.ts의 [x]/[ ] 파싱 패턴을 재사용합니다.
 */
export function parseTodoTasks(projectRoot: string): RalphTodoParseResult | null {
  const paths = todoSearchPaths(projectRoot);

  for (const todoPath of paths) {
    if (!existsSync(todoPath)) continue;

    let content: string;
    try {
      content = readFileSync(todoPath, 'utf-8');
    } catch {
      continue;
    }

    const tasks: RalphTodoTask[] = [];
    let currentIndex = -1;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // [x] 또는 [ ] 체크박스 매칭
      const checkboxMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)/);
      if (!checkboxMatch) continue;

      const done = checkboxMatch[1].toLowerCase() === 'x';
      let text = checkboxMatch[2].trim();

      // ← CURRENT 마커 감지 및 제거
      const hasCurrent = /←\s*CURRENT/i.test(text);
      if (hasCurrent) {
        text = text.replace(/\s*←\s*CURRENT\s*/gi, '').trim();
        currentIndex = tasks.length;
      }

      tasks.push({ index: tasks.length, text, done });
    }

    if (tasks.length === 0) return null;

    return { tasks, source: todoPath, currentIndex };
  }

  return null;
}

/**
 * 첫 번째 미완료 태스크의 인덱스를 반환합니다.
 * CURRENT 마커가 있으면 해당 인덱스를 우선, 없으면 첫 번째 미완료 항목.
 */
export function findNextIncompleteTask(
  tasks: RalphTodoTask[],
  currentIndex: number,
  startFrom = 0,
): number {
  // CURRENT 마커가 있고 해당 태스크가 미완료이면 우선
  if (currentIndex >= 0 && currentIndex < tasks.length && !tasks[currentIndex].done) {
    return currentIndex;
  }

  // startFrom 이후 첫 번째 미완료 항목
  for (let i = startFrom; i < tasks.length; i++) {
    if (!tasks[i].done) return i;
  }

  // startFrom 이전도 검색 (wrap around)
  for (let i = 0; i < startFrom; i++) {
    if (!tasks[i].done) return i;
  }

  return -1; // 모두 완료
}

// ============================================================
// 프롬프트 생성
// ============================================================

/**
 * 태스크별 실행 프롬프트를 생성합니다.
 */
export function generateTaskPrompt(
  task: RalphTodoTask,
  taskIndex: number,
  totalTasks: number,
  taskIteration: number,
  taskMaxIterations: number,
): string {
  return `[RALPH-TODO: Task ${taskIndex + 1}/${totalTasks} | Iteration ${taskIteration + 1}/${taskMaxIterations}]

Current task: ${task.text}

INSTRUCTIONS:
1. Work on the task described above
2. When the task is complete, update todo.md: change \`[ ]\` to \`[x]\` for this item
3. Move the \`← CURRENT\` marker to the next incomplete item
4. The loop will automatically detect completion and advance to the next task

When ALL tasks are complete, run /oh-my-claudecode:cancel to exit the loop.
If stuck after multiple iterations, consider breaking the task into smaller steps.`;
}

// ============================================================
// 상태 관리
// ============================================================

/**
 * 상태 파일을 읽습니다 (로컬 → 글로벌 순서).
 */
export function readRalphTodoState(projectRoot: string): RalphTodoState | null {
  const localPath = omcStatePath(projectRoot, 'ralph-todo');
  const globalPath = omcGlobalStatePath('ralph-todo');

  for (const p of [localPath, globalPath]) {
    try {
      if (!existsSync(p)) continue;
      const data = JSON.parse(readFileSync(p, 'utf-8')) as RalphTodoState;
      if (data.mode === 'ralph-todo') return data;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * 상태 파일을 씁니다 (로컬 + 글로벌 양쪽).
 */
export function writeRalphTodoState(projectRoot: string, state: RalphTodoState): boolean {
  const localPath = omcStatePath(projectRoot, 'ralph-todo');
  const globalPath = omcGlobalStatePath('ralph-todo');

  let success = false;

  for (const p of [localPath, globalPath]) {
    try {
      const dir = dirname(p);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(p, JSON.stringify(state, null, 2));
      success = true;
    } catch {
      // 한쪽 실패해도 계속
    }
  }

  return success;
}

// ============================================================
// 루프 제어
// ============================================================

/**
 * Ralph-Todo 루프를 시작합니다.
 */
export function startRalphTodoLoop(
  projectRoot: string,
  sessionId: string,
  prompt: string,
  options?: RalphTodoStartOptions,
): { success: boolean; state?: RalphTodoState; message: string } {
  const parsed = parseTodoTasks(projectRoot);

  if (!parsed) {
    return {
      success: false,
      message: 'todo.md가 없거나 체크박스 항목이 없습니다. `/plan-gate`로 작업 계획을 먼저 수립하세요.',
    };
  }

  const incompleteTasks = parsed.tasks.filter(t => !t.done);
  if (incompleteTasks.length === 0) {
    return {
      success: false,
      message: '모든 항목이 완료되었습니다. 새 작업을 추가하거나 `/todo-update`로 갱신하세요.',
    };
  }

  const firstIndex = findNextIncompleteTask(parsed.tasks, parsed.currentIndex);
  if (firstIndex < 0) {
    return {
      success: false,
      message: '미완료 태스크를 찾을 수 없습니다.',
    };
  }

  const now = new Date().toISOString();
  const state: RalphTodoState = {
    active: true,
    mode: 'ralph-todo',
    session_id: sessionId || undefined,
    project_path: projectRoot,
    started_at: now,
    last_checked_at: now,
    todo_source: parsed.source,
    total_tasks: parsed.tasks.length,
    current_task_index: firstIndex,
    current_task_text: parsed.tasks[firstIndex].text,
    task_iteration: 0,
    task_max_iterations: options?.taskMaxIterations ?? DEFAULT_TASK_MAX_ITERATIONS,
    global_iteration: 0,
    global_max_iterations: options?.globalMaxIterations ?? DEFAULT_GLOBAL_MAX_ITERATIONS,
    original_prompt: prompt,
    reinforcement_count: 0,
    completed_task_indices: parsed.tasks.filter(t => t.done).map(t => t.index),
    skipped_task_indices: [],
  };

  const written = writeRalphTodoState(projectRoot, state);
  if (!written) {
    return {
      success: false,
      message: '상태 파일 생성에 실패했습니다.',
    };
  }

  return {
    success: true,
    state,
    message: `Ralph-Todo 루프를 시작합니다. ${incompleteTasks.length}개 미완료 태스크, 첫 번째: "${parsed.tasks[firstIndex].text}"`,
  };
}

/**
 * Ralph-Todo 루프를 취소합니다.
 */
export function cancelRalphTodoLoop(
  projectRoot: string,
): { success: boolean; message: string } {
  const state: RalphTodoState | null = readRalphTodoState(projectRoot);

  if (!state || !state.active) {
    return { success: true, message: 'Ralph-Todo 루프가 활성 상태가 아닙니다.' };
  }

  state.active = false;
  state.last_checked_at = new Date().toISOString();

  const written = writeRalphTodoState(projectRoot, state);
  return {
    success: written,
    message: written
      ? `Ralph-Todo 루프를 종료했습니다. 완료: ${state.completed_task_indices.length}, 건너뜀: ${state.skipped_task_indices.length}`
      : '상태 파일 갱신에 실패했습니다.',
  };
}

/**
 * Session-end에서 호출: 현재 태스크 상태를 확인하고 다음 동작을 결정합니다.
 *
 * @returns block 메시지 (계속해야 할 경우) 또는 null (종료해야 할 경우)
 */
export function checkAndAdvance(
  projectRoot: string,
  state: RalphTodoState,
): { action: 'block'; reason: string; updatedState: RalphTodoState } |
   { action: 'continue'; updatedState: RalphTodoState } {
  // todo.md 재파싱
  const parsed = parseTodoTasks(projectRoot);

  if (!parsed) {
    // todo.md 삭제됨 → 루프 종료
    state.active = false;
    state.last_checked_at = new Date().toISOString();
    return { action: 'continue', updatedState: state };
  }

  // 전체 iteration 상한 체크
  if (state.global_iteration >= state.global_max_iterations) {
    state.active = false;
    state.last_checked_at = new Date().toISOString();
    return { action: 'continue', updatedState: state };
  }

  const currentTask = parsed.tasks[state.current_task_index];

  // 현재 태스크가 [x] 완료됨
  if (currentTask && currentTask.done) {
    // 완료 기록
    if (!state.completed_task_indices.includes(state.current_task_index)) {
      state.completed_task_indices.push(state.current_task_index);
    }

    // 다음 미완료 태스크 찾기
    const nextIndex = findNextIncompleteTask(
      parsed.tasks,
      -1, // CURRENT 무시, 순차 탐색
      state.current_task_index + 1,
    );

    if (nextIndex < 0) {
      // 전체 완료
      state.active = false;
      state.last_checked_at = new Date().toISOString();
      return { action: 'continue', updatedState: state };
    }

    // 다음 태스크로 전환
    state.current_task_index = nextIndex;
    state.current_task_text = parsed.tasks[nextIndex].text;
    state.task_iteration = 0; // 태스크 리셋
    state.global_iteration += 1;
    state.total_tasks = parsed.tasks.length; // 재파싱 반영
    state.last_checked_at = new Date().toISOString();

    const prompt = generateTaskPrompt(
      parsed.tasks[nextIndex],
      nextIndex,
      parsed.tasks.length,
      0,
      state.task_max_iterations,
    );

    return {
      action: 'block',
      reason: prompt,
      updatedState: state,
    };
  }

  // 현재 태스크 미완료 → task_iteration 체크
  if (state.task_iteration >= state.task_max_iterations) {
    // 태스크별 iteration 초과 → skip 처리
    if (!state.skipped_task_indices.includes(state.current_task_index)) {
      state.skipped_task_indices.push(state.current_task_index);
    }

    // 다음 미완료 태스크 찾기 (현재 건너뛴 것 제외)
    const nextIndex = findNextIncompleteTask(
      parsed.tasks,
      -1,
      state.current_task_index + 1,
    );

    if (nextIndex < 0 || nextIndex === state.current_task_index) {
      // 더 이상 진행할 태스크 없음
      state.active = false;
      state.last_checked_at = new Date().toISOString();
      return { action: 'continue', updatedState: state };
    }

    // 다음 태스크로 전환
    state.current_task_index = nextIndex;
    state.current_task_text = parsed.tasks[nextIndex].text;
    state.task_iteration = 0;
    state.global_iteration += 1;
    state.total_tasks = parsed.tasks.length;
    state.last_checked_at = new Date().toISOString();

    const skipNotice = `[SKIPPED] Previous task exceeded ${state.task_max_iterations} iterations. Moving to next task.\n\n`;
    const prompt = generateTaskPrompt(
      parsed.tasks[nextIndex],
      nextIndex,
      parsed.tasks.length,
      0,
      state.task_max_iterations,
    );

    return {
      action: 'block',
      reason: skipNotice + prompt,
      updatedState: state,
    };
  }

  // 동일 태스크 계속 진행
  state.task_iteration += 1;
  state.global_iteration += 1;
  state.total_tasks = parsed.tasks.length;
  state.last_checked_at = new Date().toISOString();

  const prompt = generateTaskPrompt(
    currentTask || { index: state.current_task_index, text: state.current_task_text, done: false },
    state.current_task_index,
    parsed.tasks.length,
    state.task_iteration,
    state.task_max_iterations,
  );

  return {
    action: 'block',
    reason: prompt,
    updatedState: state,
  };
}
