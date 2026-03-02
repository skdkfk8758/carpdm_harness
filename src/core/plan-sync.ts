/**
 * Claude Code plan mode ↔ .agent/plan.md 동기화 유틸리티
 *
 * - session-end 시: 최신 plan mode 결과를 .agent/plan.md로 동기화 (DRAFT)
 * - ~/.claude/plans/ 오래된 파일 자동 정리
 * - .agent/plan.md가 APPROVED/IN_PROGRESS이면 절대 덮어쓰지 않음
 */
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { agentPlanPath } from './project-paths.js';

const CLAUDE_PLANS_DIR = join(homedir(), '.claude', 'plans');

/**
 * Claude Code plan mode에서 생성된 최신 plan → .agent/plan.md 동기화
 * - .agent/plan.md가 APPROVED/IN_PROGRESS이면 덮어쓰지 않음 (보호)
 * - 현재 세션에서 수정된 plan만 대상 (1시간 이내)
 */
export function syncPlanFromClaudeCode(
  projectRoot: string,
): { synced: boolean; source?: string } {
  if (!existsSync(CLAUDE_PLANS_DIR)) return { synced: false };

  // 최근 1시간 내 수정된 plan 파일 찾기
  const cutoff = Date.now() - 3_600_000;
  const planFiles = readdirSync(CLAUDE_PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, mtime: statSync(join(CLAUDE_PLANS_DIR, f)).mtimeMs }))
    .filter(f => f.mtime > cutoff)
    .sort((a, b) => b.mtime - a.mtime);

  if (planFiles.length === 0) return { synced: false };

  // .agent/plan.md가 APPROVED/IN_PROGRESS이면 보호
  const planPath = agentPlanPath(projectRoot);
  if (existsSync(planPath)) {
    const existing = readFileSync(planPath, 'utf-8');
    if (/APPROVED|IN_PROGRESS/.test(existing)) {
      return { synced: false };
    }
  }

  // 최신 plan 읽기 + harness 포맷으로 래핑
  const latestFile = planFiles[0].name;
  const content = readFileSync(join(CLAUDE_PLANS_DIR, latestFile), 'utf-8');
  const now = new Date().toISOString().slice(0, 10);

  const wrapped = `# Plan: (Claude Code plan mode에서 동기화됨)\n\n> 상태: DRAFT\n> 동기화: ${now}\n> 원본: ~/.claude/plans/${latestFile}\n\n${content}\n`;

  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, wrapped, 'utf-8');
  return { synced: true, source: latestFile };
}

/**
 * ~/.claude/plans/ 내 오래된 plan 파일 정리
 * @param maxAgeDays 기본 7일
 */
export function cleanupStalePlans(maxAgeDays = 7): number {
  if (!existsSync(CLAUDE_PLANS_DIR)) return 0;

  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const files = readdirSync(CLAUDE_PLANS_DIR).filter(f => f.endsWith('.md'));
  let removed = 0;

  for (const f of files) {
    const fpath = join(CLAUDE_PLANS_DIR, f);
    try {
      if (statSync(fpath).mtimeMs < cutoff) {
        unlinkSync(fpath);
        removed++;
      }
    } catch {
      // 삭제 실패 무시
    }
  }
  return removed;
}
