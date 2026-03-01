/**
 * Plan/Todo 아카이브 시스템
 *
 * .agent/plan.md와 todo.md를 .agent/archive/에 보존합니다.
 * plan-gate 실행 시 기존 계획을 자동 아카이브하여 이력 소실을 방지합니다.
 *
 * 합본 포맷: plan + 구분자 + todo (하나의 .md 파일)
 * 구분자: <!-- ARCHIVE:SEPARATOR --> (고유 HTML 코멘트)
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { agentArchiveDir, agentPlanPath, agentTodoPath } from './project-paths.js';

// ============================================================
// Types
// ============================================================

export interface ArchiveResult {
  success: boolean;
  message: string;
  filename?: string;
}

export interface ArchiveEntry {
  filename: string;
  title: string;
  date: string;
}

// ============================================================
// Constants
// ============================================================

const SEPARATOR = '<!-- ARCHIVE:SEPARATOR -->';
const DEFAULT_MAX_ARCHIVES = 20;
const SLUG_MAX_LENGTH = 30;

// ============================================================
// Core Functions
// ============================================================

/**
 * 현재 plan.md (+ todo.md)를 아카이브합니다.
 *
 * - plan.md에서 제목 추출 → slug 생성
 * - plan + todo 합본 후 .agent/archive/에 저장
 * - 원본 plan.md/todo.md 삭제
 * - 아카이브 개수 제한 적용
 */
export function archivePlan(projectRoot: string): ArchiveResult {
  const planPath = agentPlanPath(projectRoot);

  if (!existsSync(planPath)) {
    return { success: false, message: 'plan.md가 존재하지 않습니다' };
  }

  let planContent: string;
  try {
    planContent = readFileSync(planPath, 'utf-8');
  } catch {
    return { success: false, message: 'plan.md 읽기 실패' };
  }

  if (!planContent.trim()) {
    return { success: false, message: 'plan.md가 비어있습니다' };
  }

  // todo.md는 선택 (없으면 빈 문자열)
  const todoPath = agentTodoPath(projectRoot);
  let todoContent = '';
  try {
    if (existsSync(todoPath)) {
      todoContent = readFileSync(todoPath, 'utf-8');
    }
  } catch {
    // todo 읽기 실패 — plan만 아카이브
  }

  // 제목 추출 (첫 번째 # 헤더)
  const title = extractTitle(planContent);
  const slug = buildSlug(title);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${date}_${slug}.md`;

  // 합본 생성
  const combined = todoContent.trim()
    ? `${planContent}\n\n${SEPARATOR}\n\n${todoContent}`
    : planContent;

  // .agent/archive/ 디렉토리 보장
  const archiveDir = agentArchiveDir(projectRoot);
  try {
    mkdirSync(archiveDir, { recursive: true });
  } catch {
    return { success: false, message: '.agent/archive/ 디렉토리 생성 실패' };
  }

  // 아카이브 저장
  const archivePath = join(archiveDir, filename);
  try {
    writeFileSync(archivePath, combined, 'utf-8');
  } catch {
    return { success: false, message: `아카이브 저장 실패: ${filename}` };
  }

  // 원본 삭제
  try {
    unlinkSync(planPath);
  } catch {
    // plan 삭제 실패 — 아카이브는 성공으로 처리
  }
  try {
    if (existsSync(todoPath)) {
      unlinkSync(todoPath);
    }
  } catch {
    // todo 삭제 실패 — 무시
  }

  // 개수 제한 적용
  enforceArchiveLimit(projectRoot, DEFAULT_MAX_ARCHIVES);

  return { success: true, message: `아카이브 완료: ${filename}`, filename };
}

/**
 * 아카이브 목록을 반환합니다 (최신순 정렬).
 */
export function listArchives(projectRoot: string): ArchiveEntry[] {
  const archiveDir = agentArchiveDir(projectRoot);

  if (!existsSync(archiveDir)) {
    return [];
  }

  let files: string[];
  try {
    files = readdirSync(archiveDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse(); // 최신순 (날짜 prefix 기준)
  } catch {
    return [];
  }

  return files.map(f => {
    const date = f.slice(0, 10); // YYYY-MM-DD
    const titleSlug = f.slice(11, -3); // _slug 부분 (.md 제거)
    return {
      filename: f,
      title: titleSlug.replace(/-/g, ' '),
      date,
    };
  });
}

/**
 * 아카이브를 복원합니다.
 *
 * - 현재 plan.md가 있으면 먼저 아카이브 후 복원
 * - 합본에서 구분자 기준으로 plan/todo 분리
 */
export function restoreArchive(projectRoot: string, filename: string): ArchiveResult {
  const archiveDir = agentArchiveDir(projectRoot);
  const archivePath = join(archiveDir, filename);

  if (!existsSync(archivePath)) {
    return { success: false, message: `아카이브를 찾을 수 없습니다: ${filename}` };
  }

  let content: string;
  try {
    content = readFileSync(archivePath, 'utf-8');
  } catch {
    return { success: false, message: `아카이브 읽기 실패: ${filename}` };
  }

  // 현재 plan.md가 있으면 먼저 아카이브
  const planPath = agentPlanPath(projectRoot);
  if (existsSync(planPath)) {
    const archiveFirst = archivePlan(projectRoot);
    if (!archiveFirst.success) {
      return { success: false, message: `기존 plan 아카이브 실패: ${archiveFirst.message}` };
    }
  }

  // 합본에서 plan/todo 분리
  const { plan, todo } = splitCombined(content);

  // .agent/ 디렉토리 보장
  try {
    mkdirSync(join(projectRoot, '.agent'), { recursive: true });
  } catch {
    return { success: false, message: '.agent/ 디렉토리 생성 실패' };
  }

  // plan.md 복원
  try {
    writeFileSync(planPath, plan, 'utf-8');
  } catch {
    return { success: false, message: 'plan.md 복원 실패' };
  }

  // todo.md 복원 (있는 경우만)
  if (todo) {
    const todoPath = agentTodoPath(projectRoot);
    try {
      writeFileSync(todoPath, todo, 'utf-8');
    } catch {
      // todo 복원 실패 — plan은 이미 복원됨
      return { success: true, message: `plan.md 복원 완료 (todo.md 복원 실패): ${filename}`, filename };
    }
  }

  return {
    success: true,
    message: todo
      ? `plan.md + todo.md 복원 완료: ${filename}`
      : `plan.md 복원 완료: ${filename}`,
    filename,
  };
}

/**
 * 아카이브 개수 제한을 적용합니다.
 * 파일명 정렬 (날짜 prefix) 기준으로 오래된 것부터 삭제합니다.
 */
export function enforceArchiveLimit(projectRoot: string, max: number = DEFAULT_MAX_ARCHIVES): number {
  const archiveDir = agentArchiveDir(projectRoot);

  if (!existsSync(archiveDir)) return 0;

  let files: string[];
  try {
    files = readdirSync(archiveDir)
      .filter(f => f.endsWith('.md'))
      .sort(); // 오래된 순
  } catch {
    return 0;
  }

  let deleted = 0;
  while (files.length > max) {
    const oldest = files.shift()!;
    try {
      unlinkSync(join(archiveDir, oldest));
      deleted++;
    } catch {
      // 삭제 실패 — 계속 진행
    }
  }

  return deleted;
}

// ============================================================
// Internal Helpers
// ============================================================

/** plan.md에서 첫 번째 # 헤더의 제목을 추출합니다 */
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'untitled';
}

/** 제목을 파일명에 안전한 slug로 변환합니다 */
function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '') // 안전하지 않은 문자 제거
    .replace(/\s+/g, '-')              // 공백 → 하이픈
    .replace(/-+/g, '-')               // 연속 하이픈 정리
    .replace(/^-|-$/g, '')             // 양쪽 하이픈 제거
    .slice(0, SLUG_MAX_LENGTH)         // 길이 제한
    || 'untitled';
}

/** 합본 파일을 plan과 todo로 분리합니다 */
function splitCombined(content: string): { plan: string; todo: string } {
  const idx = content.indexOf(SEPARATOR);
  if (idx === -1) {
    return { plan: content, todo: '' };
  }
  const plan = content.slice(0, idx).trimEnd();
  const todo = content.slice(idx + SEPARATOR.length).trimStart();
  return { plan, todo };
}
