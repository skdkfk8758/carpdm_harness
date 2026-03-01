import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseTodoTasks,
  findNextIncompleteTask,
  generateTaskPrompt,
  startRalphTodoLoop,
  cancelRalphTodoLoop,
  checkAndAdvance,
  writeRalphTodoState,
} from '../../src/core/ralph-todo-loop.js';
import type { RalphTodoState } from '../../src/types/ralph-todo.js';

describe('ralph-todo-loop', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-ralph-todo-'));
    // .agent 디렉토리 생성
    mkdirSync(join(testDir, '.agent'), { recursive: true });
    // .omc/state 디렉토리 생성
    mkdirSync(join(testDir, '.omc', 'state'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ============================================================
  // parseTodoTasks
  // ============================================================

  describe('parseTodoTasks', () => {
    it('should parse checkbox items from .agent/todo.md', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `# Todo

- [x] Step 1: 타입 정의
- [ ] Step 2: 코어 로직 구현
- [ ] Step 3: 테스트 작성
`,
      );

      const result = parseTodoTasks(testDir);
      expect(result).not.toBeNull();
      expect(result!.tasks).toHaveLength(3);
      expect(result!.tasks[0]).toEqual({ index: 0, text: 'Step 1: 타입 정의', done: true });
      expect(result!.tasks[1]).toEqual({ index: 1, text: 'Step 2: 코어 로직 구현', done: false });
      expect(result!.tasks[2]).toEqual({ index: 2, text: 'Step 3: 테스트 작성', done: false });
      expect(result!.currentIndex).toBe(-1);
    });

    it('should detect ← CURRENT marker', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [ ] Step 2: 진행 중 ← CURRENT
- [ ] Step 3: 대기
`,
      );

      const result = parseTodoTasks(testDir);
      expect(result).not.toBeNull();
      expect(result!.currentIndex).toBe(1);
      expect(result!.tasks[1].text).toBe('Step 2: 진행 중');
    });

    it('should return null for empty todo.md', () => {
      writeFileSync(join(testDir, '.agent', 'todo.md'), '# Empty\n\nNo tasks here.\n');
      const result = parseTodoTasks(testDir);
      expect(result).toBeNull();
    });

    it('should return null when no todo.md exists', () => {
      const result = parseTodoTasks(testDir);
      expect(result).toBeNull();
    });

    it('should fallback to root todo.md', () => {
      writeFileSync(
        join(testDir, 'todo.md'),
        `- [ ] Root task 1
- [ ] Root task 2
`,
      );

      const result = parseTodoTasks(testDir);
      expect(result).not.toBeNull();
      expect(result!.tasks).toHaveLength(2);
      expect(result!.source).toBe(join(testDir, 'todo.md'));
    });

    it('should handle case-insensitive [X]', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [X] Done task
- [ ] Pending task
`,
      );

      const result = parseTodoTasks(testDir);
      expect(result).not.toBeNull();
      expect(result!.tasks[0].done).toBe(true);
      expect(result!.tasks[1].done).toBe(false);
    });
  });

  // ============================================================
  // findNextIncompleteTask
  // ============================================================

  describe('findNextIncompleteTask', () => {
    const tasks = [
      { index: 0, text: 'Task 0', done: true },
      { index: 1, text: 'Task 1', done: false },
      { index: 2, text: 'Task 2', done: true },
      { index: 3, text: 'Task 3', done: false },
    ];

    it('should prioritize CURRENT marker', () => {
      expect(findNextIncompleteTask(tasks, 3)).toBe(3);
    });

    it('should find first incomplete from startFrom', () => {
      expect(findNextIncompleteTask(tasks, -1, 2)).toBe(3);
    });

    it('should wrap around if needed', () => {
      expect(findNextIncompleteTask(tasks, -1, 4)).toBe(1);
    });

    it('should return -1 when all done', () => {
      const allDone = [
        { index: 0, text: 'Done 1', done: true },
        { index: 1, text: 'Done 2', done: true },
      ];
      expect(findNextIncompleteTask(allDone, -1)).toBe(-1);
    });

    it('should not prioritize CURRENT if task is done', () => {
      expect(findNextIncompleteTask(tasks, 0)).toBe(1);
    });
  });

  // ============================================================
  // generateTaskPrompt
  // ============================================================

  describe('generateTaskPrompt', () => {
    it('should include task info and iteration counts', () => {
      const task = { index: 2, text: 'API 엔드포인트 구현', done: false };
      const prompt = generateTaskPrompt(task, 2, 5, 3, 15);

      expect(prompt).toContain('Task 3/5');
      expect(prompt).toContain('Iteration 4/15');
      expect(prompt).toContain('API 엔드포인트 구현');
      expect(prompt).toContain('[x]');
    });
  });

  // ============================================================
  // startRalphTodoLoop
  // ============================================================

  describe('startRalphTodoLoop', () => {
    it('should start loop with first incomplete task', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [ ] Step 2: 시작할 항목
- [ ] Step 3: 대기
`,
      );

      const result = startRalphTodoLoop(testDir, 'test-session', 'todo loop 시작');
      expect(result.success).toBe(true);
      expect(result.state).toBeDefined();
      expect(result.state!.current_task_index).toBe(1);
      expect(result.state!.current_task_text).toBe('Step 2: 시작할 항목');
      expect(result.state!.active).toBe(true);
      expect(result.state!.mode).toBe('ralph-todo');
      expect(result.state!.completed_task_indices).toEqual([0]);
    });

    it('should respect CURRENT marker', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [ ] Step 1: 첫 번째
- [ ] Step 2: 여기서 시작 ← CURRENT
- [ ] Step 3: 대기
`,
      );

      const result = startRalphTodoLoop(testDir, 'test-session', 'start');
      expect(result.success).toBe(true);
      expect(result.state!.current_task_index).toBe(1);
    });

    it('should fail when no todo.md exists', () => {
      const result = startRalphTodoLoop(testDir, 'test-session', 'start');
      expect(result.success).toBe(false);
      expect(result.message).toContain('todo.md');
    });

    it('should fail when all tasks are done', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [x] Step 2: 완료
`,
      );

      const result = startRalphTodoLoop(testDir, 'test-session', 'start');
      expect(result.success).toBe(false);
      expect(result.message).toContain('완료');
    });

    it('should accept custom iteration limits', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [ ] Step 1: 작업
`,
      );

      const result = startRalphTodoLoop(testDir, 'test-session', 'start', {
        taskMaxIterations: 20,
        globalMaxIterations: 50,
      });
      expect(result.success).toBe(true);
      expect(result.state!.task_max_iterations).toBe(20);
      expect(result.state!.global_max_iterations).toBe(50);
    });
  });

  // ============================================================
  // cancelRalphTodoLoop
  // ============================================================

  describe('cancelRalphTodoLoop', () => {
    it('should deactivate the loop', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [ ] Step 1: 작업
`,
      );

      startRalphTodoLoop(testDir, 'test-session', 'start');
      const result = cancelRalphTodoLoop(testDir);
      expect(result.success).toBe(true);
      expect(result.message).toContain('종료');
    });

    it('should handle no active loop gracefully', () => {
      const result = cancelRalphTodoLoop(testDir);
      expect(result.success).toBe(true);
      expect(result.message).toContain('활성 상태가 아닙니다');
    });
  });

  // ============================================================
  // checkAndAdvance
  // ============================================================

  describe('checkAndAdvance', () => {
    function makeState(overrides: Partial<RalphTodoState> = {}): RalphTodoState {
      return {
        active: true,
        mode: 'ralph-todo',
        session_id: 'test-session',
        project_path: testDir,
        started_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        todo_source: join(testDir, '.agent', 'todo.md'),
        total_tasks: 3,
        current_task_index: 1,
        current_task_text: 'Step 2: 진행 중',
        task_iteration: 0,
        task_max_iterations: 15,
        global_iteration: 0,
        global_max_iterations: 100,
        original_prompt: 'todo loop',
        reinforcement_count: 0,
        completed_task_indices: [0],
        skipped_task_indices: [],
        ...overrides,
      };
    }

    it('should advance to next task when current is done', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [x] Step 2: 방금 완료
- [ ] Step 3: 다음 작업
`,
      );

      const state = makeState({ current_task_index: 1 });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('block');
      if (result.action === 'block') {
        expect(result.reason).toContain('Step 3: 다음 작업');
        expect(result.updatedState.current_task_index).toBe(2);
        expect(result.updatedState.task_iteration).toBe(0);
        expect(result.updatedState.completed_task_indices).toContain(1);
      }
    });

    it('should continue same task when not done', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [ ] Step 2: 진행 중
- [ ] Step 3: 대기
`,
      );

      const state = makeState({ current_task_index: 1, task_iteration: 3 });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('block');
      if (result.action === 'block') {
        expect(result.updatedState.current_task_index).toBe(1);
        expect(result.updatedState.task_iteration).toBe(4);
      }
    });

    it('should complete loop when all tasks are done', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [x] Step 2: 완료
- [x] Step 3: 완료
`,
      );

      const state = makeState({ current_task_index: 2 });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('continue');
      expect(result.updatedState.active).toBe(false);
    });

    it('should skip task when task iteration limit exceeded', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [ ] Step 2: 막힌 태스크
- [ ] Step 3: 다음
`,
      );

      const state = makeState({
        current_task_index: 1,
        task_iteration: 15,
        task_max_iterations: 15,
      });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('block');
      if (result.action === 'block') {
        expect(result.reason).toContain('SKIPPED');
        expect(result.updatedState.current_task_index).toBe(2);
        expect(result.updatedState.skipped_task_indices).toContain(1);
      }
    });

    it('should terminate when global iteration limit exceeded', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [ ] Step 1: 작업
`,
      );

      const state = makeState({
        current_task_index: 0,
        global_iteration: 100,
        global_max_iterations: 100,
      });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('continue');
      expect(result.updatedState.active).toBe(false);
    });

    it('should handle deleted todo.md gracefully', () => {
      // todo.md가 없음
      const state = makeState();
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('continue');
      expect(result.updatedState.active).toBe(false);
    });

    it('should reflect dynamically added tasks', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [x] Step 2: 방금 완료
- [ ] Step 3: 기존 태스크
- [ ] Step 4: 새로 추가된 태스크
`,
      );

      const state = makeState({
        current_task_index: 1,
        total_tasks: 3, // 원래 3개였음
      });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('block');
      if (result.action === 'block') {
        expect(result.updatedState.total_tasks).toBe(4); // 재파싱으로 4개 반영
      }
    });

    it('should terminate when skip leaves no more tasks', () => {
      writeFileSync(
        join(testDir, '.agent', 'todo.md'),
        `- [x] Step 1: 완료
- [ ] Step 2: 유일한 미완료 (iteration 초과)
`,
      );

      const state = makeState({
        current_task_index: 1,
        task_iteration: 15,
        task_max_iterations: 15,
      });
      const result = checkAndAdvance(testDir, state);

      expect(result.action).toBe('continue');
      expect(result.updatedState.active).toBe(false);
    });
  });
});
