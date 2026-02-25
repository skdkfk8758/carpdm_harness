import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { ValidatorResult, ValidationContext, CheckItem } from '../../../types/quality-gate.js';
import { BaseValidator } from './base.js';

export class ReadableValidator extends BaseValidator {
  readonly criterion = 'readable' as const;
  readonly description = '코드 가독성 및 린트 규칙 준수 검증';

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const { projectRoot, targetFiles } = context;
    const checks: CheckItem[] = [];

    // 1. 린트 에러 검증
    const lintTool = this.detectLintTool(projectRoot);
    if (lintTool) {
      const filesToLint = targetFiles.filter(f => this.isLintable(f));
      if (filesToLint.length > 0) {
        const absFiles = filesToLint.map(f => f.startsWith('/') ? f : join(projectRoot, f)).join(' ');
        const result = this.execCommand(`${lintTool.command} ${absFiles}`, projectRoot);
        if (result.exitCode === 0) {
          checks.push({
            name: '린트 검사',
            passed: true,
            message: `${lintTool.tool}: 에러 없음`,
            severity: 'error',
          });
        } else {
          const errorCount = this.countLintErrors(result.stdout, lintTool.tool);
          checks.push({
            name: '린트 검사',
            passed: false,
            message: `${lintTool.tool}: ${errorCount}개 에러 감지`,
            severity: 'error',
          });
        }
      }
    } else {
      checks.push({
        name: '린트 검사',
        passed: true,
        message: '린트 도구 미설치 (eslint/biome/ruff 없음) - 건너뜀',
        severity: 'info',
      });
    }

    // 2. 파일 길이 제한
    for (const file of targetFiles) {
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (content) {
        const lineCount = content.split('\n').length;
        if (lineCount > 300) {
          checks.push({
            name: '파일 길이',
            passed: false,
            message: `${file}: ${lineCount}줄 (300줄 초과)`,
            severity: 'warning',
            filePath: file,
          });
        }
      }
    }
    // 파일 길이 검사에서 경고 없으면 통과 항목 추가
    if (!checks.some(c => c.name === '파일 길이')) {
      checks.push({
        name: '파일 길이',
        passed: true,
        message: '모든 파일 300줄 이내',
        severity: 'warning',
      });
    }

    // 3. 함수 길이 제한 (간이 정규식 분석)
    const longFunctions: string[] = [];
    for (const file of targetFiles) {
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (content) {
        const found = this.detectLongFunctions(content, file);
        longFunctions.push(...found);
      }
    }
    if (longFunctions.length > 0) {
      checks.push({
        name: '함수 길이',
        passed: false,
        message: `50줄 초과 함수: ${longFunctions.slice(0, 3).join(', ')}${longFunctions.length > 3 ? ` 외 ${longFunctions.length - 3}개` : ''}`,
        severity: 'warning',
      });
    } else {
      checks.push({
        name: '함수 길이',
        passed: true,
        message: '50줄 초과 함수 없음',
        severity: 'warning',
      });
    }

    // 4. TODO/FIXME/HACK 잔존
    let markerCount = 0;
    for (const file of targetFiles) {
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (content) {
        const matches = content.match(/\b(TODO|FIXME|HACK|XXX)\b/g);
        if (matches) markerCount += matches.length;
      }
    }
    checks.push({
      name: 'TODO/FIXME/HACK',
      passed: markerCount === 0,
      message: markerCount === 0 ? '주석 마커 없음' : `${markerCount}개 주석 마커 발견`,
      severity: 'info',
    });

    // 5. 네이밍 규칙 (camelCase/snake_case 혼용 감지)
    const namingIssues: string[] = [];
    for (const file of targetFiles) {
      const ext = extname(file);
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (content) {
        const hasMixed = this.detectMixedNaming(content, ext);
        if (hasMixed) {
          namingIssues.push(file);
        }
      }
    }
    if (namingIssues.length > 0) {
      checks.push({
        name: '네이밍 규칙',
        passed: false,
        message: `camelCase/snake_case 혼용: ${namingIssues.slice(0, 3).join(', ')}`,
        severity: 'warning',
      });
    } else {
      checks.push({
        name: '네이밍 규칙',
        passed: true,
        message: '네이밍 일관성 양호',
        severity: 'warning',
      });
    }

    if (checks.length === 0) {
      checks.push({
        name: '가독성 검증',
        passed: true,
        message: '검증 대상 파일 없음',
        severity: 'info',
      });
    }

    return this.buildResult(checks);
  }

  /** 린트 도구 자동 감지 */
  private detectLintTool(projectRoot: string): { tool: string; command: string } | null {
    if (existsSync(join(projectRoot, 'node_modules', '.bin', 'eslint'))) {
      return { tool: 'eslint', command: 'npx eslint --format json --no-warn-ignored' };
    }
    if (existsSync(join(projectRoot, 'node_modules', '.bin', 'biome'))) {
      return { tool: 'biome', command: 'npx biome check --reporter=json' };
    }
    // ruff for Python
    const ruffResult = this.execCommand('which ruff', projectRoot);
    if (ruffResult.exitCode === 0) {
      return { tool: 'ruff', command: 'ruff check --format json' };
    }
    return null;
  }

  /** 린트 에러 카운트 추출 */
  private countLintErrors(stdout: string, tool: string): number {
    try {
      if (tool === 'eslint') {
        const parsed = JSON.parse(stdout) as Array<{ errorCount: number }>;
        return parsed.reduce((sum, f) => sum + f.errorCount, 0);
      }
      // 기본 폴백: 출력 줄 수 기반 추정
      return stdout.split('\n').filter(Boolean).length;
    } catch {
      return 1;
    }
  }

  /** 린트 가능 파일 판별 */
  private isLintable(file: string): boolean {
    const ext = extname(file);
    return ['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext);
  }

  /** 50줄 초과 함수 감지 (간이 분석) */
  private detectLongFunctions(content: string, file: string): string[] {
    const results: string[] = [];
    const lines = content.split('\n');
    const funcPattern = /^\s*(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{)/;

    let currentFunc: string | null = null;
    let funcStart = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!currentFunc) {
        const match = funcPattern.exec(line);
        if (match) {
          currentFunc = match[1] || match[2] || match[3] || 'anonymous';
          funcStart = i;
          braceDepth = 0;
        }
      }

      if (currentFunc) {
        for (const ch of line) {
          if (ch === '{') braceDepth++;
          if (ch === '}') braceDepth--;
        }

        if (braceDepth <= 0 && i > funcStart) {
          const length = i - funcStart + 1;
          if (length > 50) {
            results.push(`${file}:${currentFunc}(${length}줄)`);
          }
          currentFunc = null;
        }
      }
    }

    return results;
  }

  /** camelCase/snake_case 혼용 감지 */
  private detectMixedNaming(content: string, ext: string): boolean {
    // TypeScript/JavaScript: camelCase 기대
    const isTsJs = ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
    // Python: snake_case 기대
    const isPython = ext === '.py';

    if (!isTsJs && !isPython) return false;

    const varPattern = /(?:const|let|var|function)\s+(\w+)/g;
    const names: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(content)) !== null) {
      names.push(match[1]);
    }

    if (names.length < 3) return false;

    const camelCount = names.filter(n => /[a-z][A-Z]/.test(n)).length;
    const snakeCount = names.filter(n => /[a-z]_[a-z]/.test(n)).length;

    if (isTsJs && snakeCount > 0 && camelCount > 0) {
      // JS/TS에서 snake_case가 20% 이상이면 혼용으로 판단
      return snakeCount / names.length > 0.2;
    }
    if (isPython && camelCount > 0 && snakeCount > 0) {
      return camelCount / names.length > 0.2;
    }

    return false;
  }
}
