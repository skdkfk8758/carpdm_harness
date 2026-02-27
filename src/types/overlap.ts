/**
 * 중복 감지 시스템 타입 정의
 *
 * OMC/Serena/IDE 등 외부 플러그인과의 도구 중복, 빈 규칙 파일,
 * 비대한 권한 목록 등을 자동 감지하고 처리하기 위한 인터페이스.
 */

export type OverlapCategory =
  | 'empty-rules'          // 빈 .claude/rules/ 파일
  | 'lsp-tools'            // OMC LSP vs Serena
  | 'notepad-tools'        // OMC Notepad vs .agent/ 메모리
  | 'memory-tools'         // OMC Project Memory vs harness memory
  | 'python-repl'          // python_repl vs Bash
  | 'bloated-permissions'; // 와일드카드로 이미 커버되는 구체적 allow 항목

export type OverlapAction = 'disable' | 'keep' | 'delete';
export type OverlapSeverity = 'high' | 'medium' | 'low';

export interface OverlapItem {
  id: string;
  category: OverlapCategory;
  severity: OverlapSeverity;
  title: string;
  description: string;
  affectedItems: string[];      // 도구명 또는 파일 경로
  recommended: OverlapAction;
}

export interface OverlapScanResult {
  totalOverlaps: number;
  items: OverlapItem[];
}

/** 사용자 선택 (harness_init/update에 전달) */
export interface OverlapChoices {
  decisions: Record<string, OverlapAction>;  // overlapId -> action
  applyDefaults?: boolean;                   // 모든 권장 설정 적용
}

/** config에 저장 (업데이트 시 재사용) */
export interface OverlapPreferences {
  lastOptimizedAt?: string;
  decisions: Record<string, OverlapAction>;
}

/** 적용 결과 */
export interface ApplyResult {
  applied: number;
  skipped: number;
  errors: string[];
  details: ApplyDetail[];
}

export interface ApplyDetail {
  overlapId: string;
  action: OverlapAction;
  success: boolean;
  message: string;
}
