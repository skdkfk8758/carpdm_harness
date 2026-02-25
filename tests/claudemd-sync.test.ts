import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { safeWriteFile } from '../src/core/file-ops.js';
import { parseMarkers, syncClaudeMd } from '../src/core/claudemd-sync.js';

let testDir: string;

function setupProject(root: string, modules: string[] = ['core', 'quality']): void {
  safeWriteFile(
    join(root, 'carpdm-harness.config.json'),
    JSON.stringify({
      version: '4.0.0',
      preset: 'standard',
      modules,
      options: { hooksRegistered: true, docsTemplatesDir: 'docs/templates', agentDir: '.agent' },
      files: {},
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      globalCommandsInstalled: false,
    }, null, 2),
  );
}

describe('parseMarkers', () => {
  it('should parse valid markers', () => {
    const content = [
      '# My Project',
      '',
      '<!-- harness:auto:start -->',
      'old auto content',
      '<!-- harness:auto:end -->',
      '',
      '## Custom Section',
    ].join('\n');

    const result = parseMarkers(content);
    expect(result).not.toBeNull();
    expect(result!.before).toContain('<!-- harness:auto:start -->');
    expect(result!.after).toContain('<!-- harness:auto:end -->');
  });

  it('should return null when no markers exist', () => {
    const content = '# My Project\n\nNo markers here.';
    expect(parseMarkers(content)).toBeNull();
  });

  it('should return null when only start marker exists', () => {
    const content = '# My Project\n<!-- harness:auto:start -->\nContent';
    expect(parseMarkers(content)).toBeNull();
  });

  it('should return null when markers are in wrong order', () => {
    const content = '<!-- harness:auto:end -->\n<!-- harness:auto:start -->';
    expect(parseMarkers(content)).toBeNull();
  });
});

describe('syncClaudeMd', () => {
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-claudemd-'));
    setupProject(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should update marker region and preserve surrounding content', () => {
    const before = '# My Project\n\nCustom intro.\n\n';
    const after = '\n\n## My Custom Rules\n\nDo not touch this.';
    const original = before
      + '<!-- harness:auto:start -->\nold content\n<!-- harness:auto:end -->'
      + after;

    safeWriteFile(join(testDir, 'CLAUDE.md'), original);

    const result = syncClaudeMd(testDir);
    expect(result.updated).toBe(true);

    const updated = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');

    // 마커 밖 내용 보존
    expect(updated).toContain('# My Project');
    expect(updated).toContain('Custom intro.');
    expect(updated).toContain('## My Custom Rules');
    expect(updated).toContain('Do not touch this.');

    // 자동 생성 내용 포함
    expect(updated).toContain('harness:auto:start');
    expect(updated).toContain('harness:auto:end');
    expect(updated).toContain('프리셋');
    expect(updated).toContain('standard');

    // 이전 내용 제거
    expect(updated).not.toContain('old content');
  });

  it('should skip when CLAUDE.md has no markers', () => {
    safeWriteFile(join(testDir, 'CLAUDE.md'), '# Project\n\nNo markers.');

    const result = syncClaudeMd(testDir);
    expect(result.updated).toBe(false);
    expect(result.reason).toContain('마커 없음');

    // 파일 내용 변경 없음
    const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe('# Project\n\nNo markers.');
  });

  it('should skip when CLAUDE.md does not exist', () => {
    const result = syncClaudeMd(testDir);
    expect(result.updated).toBe(false);
    expect(result.reason).toContain('파일 없음');
  });
});
