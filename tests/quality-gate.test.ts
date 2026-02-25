import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf-8')) as Record<string, unknown>;
}

describe('TRUST 5 품질 게이트 구조 검증', () => {
  // ─── 타입 파일 ───
  describe('타입 정의', () => {
    it('quality-gate.ts 타입 파일이 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/types/quality-gate.ts'))).toBe(true);
    });

    it('config.ts에 qualityGate 필드가 포함된다', () => {
      const content = readFileSync(join(ROOT, 'src/types/config.ts'), 'utf-8');
      expect(content).toContain('qualityGate');
      expect(content).toContain('QualityGateConfig');
    });
  });

  // ─── 검증기 파일 ───
  describe('5개 검증기', () => {
    const validators = ['tested', 'readable', 'unified', 'secured', 'trackable'];

    for (const name of validators) {
      it(`${name} 검증기 파일이 존재한다`, () => {
        expect(existsSync(join(ROOT, `src/core/quality-gate/validators/${name}.ts`))).toBe(true);
      });
    }

    it('base.ts 추상 클래스가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/quality-gate/validators/base.ts'))).toBe(true);
    });
  });

  // ─── 코어 파일 ───
  describe('코어 모듈', () => {
    it('runner.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/quality-gate/runner.ts'))).toBe(true);
    });

    it('index.ts 배럴 파일이 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/quality-gate/index.ts'))).toBe(true);
    });

    it('index.ts가 모든 검증기를 export한다', () => {
      const content = readFileSync(join(ROOT, 'src/core/quality-gate/index.ts'), 'utf-8');
      expect(content).toContain('QualityGateRunner');
      expect(content).toContain('BaseValidator');
      expect(content).toContain('TestedValidator');
      expect(content).toContain('ReadableValidator');
      expect(content).toContain('UnifiedValidator');
      expect(content).toContain('SecuredValidator');
      expect(content).toContain('TrackableValidator');
    });
  });

  // ─── MCP 도구 ───
  describe('MCP 도구', () => {
    it('quality-check.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/tools/quality-check.ts'))).toBe(true);
    });

    it('tools/index.ts에 registerQualityCheckTool이 등록되어 있다', () => {
      const content = readFileSync(join(ROOT, 'src/tools/index.ts'), 'utf-8');
      expect(content).toContain('registerQualityCheckTool');
      expect(content).toContain("./quality-check.js");
    });
  });

  // ─── 훅 ───
  describe('훅', () => {
    it('quality-gate.ts 훅 파일이 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/hooks/quality-gate.ts'))).toBe(true);
    });

    it('hooks/hooks.json에 Bash matcher PostToolUse 훅이 등록되어 있다', () => {
      const hooks = readJson('hooks/hooks.json');
      const h = hooks.hooks as Record<string, unknown[]>;
      const postToolUse = h.PostToolUse as Array<{ matcher: string; hooks: unknown[] }>;
      const bashHook = postToolUse.find(entry => entry.matcher === 'Bash');
      expect(bashHook).toBeDefined();
      const hookCmd = (bashHook!.hooks[0] as Record<string, unknown>).command as string;
      expect(hookCmd).toContain('quality-gate.js');
    });

    it('빌드된 quality-gate.js가 dist/hooks에 존재한다', () => {
      expect(existsSync(join(ROOT, 'dist/hooks/quality-gate.js'))).toBe(true);
    });
  });

  // ─── tsup 빌드 설정 ───
  describe('빌드 설정', () => {
    it('tsup.config.ts에 quality-gate entry가 포함된다', () => {
      const content = readFileSync(join(ROOT, 'tsup.config.ts'), 'utf-8');
      expect(content).toContain('src/hooks/quality-gate.ts');
    });
  });

  // ─── 템플릿 ───
  describe('템플릿', () => {
    it('trust-check.md 명령 템플릿이 존재한다', () => {
      expect(existsSync(join(ROOT, 'templates/quality/commands/trust-check.md'))).toBe(true);
    });

    it('module-manifest.json에 trust-check 명령이 등록되어 있다', () => {
      const manifest = readJson('templates/module-manifest.json');
      const modules = manifest.modules as Record<string, { commands: Array<{ source: string }> }>;
      const quality = modules.quality;
      expect(quality).toBeDefined();
      const trustCheck = quality.commands.find(c => c.source.includes('trust-check'));
      expect(trustCheck).toBeDefined();
    });
  });
});
