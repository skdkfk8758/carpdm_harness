import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * shouldRefreshOntology() 로직 검증
 * session-start.ts 내부 함수이므로, 동일 로직을 독립적으로 테스트
 */
function shouldRefreshOntologySync(cwd: string): { shouldRefresh: boolean; reason?: string } {
  const { existsSync, readFileSync } = require('node:fs');
  const cachePath = join(cwd, '.agent', 'ontology', '.cache', 'domain-cache.json');

  if (!existsSync(cachePath)) return { shouldRefresh: false };

  let builtAtMs: number;
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(raw) as { builtAt?: string };
    if (!cache.builtAt) return { shouldRefresh: false };
    builtAtMs = new Date(cache.builtAt).getTime();
  } catch {
    return { shouldRefresh: false };
  }

  if ((Date.now() - builtAtMs) / 3_600_000 > 24) {
    return { shouldRefresh: true, reason: 'stale' };
  }

  return { shouldRefresh: false };
}

describe('shouldRefreshOntology — staleness 판단', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'ontology-refresh-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should domain-cache.json이 없으면 false를 반환한다', () => {
    const result = shouldRefreshOntologySync(testDir);
    expect(result.shouldRefresh).toBe(false);
  });

  it('should builtAt가 12시간 전이면 false를 반환한다', () => {
    const cacheDir = join(testDir, '.agent', 'ontology', '.cache');
    mkdirSync(cacheDir, { recursive: true });

    const twelveHoursAgo = new Date(Date.now() - 12 * 3_600_000).toISOString();
    writeFileSync(join(cacheDir, 'domain-cache.json'), JSON.stringify({ builtAt: twelveHoursAgo }));

    const result = shouldRefreshOntologySync(testDir);
    expect(result.shouldRefresh).toBe(false);
  });

  it('should builtAt가 25시간 전이면 true를 반환한다 (reason: stale)', () => {
    const cacheDir = join(testDir, '.agent', 'ontology', '.cache');
    mkdirSync(cacheDir, { recursive: true });

    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 3_600_000).toISOString();
    writeFileSync(join(cacheDir, 'domain-cache.json'), JSON.stringify({ builtAt: twentyFiveHoursAgo }));

    const result = shouldRefreshOntologySync(testDir);
    expect(result.shouldRefresh).toBe(true);
    expect(result.reason).toBe('stale');
  });

  it('should builtAt 필드가 없으면 false를 반환한다', () => {
    const cacheDir = join(testDir, '.agent', 'ontology', '.cache');
    mkdirSync(cacheDir, { recursive: true });

    writeFileSync(join(cacheDir, 'domain-cache.json'), JSON.stringify({ inputHash: 'abc123' }));

    const result = shouldRefreshOntologySync(testDir);
    expect(result.shouldRefresh).toBe(false);
  });

  it('should JSON 파싱 실패 시 false를 반환한다', () => {
    const cacheDir = join(testDir, '.agent', 'ontology', '.cache');
    mkdirSync(cacheDir, { recursive: true });

    writeFileSync(join(cacheDir, 'domain-cache.json'), '{ invalid json !!!');

    const result = shouldRefreshOntologySync(testDir);
    expect(result.shouldRefresh).toBe(false);
  });
});
