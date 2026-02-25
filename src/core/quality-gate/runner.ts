import type {
  TrustReport,
  ValidationContext,
  QualityGateConfig,
  TrustCriterion,
  ValidatorResult,
} from '../../types/quality-gate.js';
import { TRUST_CRITERIA_ORDER, DEFAULT_QUALITY_GATE_CONFIG } from '../../types/quality-gate.js';
import { TestedValidator } from './validators/tested.js';
import { ReadableValidator } from './validators/readable.js';
import { UnifiedValidator } from './validators/unified.js';
import { SecuredValidator } from './validators/secured.js';
import { TrackableValidator } from './validators/trackable.js';
import type { BaseValidator } from './validators/base.js';

export class QualityGateRunner {
  private validators: BaseValidator[] = [
    new TestedValidator(),
    new ReadableValidator(),
    new UnifiedValidator(),
    new SecuredValidator(),
    new TrackableValidator(),
  ];

  async run(context: ValidationContext): Promise<TrustReport> {
    const config = context.config;
    const skip = config.skip ?? [];
    const activeValidators = this.getActiveValidators(skip);

    const results = {} as Record<TrustCriterion, ValidatorResult>;

    // skip된 기준은 기본 pass로 채움
    for (const criterion of TRUST_CRITERIA_ORDER) {
      if (skip.includes(criterion)) {
        results[criterion] = {
          criterion,
          passed: true,
          score: 100,
          checks: [],
          summary: `${criterion}: 건너뜀 (config.skip)`,
        };
      }
    }

    // 순차 실행 (도구 실행 충돌 방지)
    for (const validator of activeValidators) {
      try {
        results[validator.criterion] = await validator.validate(context);
      } catch (err: unknown) {
        results[validator.criterion] = {
          criterion: validator.criterion,
          passed: true,
          score: 0,
          checks: [{
            name: '검증 오류',
            passed: false,
            message: `검증기 실행 실패: ${String(err)}`,
            severity: 'warning',
          }],
          summary: `${validator.criterion}: 검증 실패 (오류)`,
        };
      }
    }

    const overallScore = this.calculateOverallScore(results);
    const overallPassed = TRUST_CRITERIA_ORDER.every(c => results[c].passed);
    const gateAction = this.determineAction(results, config);

    return {
      timestamp: new Date().toISOString(),
      projectRoot: context.projectRoot,
      targetFiles: context.targetFiles,
      results,
      overallPassed,
      overallScore,
      gateAction,
    };
  }

  /** config.skip에 포함된 기준 필터링 */
  private getActiveValidators(skip: TrustCriterion[]): BaseValidator[] {
    return this.validators.filter(v => !skip.includes(v.criterion));
  }

  /** 5개 결과를 종합하여 gateAction 결정 */
  private determineAction(
    results: Record<TrustCriterion, ValidatorResult>,
    config: QualityGateConfig,
  ): 'pass' | 'warn' | 'block' {
    if (config.mode === 'off') return 'pass';

    const thresholds = { ...DEFAULT_QUALITY_GATE_CONFIG.thresholds, ...config.thresholds };
    let hasFailure = false;
    let hasErrorFailure = false;

    for (const criterion of TRUST_CRITERIA_ORDER) {
      const result = results[criterion];
      if (!result) continue;

      const threshold = thresholds[criterion] ?? 60;
      if (result.score < threshold) {
        hasFailure = true;
      }

      // error 심각도 항목 중 실패가 있으면 block 후보
      const errorChecks = result.checks.filter(c => c.severity === 'error');
      if (errorChecks.some(c => !c.passed)) {
        hasErrorFailure = true;
      }
    }

    if (!hasFailure && !hasErrorFailure) return 'pass';

    if (config.mode === 'block' && hasErrorFailure) return 'block';
    if (config.mode === 'block' && hasFailure) return 'warn';

    // warn 모드
    return hasFailure || hasErrorFailure ? 'warn' : 'pass';
  }

  /** 전체 점수 계산 (5개 기준 평균) */
  private calculateOverallScore(results: Record<TrustCriterion, ValidatorResult>): number {
    const scores = TRUST_CRITERIA_ORDER.map(c => results[c]?.score ?? 0);
    const total = scores.reduce((sum, s) => sum + s, 0);
    return Math.round(total / TRUST_CRITERIA_ORDER.length);
  }
}
