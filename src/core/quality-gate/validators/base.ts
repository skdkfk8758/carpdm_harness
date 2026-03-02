import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ValidatorResult, ValidationContext, TrustCriterion, CheckItem } from '../../../types/quality-gate.js';

export abstract class BaseValidator {
  abstract readonly criterion: TrustCriterion;
  abstract readonly description: string;

  abstract validate(context: ValidationContext): Promise<ValidatorResult>;

  /** 공통 결과 빌더 헬퍼 */
  protected buildResult(checks: CheckItem[]): ValidatorResult {
    const passed = checks.filter(c => c.severity === 'error').every(c => c.passed);
    const total = checks.length;
    const passedCount = checks.filter(c => c.passed).length;
    const score = total > 0 ? Math.round((passedCount / total) * 100) : 0;

    return {
      criterion: this.criterion,
      passed,
      score,
      checks,
      summary: `${this.criterion}: ${passedCount}/${total} 항목 통과 (${score}점)`,
    };
  }

  /** 파일 내용 읽기 (실패 시 null) */
  protected readFileContent(filePath: string): string | null {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /** 명령어 실행 래퍼 (graceful degradation, execFileSync 기반) */
  protected execCommand(command: string, cwd: string): { stdout: string; exitCode: number } {
    try {
      const parts = command.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      if (!cmd) return { stdout: '', exitCode: 1 };
      const stdout = execFileSync(cmd, args, { cwd, stdio: 'pipe', timeout: 8000 }).toString();
      return { stdout, exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: Buffer; status?: number };
      return {
        stdout: error.stdout ? error.stdout.toString() : '',
        exitCode: error.status ?? 1,
      };
    }
  }
}
