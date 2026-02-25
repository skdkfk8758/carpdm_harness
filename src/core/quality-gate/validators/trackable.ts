import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ValidatorResult, ValidationContext, CheckItem } from '../../../types/quality-gate.js';
import { BaseValidator } from './base.js';

export class TrackableValidator extends BaseValidator {
  readonly criterion = 'trackable' as const;
  readonly description = '커밋 컨벤션 및 추적 가능성 검증';

  /** Conventional Commits 정규식 */
  private readonly CONVENTIONAL_COMMIT = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s.+/;

  /** 이슈 번호 정규식 */
  private readonly ISSUE_REF = /(?:#\d+|[A-Z]{2,}-\d+)/;

  /** 브랜치명 컨벤션 정규식 */
  private readonly BRANCH_CONVENTION = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|hotfix|release|main|master|develop|dev)\//;

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const { projectRoot } = context;
    const checks: CheckItem[] = [];

    // git 사용 가능 여부 확인
    const gitCheck = this.execCommand('git rev-parse --is-inside-work-tree', projectRoot);
    if (gitCheck.exitCode !== 0) {
      checks.push({
        name: 'Git 레포지토리',
        passed: true,
        message: 'Git 레포지토리 아님 - 추적 검증 건너뜀',
        severity: 'info',
      });
      return this.buildResult(checks);
    }

    // 1. 커밋 메시지 컨벤션
    const lastCommitResult = this.execCommand('git log -1 --format=%s', projectRoot);
    if (lastCommitResult.exitCode === 0 && lastCommitResult.stdout.trim()) {
      const commitMsg = lastCommitResult.stdout.trim();
      const isConventional = this.CONVENTIONAL_COMMIT.test(commitMsg);
      checks.push({
        name: '커밋 메시지 컨벤션',
        passed: isConventional,
        message: isConventional
          ? `Conventional Commits 형식 준수: "${commitMsg.slice(0, 50)}${commitMsg.length > 50 ? '...' : ''}"`
          : `Conventional Commits 미준수: "${commitMsg.slice(0, 50)}${commitMsg.length > 50 ? '...' : ''}"`,
        severity: 'error',
      });
    } else {
      checks.push({
        name: '커밋 메시지 컨벤션',
        passed: true,
        message: '커밋 이력 없음 - 건너뜀',
        severity: 'info',
      });
    }

    // 2. 이슈 참조
    const commitBody = this.execCommand('git log -1 --format=%B', projectRoot);
    const branchResult = this.execCommand('git branch --show-current', projectRoot);
    const branchName = branchResult.exitCode === 0 ? branchResult.stdout.trim() : '';

    if (commitBody.exitCode === 0) {
      const fullMsg = commitBody.stdout.trim();
      const hasIssueInCommit = this.ISSUE_REF.test(fullMsg);
      const hasIssueInBranch = this.ISSUE_REF.test(branchName);

      checks.push({
        name: '이슈 참조',
        passed: hasIssueInCommit || hasIssueInBranch,
        message: hasIssueInCommit
          ? '커밋 메시지에 이슈 번호 참조됨'
          : hasIssueInBranch
            ? '브랜치 이름에 이슈 번호 참조됨'
            : '커밋 메시지 및 브랜치에 이슈 번호 미참조',
        severity: 'warning',
      });
    }

    // 3. 변경 로그 기록
    const changeLogPath = join(projectRoot, '.harness', 'change-log.md');
    const changeLogExists = existsSync(changeLogPath);
    if (changeLogExists) {
      const content = this.readFileContent(changeLogPath);
      const hasRecentEntry = content ? content.length > 10 : false;
      checks.push({
        name: '변경 로그',
        passed: hasRecentEntry,
        message: hasRecentEntry
          ? '.harness/change-log.md 기록 존재'
          : '.harness/change-log.md 내용 부족',
        severity: 'info',
      });
    } else {
      checks.push({
        name: '변경 로그',
        passed: false,
        message: '.harness/change-log.md 없음',
        severity: 'info',
      });
    }

    // 4. 브랜치 네이밍
    if (branchName && branchName !== 'main' && branchName !== 'master' && branchName !== 'develop' && branchName !== 'dev') {
      const isConventionalBranch = this.BRANCH_CONVENTION.test(branchName);
      checks.push({
        name: '브랜치 네이밍',
        passed: isConventionalBranch,
        message: isConventionalBranch
          ? `브랜치명 컨벤션 준수: ${branchName}`
          : `브랜치명 컨벤션 미준수: ${branchName}`,
        severity: 'warning',
      });
    } else if (branchName) {
      checks.push({
        name: '브랜치 네이밍',
        passed: true,
        message: `기본 브랜치: ${branchName}`,
        severity: 'warning',
      });
    } else {
      checks.push({
        name: '브랜치 네이밍',
        passed: true,
        message: '브랜치명 감지 불가 (detached HEAD)',
        severity: 'info',
      });
    }

    if (checks.length === 0) {
      checks.push({
        name: '추적 검증',
        passed: true,
        message: '검증 항목 없음',
        severity: 'info',
      });
    }

    return this.buildResult(checks);
  }
}
