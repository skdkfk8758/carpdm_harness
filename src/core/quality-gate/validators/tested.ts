import { existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import type { ValidatorResult, ValidationContext, CheckItem } from '../../../types/quality-gate.js';
import { BaseValidator } from './base.js';

export class TestedValidator extends BaseValidator {
  readonly criterion = 'tested' as const;
  readonly description = '테스트 존재 여부 및 커버리지 힌트 검증';

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const { projectRoot, targetFiles } = context;
    const checks: CheckItem[] = [];

    // 1. 테스트 파일 존재 검증
    const sourceFiles = targetFiles.filter(f => this.isSourceFile(f));
    for (const sourceFile of sourceFiles) {
      const testFile = this.findTestFile(sourceFile, projectRoot);
      if (testFile) {
        checks.push({
          name: '테스트 파일 존재',
          passed: true,
          message: `${basename(sourceFile)} -> ${basename(testFile)}`,
          severity: 'error',
          filePath: sourceFile,
        });
      } else {
        checks.push({
          name: '테스트 파일 존재',
          passed: false,
          message: `${sourceFile}에 대응하는 테스트 파일 없음`,
          severity: 'error',
          filePath: sourceFile,
        });
      }
    }

    // 2. 테스트 명령어 실행 가능 여부
    const pkgPath = join(projectRoot, 'package.json');
    const pkgContent = this.readFileContent(pkgPath);
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent) as { scripts?: Record<string, string> };
        if (pkg.scripts?.test) {
          checks.push({
            name: '테스트 명령어',
            passed: true,
            message: `package.json scripts.test 존재`,
            severity: 'warning',
          });
        } else {
          checks.push({
            name: '테스트 명령어',
            passed: false,
            message: 'package.json에 test 스크립트 미정의',
            severity: 'warning',
          });
        }
      } catch {
        checks.push({
          name: '테스트 명령어',
          passed: false,
          message: 'package.json 파싱 실패',
          severity: 'warning',
        });
      }
    } else {
      // Python 프로젝트 등 확인
      const hasPytest = existsSync(join(projectRoot, 'pytest.ini'))
        || existsSync(join(projectRoot, 'pyproject.toml'))
        || existsSync(join(projectRoot, 'setup.cfg'));
      checks.push({
        name: '테스트 명령어',
        passed: hasPytest,
        message: hasPytest ? 'Python 테스트 설정 감지' : '테스트 설정 파일 없음',
        severity: 'warning',
      });
    }

    // 3. 커버리지 힌트
    const coverageDirs = [
      join(projectRoot, 'coverage'),
      join(projectRoot, '.harness', 'state'),
    ];
    const hasCoverage = coverageDirs.some(d => existsSync(d));
    checks.push({
      name: '커버리지 힌트',
      passed: hasCoverage,
      message: hasCoverage ? '커버리지 데이터 디렉토리 존재' : '커버리지 데이터 없음',
      severity: 'info',
    });

    // 4. TDD 순서 확인
    const tddOrderPath = join(projectRoot, '.harness', 'state', 'tdd-edit-order');
    if (existsSync(tddOrderPath)) {
      const orderContent = this.readFileContent(tddOrderPath);
      if (orderContent) {
        const lines = orderContent.trim().split('\n').filter(Boolean);
        const lastLines = lines.slice(-10);
        const hasTestFirst = lastLines.some((line, i) => {
          if (i === 0) return false;
          const prev = lastLines[i - 1];
          return prev.includes('test') && !line.includes('test');
        });
        checks.push({
          name: 'TDD 순서',
          passed: hasTestFirst,
          message: hasTestFirst ? 'TEST -> SOURCE 순서 확인됨' : 'TDD 순서 미확인 (SOURCE 우선 편집)',
          severity: 'warning',
        });
      }
    }

    // 소스 파일이 없으면 기본 통과
    if (checks.length === 0) {
      checks.push({
        name: '테스트 검증',
        passed: true,
        message: '검증 대상 소스 파일 없음',
        severity: 'info',
      });
    }

    return this.buildResult(checks);
  }

  /** 소스 파일인지 판별 (테스트/설정 파일 제외) */
  private isSourceFile(file: string): boolean {
    const ext = extname(file);
    const base = basename(file);
    const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
    if (!sourceExts.includes(ext)) return false;
    if (base.includes('.test.') || base.includes('.spec.') || base.startsWith('test_')) return false;
    if (base.includes('.config.') || base.includes('.d.ts')) return false;
    return true;
  }

  /** 소스 파일 -> 테스트 파일 매핑 */
  private findTestFile(sourceFile: string, projectRoot: string): string | null {
    const ext = extname(sourceFile);
    const base = basename(sourceFile, ext);
    const dir = dirname(sourceFile);

    // 같은 디렉토리에서 찾기
    const candidates = [
      join(projectRoot, dir, `${base}.test${ext}`),
      join(projectRoot, dir, `${base}.spec${ext}`),
      join(projectRoot, dir, `test_${base}${ext}`),
    ];

    // __tests__ 디렉토리에서 찾기
    candidates.push(
      join(projectRoot, dir, '__tests__', `${base}.test${ext}`),
      join(projectRoot, dir, '__tests__', `${base}.spec${ext}`),
    );

    // tests/ 루트 디렉토리에서 찾기
    candidates.push(
      join(projectRoot, 'tests', `${base}.test${ext}`),
      join(projectRoot, 'tests', `${base}.spec${ext}`),
      join(projectRoot, 'test', `${base}.test${ext}`),
      join(projectRoot, 'test', `${base}.spec${ext}`),
    );

    return candidates.find(c => existsSync(c)) ?? null;
  }
}
