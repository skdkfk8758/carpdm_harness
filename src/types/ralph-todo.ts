/**
 * Ralph-Todo Loop 타입 정의
 *
 * Ralph Wiggum 알고리즘과 todo 태스크 실행을 통합하는
 * 자기참조 루프의 상태와 태스크 모델을 정의합니다.
 */

/** todo.md 내 개별 체크박스 항목 */
export interface RalphTodoTask {
  /** 0-based 인덱스 (todo.md 내 체크박스 순서) */
  index: number;
  /** 태스크 텍스트 (예: "Step 3: API 엔드포인트 구현") */
  text: string;
  /** [x] 완료 여부 */
  done: boolean;
}

/** Ralph-Todo Loop 상태 파일 (ralph-todo-state.json) */
export interface RalphTodoState {
  active: boolean;
  mode: 'ralph-todo';
  session_id?: string;
  project_path?: string;
  started_at: string;
  last_checked_at: string;

  /** todo.md 소스 경로 (예: ".agent/todo.md") */
  todo_source: string;
  /** 전체 태스크 수 */
  total_tasks: number;

  /** 현재 태스크 인덱스 (0-based) */
  current_task_index: number;
  /** 현재 태스크 텍스트 */
  current_task_text: string;

  /** 현재 태스크 내 반복 횟수 */
  task_iteration: number;
  /** 태스크별 최대 반복 (기본 15) */
  task_max_iterations: number;
  /** 전체 반복 횟수 */
  global_iteration: number;
  /** 전체 최대 반복 (기본 100) */
  global_max_iterations: number;

  /** 원본 프롬프트 */
  original_prompt: string;
  /** 강화 횟수 (session-end block 카운터) */
  reinforcement_count: number;

  /** 완료된 태스크 인덱스 목록 */
  completed_task_indices: number[];
  /** iteration 초과로 건너뛴 태스크 인덱스 목록 */
  skipped_task_indices: number[];
}

/** todo 파싱 결과 */
export interface RalphTodoParseResult {
  /** 파싱된 태스크 목록 */
  tasks: RalphTodoTask[];
  /** todo.md 소스 경로 */
  source: string;
  /** ← CURRENT 마커가 있는 태스크의 인덱스 (-1이면 없음) */
  currentIndex: number;
}

/** Ralph-Todo Loop 시작 옵션 */
export interface RalphTodoStartOptions {
  /** 태스크별 최대 반복 (기본 15) */
  taskMaxIterations?: number;
  /** 전체 최대 반복 (기본 100) */
  globalMaxIterations?: number;
}
