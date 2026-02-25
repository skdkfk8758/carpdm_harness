import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { ValidatorResult, ValidationContext, CheckItem } from '../../../types/quality-gate.js';
import { BaseValidator } from './base.js';

export class UnifiedValidator extends BaseValidator {
  readonly criterion = 'unified' as const;
  readonly description = '코드 스타일 통일성 검증';

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const { projectRoot, targetFiles } = context;
    const checks: CheckItem[] = [];

    // 1. 포맷팅 일관성
    const formatter = this.detectFormatter(projectRoot);
    if (formatter) {
      const formattableFiles = targetFiles
        .filter(f => this.isFormattable(f))
        .map(f => f.startsWith('/') ? f : join(projectRoot, f));

      if (formattableFiles.length > 0) {
        const fileArgs = formattableFiles.join(' ');
        const result = this.execCommand(`${formatter.command} ${fileArgs}`, projectRoot);
        if (result.exitCode === 0) {
          checks.push({
            name: '포맷팅 일관성',
            passed: true,
            message: `${formatter.tool}: 포맷팅 일관성 확인됨`,
            severity: 'error',
          });
        } else {
          checks.push({
            name: '포맷팅 일관성',
            passed: false,
            message: `${formatter.tool}: 포맷팅 불일치 감지`,
            severity: 'error',
          });
        }
      }
    } else {
      checks.push({
        name: '포맷팅 일관성',
        passed: true,
        message: '포맷터 미설치 (prettier/biome 없음) - 건너뜀',
        severity: 'info',
      });
    }

    // 2. 임포트 순서 검증
    const tsJsFiles = targetFiles.filter(f => {
      const ext = extname(f);
      return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
    });

    let importOrderOk = true;
    const importIssueFiles: string[] = [];

    for (const file of tsJsFiles) {
      const absPath = file.startsWith('/') ? file : join(projectRoot, file);
      const content = this.readFileContent(absPath);
      if (content && !this.checkImportOrder(content)) {
        importOrderOk = false;
        importIssueFiles.push(file);
      }
    }

    if (tsJsFiles.length > 0) {
      checks.push({
        name: '임포트 순서',
        passed: importOrderOk,
        message: importOrderOk
          ? '임포트 순서 일관성 확인됨 (node: > 외부 > 내부 > relative)'
          : `임포트 순서 불일치: ${importIssueFiles.slice(0, 3).join(', ')}`,
        severity: 'warning',
      });
    }

    // 3. 프로젝트 구조 준수
    const configPath = join(projectRoot, 'carpdm-harness.config.json');
    const configContent = this.readFileContent(configPath);
    if (configContent) {
      try {
        const config = JSON.parse(configContent) as { options?: { docsTemplatesDir?: string; agentDir?: string } };
        const docsDir = config.options?.docsTemplatesDir;
        const agentDir = config.options?.agentDir;

        let structureOk = true;
        if (docsDir && !existsSync(join(projectRoot, docsDir))) {
          structureOk = false;
        }
        if (agentDir && !existsSync(join(projectRoot, agentDir))) {
          structureOk = false;
        }

        checks.push({
          name: '프로젝트 구조',
          passed: structureOk,
          message: structureOk
            ? '프로젝트 구조 설정 준수'
            : '프로젝트 구조 설정과 실제 디렉토리 불일치',
          severity: 'warning',
        });
      } catch {
        // config 파싱 실패 시 건너뜀
      }
    }

    // 4. EditorConfig 준수
    const editorConfigPath = join(projectRoot, '.editorconfig');
    if (existsSync(editorConfigPath)) {
      checks.push({
        name: 'EditorConfig',
        passed: true,
        message: '.editorconfig 존재',
        severity: 'info',
      });
    } else {
      checks.push({
        name: 'EditorConfig',
        passed: false,
        message: '.editorconfig 없음',
        severity: 'info',
      });
    }

    if (checks.length === 0) {
      checks.push({
        name: '통일성 검증',
        passed: true,
        message: '검증 대상 파일 없음',
        severity: 'info',
      });
    }

    return this.buildResult(checks);
  }

  /** 포맷터 자동 감지 */
  private detectFormatter(projectRoot: string): { tool: string; command: string } | null {
    if (existsSync(join(projectRoot, 'node_modules', '.bin', 'prettier'))) {
      return { tool: 'prettier', command: 'npx prettier --check' };
    }
    if (existsSync(join(projectRoot, 'node_modules', '.bin', 'biome'))) {
      return { tool: 'biome', command: 'npx biome format --check' };
    }
    return null;
  }

  /** 포맷 가능 파일 판별 */
  private isFormattable(file: string): boolean {
    const ext = extname(file);
    return ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.md'].includes(ext);
  }

  /** 임포트 순서 검증 (node: > 외부 > 내부 > relative) */
  private checkImportOrder(content: string): boolean {
    const importLines = content.split('\n').filter(line =>
      /^\s*import\s/.test(line) && line.includes('from'),
    );

    if (importLines.length < 2) return true;

    let lastGroup = 0;
    for (const line of importLines) {
      const fromMatch = line.match(/from\s+['"]([^'"]+)['"]/);
      if (!fromMatch) continue;

      const specifier = fromMatch[1];
      const group = this.getImportGroup(specifier);

      if (group < lastGroup) {
        return false;
      }
      lastGroup = group;
    }

    return true;
  }

  /** 임포트 그룹 분류 (0: node:, 1: 외부, 2: 내부(@/), 3: relative) */
  private getImportGroup(specifier: string): number {
    if (specifier.startsWith('node:')) return 0;
    if (specifier.startsWith('.')) return 3;
    if (specifier.startsWith('@/') || specifier.startsWith('~/')) return 2;
    return 1; // 외부 패키지
  }
}
