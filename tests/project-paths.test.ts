import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  agentDir,
  agentPlanPath,
  rootPlanPath,
  planSearchPaths,
  agentTodoPath,
  rootTodoPath,
  todoSearchPaths,
  agentContextPath,
  agentLessonsPath,
  agentMemoryPath,
  agentSessionLogPath,
  agentHandoffPath,
  agentOntologyDir,
  agentOntologyIndexPath,
  agentOntologyDomainPath,
  agentOntologyCacheDir,
  agentDomainCachePath,
} from '../src/core/project-paths.js';

const ROOT = '/project';

describe('project-paths', () => {
  describe('agentDir', () => {
    it('should return .agent/ 경로', () => {
      expect(agentDir(ROOT)).toBe(join(ROOT, '.agent'));
    });
  });

  describe('워크플로우 파일 경로', () => {
    it('should return .agent/plan.md', () => {
      expect(agentPlanPath(ROOT)).toBe(join(ROOT, '.agent', 'plan.md'));
    });

    it('should return 루트 plan.md fallback', () => {
      expect(rootPlanPath(ROOT)).toBe(join(ROOT, 'plan.md'));
    });

    it('should return plan 탐색 경로 (우선순위 순)', () => {
      const paths = planSearchPaths(ROOT);
      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(agentPlanPath(ROOT));
      expect(paths[1]).toBe(rootPlanPath(ROOT));
    });

    it('should return .agent/todo.md', () => {
      expect(agentTodoPath(ROOT)).toBe(join(ROOT, '.agent', 'todo.md'));
    });

    it('should return 루트 todo.md fallback', () => {
      expect(rootTodoPath(ROOT)).toBe(join(ROOT, 'todo.md'));
    });

    it('should return todo 탐색 경로 (우선순위 순)', () => {
      const paths = todoSearchPaths(ROOT);
      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(agentTodoPath(ROOT));
      expect(paths[1]).toBe(rootTodoPath(ROOT));
    });

    it('should return .agent/context.md', () => {
      expect(agentContextPath(ROOT)).toBe(join(ROOT, '.agent', 'context.md'));
    });

    it('should return .agent/lessons.md', () => {
      expect(agentLessonsPath(ROOT)).toBe(join(ROOT, '.agent', 'lessons.md'));
    });

    it('should return .agent/memory.md', () => {
      expect(agentMemoryPath(ROOT)).toBe(join(ROOT, '.agent', 'memory.md'));
    });

    it('should return .agent/session-log.md', () => {
      expect(agentSessionLogPath(ROOT)).toBe(join(ROOT, '.agent', 'session-log.md'));
    });

    it('should return .agent/handoff.md', () => {
      expect(agentHandoffPath(ROOT)).toBe(join(ROOT, '.agent', 'handoff.md'));
    });
  });

  describe('온톨로지 경로', () => {
    it('should return .agent/ontology/ 디렉토리', () => {
      expect(agentOntologyDir(ROOT)).toBe(join(ROOT, '.agent', 'ontology'));
    });

    it('should return ONTOLOGY-INDEX.md 경로', () => {
      expect(agentOntologyIndexPath(ROOT)).toBe(join(ROOT, '.agent', 'ontology', 'ONTOLOGY-INDEX.md'));
    });

    it('should return ONTOLOGY-DOMAIN.md 경로', () => {
      expect(agentOntologyDomainPath(ROOT)).toBe(join(ROOT, '.agent', 'ontology', 'ONTOLOGY-DOMAIN.md'));
    });

    it('should return .cache/ 디렉토리', () => {
      expect(agentOntologyCacheDir(ROOT)).toBe(join(ROOT, '.agent', 'ontology', '.cache'));
    });

    it('should return domain-cache.json 경로', () => {
      expect(agentDomainCachePath(ROOT)).toBe(join(ROOT, '.agent', 'ontology', '.cache', 'domain-cache.json'));
    });
  });
});
