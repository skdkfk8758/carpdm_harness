import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archivePlan, listArchives, restoreArchive, enforceArchiveLimit } from '../../src/core/plan-archive.js';

describe('plan-archive', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-archive-test-'));
    mkdirSync(join(testDir, '.agent'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ─── archivePlan ───

  describe('archivePlan', () => {
    it('should archive plan.md and todo.md into a combined file', () => {
      writeFileSync(join(testDir, '.agent', 'plan.md'), '# My Plan\n\nSome content');
      writeFileSync(join(testDir, '.agent', 'todo.md'), '- [ ] Task 1\n- [ ] Task 2');

      const result = archivePlan(testDir);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^\d{4}-\d{2}-\d{2}_my-plan\.md$/);

      // 원본 삭제 확인
      expect(existsSync(join(testDir, '.agent', 'plan.md'))).toBe(false);
      expect(existsSync(join(testDir, '.agent', 'todo.md'))).toBe(false);

      // 아카이브 파일 존재 확인
      const archiveDir = join(testDir, '.agent', 'archive');
      const files = readdirSync(archiveDir);
      expect(files.length).toBe(1);

      // 합본 내용에 구분자 포함 확인
      const content = readFileSync(join(archiveDir, files[0]), 'utf-8');
      expect(content).toContain('# My Plan');
      expect(content).toContain('<!-- ARCHIVE:SEPARATOR -->');
      expect(content).toContain('- [ ] Task 1');
    });

    it('should archive plan.md only when todo.md does not exist', () => {
      writeFileSync(join(testDir, '.agent', 'plan.md'), '# Solo Plan\n\nContent');

      const result = archivePlan(testDir);

      expect(result.success).toBe(true);

      const archiveDir = join(testDir, '.agent', 'archive');
      const files = readdirSync(archiveDir);
      const content = readFileSync(join(archiveDir, files[0]), 'utf-8');

      // 구분자 없음
      expect(content).not.toContain('<!-- ARCHIVE:SEPARATOR -->');
      expect(content).toContain('# Solo Plan');
    });

    it('should return failure when plan.md does not exist', () => {
      const result = archivePlan(testDir);

      expect(result.success).toBe(false);
      expect(result.message).toContain('plan.md가 존재하지 않습니다');
    });

    it('should return failure when plan.md is empty', () => {
      writeFileSync(join(testDir, '.agent', 'plan.md'), '   \n  ');

      const result = archivePlan(testDir);

      expect(result.success).toBe(false);
      expect(result.message).toContain('비어있습니다');
    });

    it('should create archive directory if it does not exist', () => {
      writeFileSync(join(testDir, '.agent', 'plan.md'), '# Test\n\nContent');

      expect(existsSync(join(testDir, '.agent', 'archive'))).toBe(false);

      const result = archivePlan(testDir);

      expect(result.success).toBe(true);
      expect(existsSync(join(testDir, '.agent', 'archive'))).toBe(true);
    });

    it('should generate slug from plan title with special chars removed', () => {
      writeFileSync(join(testDir, '.agent', 'plan.md'), '# Plan: API 인증 (v2.0)\n\nContent');

      const result = archivePlan(testDir);

      expect(result.success).toBe(true);
      // 특수문자 제거, 공백→하이픈
      expect(result.filename).toMatch(/^\d{4}-\d{2}-\d{2}_plan-api-인증-v20\.md$/);
    });

    it('should use "untitled" slug when no heading found', () => {
      writeFileSync(join(testDir, '.agent', 'plan.md'), 'No heading here\n\nJust text');

      const result = archivePlan(testDir);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^\d{4}-\d{2}-\d{2}_untitled\.md$/);
    });

    it('should truncate slug to 30 characters', () => {
      writeFileSync(
        join(testDir, '.agent', 'plan.md'),
        '# This Is A Very Long Plan Title That Should Be Truncated\n\nContent',
      );

      const result = archivePlan(testDir);
      expect(result.success).toBe(true);

      // slug 부분만 추출 (날짜_slug.md → slug)
      const slug = result.filename!.slice(11, -3);
      expect(slug.length).toBeLessThanOrEqual(30);
    });
  });

  // ─── listArchives ───

  describe('listArchives', () => {
    it('should return empty array when archive dir does not exist', () => {
      const entries = listArchives(testDir);
      expect(entries).toEqual([]);
    });

    it('should return archives sorted newest first', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      writeFileSync(join(archiveDir, '2025-01-01_first.md'), 'content');
      writeFileSync(join(archiveDir, '2025-06-15_second.md'), 'content');
      writeFileSync(join(archiveDir, '2025-03-10_third.md'), 'content');

      const entries = listArchives(testDir);

      expect(entries.length).toBe(3);
      expect(entries[0].filename).toBe('2025-06-15_second.md');
      expect(entries[1].filename).toBe('2025-03-10_third.md');
      expect(entries[2].filename).toBe('2025-01-01_first.md');
    });

    it('should extract date and title from filename', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      writeFileSync(join(archiveDir, '2025-06-15_my-cool-plan.md'), 'content');

      const entries = listArchives(testDir);

      expect(entries[0].date).toBe('2025-06-15');
      expect(entries[0].title).toBe('my cool plan');
    });

    it('should ignore non-md files', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      writeFileSync(join(archiveDir, '2025-01-01_plan.md'), 'content');
      writeFileSync(join(archiveDir, 'notes.txt'), 'content');
      writeFileSync(join(archiveDir, '.DS_Store'), 'content');

      const entries = listArchives(testDir);
      expect(entries.length).toBe(1);
    });
  });

  // ─── restoreArchive ───

  describe('restoreArchive', () => {
    it('should restore plan and todo from combined archive', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      const combined = '# Restored Plan\n\nContent\n\n<!-- ARCHIVE:SEPARATOR -->\n\n- [ ] Todo 1';
      writeFileSync(join(archiveDir, '2025-01-01_restored-plan.md'), combined);

      const result = restoreArchive(testDir, '2025-01-01_restored-plan.md');

      expect(result.success).toBe(true);
      expect(result.message).toContain('plan.md + todo.md 복원');

      const plan = readFileSync(join(testDir, '.agent', 'plan.md'), 'utf-8');
      expect(plan).toContain('# Restored Plan');
      expect(plan).not.toContain('ARCHIVE:SEPARATOR');

      const todo = readFileSync(join(testDir, '.agent', 'todo.md'), 'utf-8');
      expect(todo).toContain('- [ ] Todo 1');
    });

    it('should restore plan only when no separator exists', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      writeFileSync(join(archiveDir, '2025-01-01_plan-only.md'), '# Plan Only\n\nContent');

      const result = restoreArchive(testDir, '2025-01-01_plan-only.md');

      expect(result.success).toBe(true);
      expect(result.message).toContain('plan.md 복원 완료');

      expect(existsSync(join(testDir, '.agent', 'plan.md'))).toBe(true);
      // todo.md는 생성되지 않아야 함
      expect(existsSync(join(testDir, '.agent', 'todo.md'))).toBe(false);
    });

    it('should archive existing plan before restoring', () => {
      // 기존 plan 설정
      writeFileSync(join(testDir, '.agent', 'plan.md'), '# Current Plan\n\nOld content');

      // 아카이브 파일 준비
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });
      writeFileSync(join(archiveDir, '2025-01-01_old-plan.md'), '# Old Plan\n\nRestore me');

      const result = restoreArchive(testDir, '2025-01-01_old-plan.md');

      expect(result.success).toBe(true);

      // 기존 plan이 아카이브됨 (archive에 2개 파일)
      const archiveFiles = readdirSync(archiveDir).filter(f => f.endsWith('.md'));
      expect(archiveFiles.length).toBe(2); // old-plan + current-plan 아카이브

      // 복원된 내용 확인
      const plan = readFileSync(join(testDir, '.agent', 'plan.md'), 'utf-8');
      expect(plan).toContain('# Old Plan');
    });

    it('should return failure for non-existent archive', () => {
      const result = restoreArchive(testDir, 'nonexistent.md');

      expect(result.success).toBe(false);
      expect(result.message).toContain('찾을 수 없습니다');
    });
  });

  // ─── enforceArchiveLimit ───

  describe('enforceArchiveLimit', () => {
    it('should delete oldest archives when exceeding limit', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      // 5개 생성
      for (let i = 1; i <= 5; i++) {
        writeFileSync(join(archiveDir, `2025-01-0${i}_plan-${i}.md`), `Plan ${i}`);
      }

      const deleted = enforceArchiveLimit(testDir, 3);

      expect(deleted).toBe(2);
      const remaining = readdirSync(archiveDir).filter(f => f.endsWith('.md'));
      expect(remaining.length).toBe(3);

      // 최신 3개가 남아야 함
      expect(remaining.sort()).toEqual([
        '2025-01-03_plan-3.md',
        '2025-01-04_plan-4.md',
        '2025-01-05_plan-5.md',
      ]);
    });

    it('should do nothing when under limit', () => {
      const archiveDir = join(testDir, '.agent', 'archive');
      mkdirSync(archiveDir, { recursive: true });

      writeFileSync(join(archiveDir, '2025-01-01_plan.md'), 'content');

      const deleted = enforceArchiveLimit(testDir, 20);

      expect(deleted).toBe(0);
    });

    it('should return 0 when archive dir does not exist', () => {
      const deleted = enforceArchiveLimit(testDir, 20);
      expect(deleted).toBe(0);
    });
  });
});
