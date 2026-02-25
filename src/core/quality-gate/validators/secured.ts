import { join, extname } from 'node:path';
import type { ValidatorResult, ValidationContext, CheckItem } from '../../../types/quality-gate.js';
import { BaseValidator } from './base.js';

export class SecuredValidator extends BaseValidator {
  readonly criterion = 'secured' as const;
  readonly description = '보안 패턴 및 입력 검증 검사';

  /** 시크릿 탐지 정규식 패턴 */
  private readonly SECRET_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i, label: 'API 키' },
    { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i, label: '비밀번호' },
    { pattern: /(?:secret|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i, label: '시크릿/토큰' },
    { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: '개인 키' },
    { pattern: /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/, label: '서비스 키 (Stripe 등)' },
    { pattern: /ghp_[A-Za-z0-9]{36,}/, label: 'GitHub PAT' },
    { pattern: /xox[bpoas]-[A-Za-z0-9-]{10,}/, label: 'Slack 토큰' },
  ];

  /** SQL 인젝션 패턴 */
  private readonly SQL_INJECTION_PATTERNS: RegExp[] = [
    /['"`]\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b/i,
    /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.*['"`]\s*\+\s*\w+/i,
    /\$\{[^}]+\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b/i,
    /f['"].*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.*\{/i,
  ];

  /** eval/exec 패턴 */
  private readonly EVAL_PATTERNS: RegExp[] = [
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bexec\s*\(\s*[^)]*\+/,
  ];

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const { projectRoot, targetFiles } = context;
    const checks: CheckItem[] = [];

    // 1. 하드코딩된 시크릿 검사
    const secretFindings: { file: string; label: string }[] = [];
    for (const file of targetFiles) {
      if (this.shouldSkipFile(file)) continue;
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (!content) continue;

      for (const { pattern, label } of this.SECRET_PATTERNS) {
        if (pattern.test(content)) {
          secretFindings.push({ file, label });
          break; // 파일당 하나만 보고
        }
      }
    }

    if (secretFindings.length > 0) {
      checks.push({
        name: '시크릿 스캔',
        passed: false,
        message: `하드코딩된 시크릿 감지: ${secretFindings.map(f => `${f.file}(${f.label})`).slice(0, 3).join(', ')}`,
        severity: 'error',
      });
    } else {
      checks.push({
        name: '시크릿 스캔',
        passed: true,
        message: '하드코딩된 시크릿 미감지',
        severity: 'error',
      });
    }

    // 2. eval/exec 사용 감지
    const evalFindings: string[] = [];
    for (const file of targetFiles) {
      if (this.shouldSkipFile(file)) continue;
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (!content) continue;

      for (const pattern of this.EVAL_PATTERNS) {
        if (pattern.test(content)) {
          evalFindings.push(file);
          break;
        }
      }
    }

    if (evalFindings.length > 0) {
      checks.push({
        name: 'eval/exec 사용',
        passed: false,
        message: `동적 코드 실행 감지: ${evalFindings.slice(0, 3).join(', ')}`,
        severity: 'error',
      });
    } else {
      checks.push({
        name: 'eval/exec 사용',
        passed: true,
        message: '동적 코드 실행 미감지',
        severity: 'error',
      });
    }

    // 3. SQL 인젝션 패턴 감지
    const sqlFindings: string[] = [];
    for (const file of targetFiles) {
      if (this.shouldSkipFile(file)) continue;
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (!content) continue;

      for (const pattern of this.SQL_INJECTION_PATTERNS) {
        if (pattern.test(content)) {
          sqlFindings.push(file);
          break;
        }
      }
    }

    if (sqlFindings.length > 0) {
      checks.push({
        name: 'SQL 인젝션',
        passed: false,
        message: `문자열 연결 SQL 쿼리 감지: ${sqlFindings.slice(0, 3).join(', ')}`,
        severity: 'error',
      });
    } else {
      checks.push({
        name: 'SQL 인젝션',
        passed: true,
        message: 'SQL 인젝션 패턴 미감지',
        severity: 'error',
      });
    }

    // 4. 입력 검증 부재 (Zod/Joi 등 사용 여부)
    const handlerFiles = targetFiles.filter(f => this.isHandlerFile(f));
    if (handlerFiles.length > 0) {
      const validatedFiles: string[] = [];
      const unvalidatedFiles: string[] = [];

      for (const file of handlerFiles) {
        const absPath = file.startsWith('/') ? file : join(projectRoot, file);
        const content = this.readFileContent(absPath);
        if (!content) continue;

        const hasValidation = /\b(?:z\.|zod\.|Joi\.|yup\.|Pydantic|BaseModel|validate|validator)\b/.test(content);
        if (hasValidation) {
          validatedFiles.push(file);
        } else {
          unvalidatedFiles.push(file);
        }
      }

      if (unvalidatedFiles.length > 0) {
        checks.push({
          name: '입력 검증',
          passed: false,
          message: `입력 검증 미사용: ${unvalidatedFiles.slice(0, 3).join(', ')}`,
          severity: 'warning',
        });
      } else {
        checks.push({
          name: '입력 검증',
          passed: true,
          message: '핸들러 파일에서 입력 검증 확인됨',
          severity: 'warning',
        });
      }
    }

    // 5. 안전하지 않은 의존성 (npm audit)
    const pkgContent = this.readFileContent(join(projectRoot, 'package.json'));
    if (pkgContent) {
      const result = this.execCommand('npm audit --json 2>/dev/null', projectRoot);
      if (result.stdout) {
        try {
          const audit = JSON.parse(result.stdout) as {
            metadata?: { vulnerabilities?: { high?: number; critical?: number } };
          };
          const high = audit.metadata?.vulnerabilities?.high ?? 0;
          const critical = audit.metadata?.vulnerabilities?.critical ?? 0;
          if (high + critical > 0) {
            checks.push({
              name: '의존성 보안',
              passed: false,
              message: `취약 의존성: critical ${critical}개, high ${high}개`,
              severity: 'warning',
            });
          } else {
            checks.push({
              name: '의존성 보안',
              passed: true,
              message: 'high/critical 취약점 없음',
              severity: 'warning',
            });
          }
        } catch {
          checks.push({
            name: '의존성 보안',
            passed: true,
            message: 'npm audit 결과 파싱 실패 - 건너뜀',
            severity: 'info',
          });
        }
      }
    }

    if (checks.length === 0) {
      checks.push({
        name: '보안 검증',
        passed: true,
        message: '검증 대상 파일 없음',
        severity: 'info',
      });
    }

    return this.buildResult(checks);
  }

  /** 검증 제외 파일 판별 (.env, 설정, 바이너리 등) */
  private shouldSkipFile(file: string): boolean {
    const ext = extname(file);
    const skipExts = ['.json', '.md', '.yml', '.yaml', '.lock', '.svg', '.png', '.jpg', '.gif'];
    if (skipExts.includes(ext)) return true;
    if (file.includes('node_modules/')) return true;
    if (file.includes('.git/')) return true;
    // .env 파일은 의도적으로 검사 (시크릿 커밋 방지)
    return false;
  }

  /** 핸들러/엔드포인트 파일 판별 */
  private isHandlerFile(file: string): boolean {
    const patterns = [
      /route/i, /handler/i, /controller/i, /endpoint/i, /api\//i,
      /server\./i, /app\./i,
    ];
    return patterns.some(p => p.test(file));
  }
}
