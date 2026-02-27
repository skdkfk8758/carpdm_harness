import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf-8')) as Record<string, unknown>;
}

describe('플러그인 구조 검증', () => {
  // ─── plugin.json ───
  describe('.claude-plugin/plugin.json', () => {
    it('파일이 존재한다', () => {
      expect(existsSync(join(ROOT, '.claude-plugin/plugin.json'))).toBe(true);
    });

    it('필수 필드를 포함한다', () => {
      const plugin = readJson('.claude-plugin/plugin.json');
      expect(plugin).toHaveProperty('name', 'carpdm-harness');
      expect(plugin).toHaveProperty('version');
      expect(plugin).toHaveProperty('description');
      expect(plugin).toHaveProperty('author');
      expect(plugin).toHaveProperty('skills');
      expect(plugin).toHaveProperty('mcpServers');
    });
  });

  // ─── marketplace.json ───
  describe('.claude-plugin/marketplace.json', () => {
    it('파일이 존재한다', () => {
      expect(existsSync(join(ROOT, '.claude-plugin/marketplace.json'))).toBe(true);
    });

    it('스키마가 올바르다', () => {
      const mkt = readJson('.claude-plugin/marketplace.json');
      expect(mkt).toHaveProperty('name');
      expect(mkt).toHaveProperty('plugins');
      expect(Array.isArray(mkt.plugins)).toBe(true);
      const plugins = mkt.plugins as unknown[];
      expect(plugins.length).toBeGreaterThan(0);
      const first = plugins[0] as Record<string, unknown>;
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('version');
      expect(first).toHaveProperty('category');
    });
  });

  // ─── mcpServers 외부 참조 검증 ───
  describe('plugin.json mcpServers', () => {
    it('mcpServers가 .mcp.json을 참조한다', () => {
      const plugin = readJson('.claude-plugin/plugin.json');
      expect(plugin.mcpServers).toBe('./.mcp.json');
    });

    it('.mcp.json 파일이 존재하고 ${CLAUDE_PLUGIN_ROOT}를 사용한다', () => {
      const mcpPath = join(ROOT, '.mcp.json');
      expect(existsSync(mcpPath)).toBe(true);
      const content = readFileSync(mcpPath, 'utf-8');
      expect(content).toContain('${CLAUDE_PLUGIN_ROOT}');
      const mcp = JSON.parse(content);
      expect(mcp.mcpServers).toHaveProperty('carpdm-harness');
    });
  });

  // ─── skills/ ───
  describe('skills/ 디렉토리', () => {
    it('25개의 SKILL.md 파일이 존재한다', () => {
      const skillsDir = join(ROOT, 'skills');
      expect(existsSync(skillsDir)).toBe(true);
      const skillFiles = readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => join(skillsDir, d.name, 'SKILL.md'))
        .filter(p => existsSync(p));
      expect(skillFiles.length).toBe(27);
    });
  });

  // ─── hooks/hooks.json ───
  describe('hooks/hooks.json', () => {
    it('파일이 존재한다', () => {
      expect(existsSync(join(ROOT, 'hooks/hooks.json'))).toBe(true);
    });

    it('8개 훅 이벤트를 포함한다', () => {
      const hooks = readJson('hooks/hooks.json');
      expect(hooks).toHaveProperty('hooks');
      const h = hooks.hooks as Record<string, unknown>;
      expect(h).toHaveProperty('SessionStart');
      expect(h).toHaveProperty('UserPromptSubmit');
      expect(h).toHaveProperty('SubagentStart');
      expect(h).toHaveProperty('PreToolUse');
      expect(h).toHaveProperty('PostToolUse');
      expect(h).toHaveProperty('SubagentStop');
      expect(h).toHaveProperty('PreCompact');
      expect(h).toHaveProperty('Stop');
      expect(h).toHaveProperty('PostToolUseFailure');
      expect(Object.keys(h).length).toBe(9);
    });
  });

  // ─── agents/ ───
  describe('agents/ 디렉토리', () => {
    it('10개의 에이전트 파일이 존재한다', () => {
      const agentsDir = join(ROOT, 'agents');
      expect(existsSync(agentsDir)).toBe(true);
      const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBe(10);
    });

    it('workflow-guide.md가 존재한다', () => {
      expect(existsSync(join(ROOT, 'agents/workflow-guide.md'))).toBe(true);
    });

    it('team-memory-keeper.md가 존재한다', () => {
      expect(existsSync(join(ROOT, 'agents/team-memory-keeper.md'))).toBe(true);
    });
  });

  // ─── presets/ ───
  describe('presets/ 디렉토리', () => {
    it('4개의 프리셋 파일이 존재한다 (minimal 제거됨)', () => {
      const presetsDir = join(ROOT, 'presets');
      const files = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
      expect(files.length).toBe(4);
      expect(files.sort()).toEqual(['full.json', 'secure.json', 'standard.json', 'tdd.json']);
    });

    it('minimal.json이 존재하지 않는다', () => {
      expect(existsSync(join(ROOT, 'presets/minimal.json'))).toBe(false);
    });

    it('모든 프리셋에 recommendedCapabilities 필드가 있다', () => {
      const presetsDir = join(ROOT, 'presets');
      const files = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const preset = JSON.parse(readFileSync(join(presetsDir, file), 'utf-8'));
        expect(preset).toHaveProperty('recommendedCapabilities');
        expect(Array.isArray(preset.recommendedCapabilities)).toBe(true);
      }
    });
  });

  // ─── v4 타입 파일 ───
  describe('v4 타입 파일', () => {
    it('capabilities.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/types/capabilities.ts'))).toBe(true);
    });

    it('workflow.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/types/workflow.ts'))).toBe(true);
    });

    it('sync.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/types/sync.ts'))).toBe(true);
    });
  });

  // ─── v4 핵심 모듈 ───
  describe('v4 핵심 모듈', () => {
    it('capability-detector.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/capability-detector.ts'))).toBe(true);
    });

    it('omc-bridge.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/omc-bridge.ts'))).toBe(true);
    });

    it('state-sync.ts가 존재한다', () => {
      expect(existsSync(join(ROOT, 'src/core/state-sync.ts'))).toBe(true);
    });
  });

  // ─── 버전 동기화 ───
  describe('버전 동기화', () => {
    it('package.json, plugin.json, marketplace.json 버전이 일치한다', () => {
      const pkg = readJson('package.json');
      const plugin = readJson('.claude-plugin/plugin.json');
      const mkt = readJson('.claude-plugin/marketplace.json');
      const plugins = mkt.plugins as Array<Record<string, unknown>>;

      expect(plugin.version).toBe(pkg.version);
      expect(plugins[0].version).toBe(pkg.version);
    });

    it('src/server.ts의 버전이 package.json과 일치한다', () => {
      const pkg = readJson('package.json');
      const serverTs = readFileSync(join(ROOT, 'src/server.ts'), 'utf-8');
      expect(serverTs).toContain(`version: '${pkg.version}'`);
    });
  });
});
