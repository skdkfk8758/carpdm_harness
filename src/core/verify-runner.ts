import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { CheckItem, ValidationContext } from '../types/quality-gate.js';
import { DEFAULT_QUALITY_GATE_CONFIG } from '../types/quality-gate.js';
import type { VerifySkillMeta, VerifyCheck, VerifySkillResult, IntegratedVerifyReport } from '../types/verify.js';
import { QualityGateRunner } from './quality-gate/index.js';
import { scanVerifySkills } from './verify-skill-manager.js';

// === SKILL.md 파싱 ===

/** SKILL.md 본문에서 검사 항목(VerifyCheck[]) 파싱 */
export function parseVerifyChecks(skillMeta: VerifySkillMeta): VerifyCheck[] {
  try {
    const content = readFileSync(skillMeta.filePath, 'utf-8');
    // frontmatter 이후 본문
    const bodyMatch = content.match(/^---[\s\S]*?---\n([\s\S]*)$/);
    if (!bodyMatch) return [];

    const body = bodyMatch[1];
    const checks: VerifyCheck[] = [];

    // ### N. 검사명 (severity: error|warning|info) 패턴
    const checkPattern = /###\s+\d+\.\s+(.+?)\s+\(severity:\s*(error|warning|info)\)\s*\n([\s\S]*?)(?=###\s+\d+\.|## |$)/g;
    let match: RegExpExecArray | null;

    while ((match = checkPattern.exec(body)) !== null) {
      const name = match[1].trim();
      const severity = match[2] as 'error' | 'warning' | 'info';
      const block = match[3];

      const command = extractField(block, '탐지');
      const passCondition = extractField(block, 'PASS') ?? '';
      const failCondition = extractField(block, 'FAIL') ?? '';

      if (command) {
        checks.push({ name, severity, command, passCondition, failCondition });
      }
    }

    return checks;
  } catch {
    return [];
  }
}

/** 블록에서 "- 필드: `값`" 또는 "- 필드: 값" 추출 */
function extractField(block: string, field: string): string | null {
  const match = block.match(new RegExp(`-\\s+${field}:\\s*\`([^\`]+)\``, 'm'));
  if (match) return match[1];

  const plainMatch = block.match(new RegExp(`-\\s+${field}:\\s*(.+)$`, 'm'));
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

// === 단일 스킬 실행 ===

/** 단일 verify 스킬의 모든 검사 항목을 실행하고 결과 반환 */
export function runVerifySkill(
  projectRoot: string,
  skillMeta: VerifySkillMeta,
): VerifySkillResult {
  const checks = parseVerifyChecks(skillMeta);

  if (checks.length === 0) {
    return {
      skillName: skillMeta.name,
      passed: true,
      score: 100,
      checks: [],
    };
  }

  const results: CheckItem[] = [];

  for (const check of checks) {
    const result = executeCheck(projectRoot, check);
    results.push(result);
  }

  const errorChecks = results.filter(c => c.severity === 'error');
  const passed = errorChecks.length === 0 || errorChecks.every(c => c.passed);
  const passedCount = results.filter(c => c.passed).length;
  const score = results.length > 0 ? Math.round((passedCount / results.length) * 100) : 100;

  return {
    skillName: skillMeta.name,
    passed,
    score,
    checks: results,
  };
}

/** 단일 검사 항목 실행 */
function executeCheck(projectRoot: string, check: VerifyCheck): CheckItem {
  try {
    execSync(check.command, {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 8000,
    });

    return {
      name: check.name,
      passed: true,
      message: check.passCondition || '통과',
      severity: check.severity,
    };
  } catch (err: unknown) {
    const error = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    const stderr = error.stderr?.toString().slice(0, 200) ?? '';

    return {
      name: check.name,
      passed: false,
      message: check.failCondition
        ? `${check.failCondition}${stderr ? ` — ${stderr}` : ''}`
        : `exit code ${error.status ?? 1}`,
      severity: check.severity,
    };
  }
}

// === 통합 실행 ===

/** TRUST 5 + 프로젝트 커스텀 verify 스킬 통합 실행 */
export async function runIntegratedVerify(
  projectRoot: string,
  targetFiles: string[],
  options?: {
    skipTrust?: boolean;
    skipCustom?: boolean;
    trustConfig?: ValidationContext['config'];
  },
): Promise<IntegratedVerifyReport> {
  const { skipTrust = false, skipCustom = false, trustConfig } = options ?? {};

  // 1. TRUST 5 실행
  let trustReport;
  if (!skipTrust) {
    const runner = new QualityGateRunner();
    const context: ValidationContext = {
      projectRoot,
      targetFiles,
      config: trustConfig ?? DEFAULT_QUALITY_GATE_CONFIG,
      gitStagedFiles: targetFiles,
    };
    trustReport = await runner.run(context);
  } else {
    // skip 시 기본 pass 리포트
    trustReport = {
      timestamp: new Date().toISOString(),
      projectRoot,
      targetFiles,
      results: {} as IntegratedVerifyReport['trustReport']['results'],
      overallPassed: true,
      overallScore: 100,
      gateAction: 'pass' as const,
    };
  }

  // 2. 커스텀 verify 스킬 실행
  const verifyResults: VerifySkillResult[] = [];
  if (!skipCustom) {
    const skills = scanVerifySkills(projectRoot);
    for (const skill of skills) {
      const result = runVerifySkill(projectRoot, skill);
      verifyResults.push(result);
    }
  }

  // 3. 통합 점수 계산
  const trustScore = trustReport.overallScore;
  const verifyScore = verifyResults.length > 0
    ? Math.round(verifyResults.reduce((sum, r) => sum + r.score, 0) / verifyResults.length)
    : 100;

  // TRUST 70% + 커스텀 30% 가중 (커스텀 없으면 TRUST 100%)
  const overallScore = verifyResults.length > 0
    ? Math.round(trustScore * 0.7 + verifyScore * 0.3)
    : trustScore;

  const verifyPassed = verifyResults.every(r => r.passed);
  const overallPassed = trustReport.overallPassed && verifyPassed;

  return {
    timestamp: new Date().toISOString(),
    trustReport,
    verifyResults,
    overallPassed,
    overallScore,
  };
}
