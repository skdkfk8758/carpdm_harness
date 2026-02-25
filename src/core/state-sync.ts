import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SyncResult } from '../types/sync.js';
import { readFileContent, safeWriteFile, ensureDir } from './file-ops.js';
import { readOmcProjectMemory, writeOmcProjectMemory, writeOmcWorkflowState } from './omc-bridge.js';
import { loadActiveWorkflowId, loadWorkflowInstance } from './workflow-persistence.js';
import { syncWorkflowStateToOmc } from './workflow-omc-mapper.js';

/**
 * 빈 SyncResult를 생성합니다.
 */
function emptySyncResult(): SyncResult {
  return {
    synced: 0,
    skipped: 0,
    conflicts: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * JSON 파일을 안전하게 파싱합니다.
 */
function parseJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const content = readFileContent(filePath);
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Harness 팀 메모리 → OMC 프로젝트 메모리 동기화
 *
 * conventions → project-memory.conventions
 * patterns → project-memory.notes (prefix: "[pattern] ")
 * decisions → project-memory.notes (prefix: "[decision] ")
 * mistakes → project-memory.notes (prefix: "[mistake] ")
 */
export function syncHarnessToOmc(projectRoot: string, dryRun = false): SyncResult {
  const result = emptySyncResult();

  try {
    const storePath = join(projectRoot, '.harness', 'team-memory.json');
    if (!existsSync(storePath)) {
      result.skipped++;
      return result;
    }

    const store = parseJsonFile(storePath);
    if (!store) {
      result.errors.push('Harness 팀 메모리 파싱 실패');
      return result;
    }

    const entries = store.entries as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(entries) || entries.length === 0) {
      result.skipped++;
      return result;
    }

    // 기존 OMC 프로젝트 메모리 읽기
    const omcMemory = readOmcProjectMemory(projectRoot) ?? {};
    const conventions = (omcMemory.conventions as string) ?? '';
    const existingNotes = (omcMemory.notes as string) ?? '';

    const conventionItems: string[] = [];
    const noteItems: string[] = [];

    for (const entry of entries) {
      const category = entry.category as string;
      const title = entry.title as string;
      const content = entry.content as string;

      if (!category || !title) continue;

      if (category === 'conventions') {
        conventionItems.push(`- ${title}: ${content ?? ''}`);
      } else if (category === 'patterns') {
        noteItems.push(`[pattern] ${title}: ${content ?? ''}`);
      } else if (category === 'decisions') {
        noteItems.push(`[decision] ${title}: ${content ?? ''}`);
      } else if (category === 'mistakes') {
        noteItems.push(`[mistake] ${title}: ${content ?? ''}`);
      } else if (category === 'bugs') {
        const sev = (entry.severity as string) ?? '';
        const st = (entry.status as string) ?? '';
        noteItems.push(`[bug:${sev}:${st}] ${title}: ${content ?? ''}`);
      }

      result.synced++;
    }

    if (!dryRun) {
      const newConventions = conventionItems.length > 0
        ? [conventions, ...conventionItems].filter(Boolean).join('\n')
        : conventions;

      const newNotes = noteItems.length > 0
        ? [existingNotes, ...noteItems].filter(Boolean).join('\n')
        : existingNotes;

      const updated: Record<string, unknown> = {
        ...omcMemory,
        conventions: newConventions,
        notes: newNotes,
      };

      writeOmcProjectMemory(projectRoot, updated);
    }
  } catch (err) {
    result.errors.push(`syncHarnessToOmc 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * OMC 프로젝트 메모리 → Harness 팀 메모리 동기화
 *
 * conventions → team-memory conventions 카테고리
 * notes ([pattern]/[decision]/[mistake] 접두사) → 해당 카테고리
 */
export function syncOmcToHarness(projectRoot: string, dryRun = false): SyncResult {
  const result = emptySyncResult();

  try {
    const omcMemory = readOmcProjectMemory(projectRoot);
    if (!omcMemory) {
      result.skipped++;
      return result;
    }

    const storePath = join(projectRoot, '.harness', 'team-memory.json');
    const store = existsSync(storePath)
      ? parseJsonFile(storePath) ?? { version: '1.0.0', entries: [] }
      : { version: '1.0.0', entries: [] };

    const entries = (store.entries as Array<Record<string, unknown>>) ?? [];

    // OMC conventions → harness conventions
    const conventions = omcMemory.conventions as string | undefined;
    if (conventions && typeof conventions === 'string') {
      const lines = conventions.split('\n').filter((l) => l.trim().startsWith('- '));
      for (const line of lines) {
        const text = line.replace(/^-\s*/, '').trim();
        if (!text) continue;

        const exists = entries.some(
          (e) => e.category === 'conventions' && e.title === text,
        );
        if (exists) {
          result.skipped++;
          continue;
        }

        entries.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          category: 'conventions',
          title: text,
          content: text,
          addedAt: new Date().toISOString(),
        });
        result.synced++;
      }
    }

    // OMC notes → harness patterns/decisions/mistakes
    const notes = omcMemory.notes as string | undefined;
    if (notes && typeof notes === 'string') {
      const lines = notes.split('\n').filter(Boolean);
      for (const line of lines) {
        let category: string | null = null;
        let content = line;

        if (line.startsWith('[pattern] ')) {
          category = 'patterns';
          content = line.replace('[pattern] ', '');
        } else if (line.startsWith('[decision] ')) {
          category = 'decisions';
          content = line.replace('[decision] ', '');
        } else if (line.startsWith('[mistake] ')) {
          category = 'mistakes';
          content = line.replace('[mistake] ', '');
        } else if (line.startsWith('[bug')) {
          category = 'bugs';
          content = line.replace(/^\[bug[^\]]*\]\s*/, '');
        }

        if (!category) continue;

        const title = content.split(':')[0]?.trim() ?? content;
        const exists = entries.some(
          (e) => e.category === category && e.title === title,
        );
        if (exists) {
          result.skipped++;
          continue;
        }

        entries.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          category,
          title,
          content,
          addedAt: new Date().toISOString(),
        });
        result.synced++;
      }
    }

    if (!dryRun) {
      store.entries = entries;
      ensureDir(join(projectRoot, '.harness'));
      safeWriteFile(storePath, JSON.stringify(store, null, 2) + '\n');
    }
  } catch (err) {
    result.errors.push(`syncOmcToHarness 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * 온톨로지 도메인 → OMC 프로젝트 메모리 동기화 (단방향)
 *
 * projectSummary → structure
 * architecture.style → techStack
 * conventions[] → conventions
 * glossary[] → notes
 */
export function syncOntologyToOmc(projectRoot: string, dryRun = false): SyncResult {
  const result = emptySyncResult();

  try {
    const ontologyPath = join(projectRoot, '.agent', 'ontology', 'ONTOLOGY-DOMAIN.md');
    if (!existsSync(ontologyPath)) {
      result.skipped++;
      return result;
    }

    const content = readFileContent(ontologyPath);
    if (!content) {
      result.skipped++;
      return result;
    }

    const omcMemory = readOmcProjectMemory(projectRoot) ?? {};
    const updates: Record<string, unknown> = { ...omcMemory };

    // projectSummary 추출 (## Project Summary 섹션)
    const summaryMatch = content.match(/## Project Summary\s*\n([\s\S]*?)(?=\n## |\n$)/i);
    if (summaryMatch?.[1]?.trim()) {
      updates.structure = summaryMatch[1].trim();
      result.synced++;
    }

    // architecture style 추출
    const archMatch = content.match(/## Architecture\s*\n([\s\S]*?)(?=\n## |\n$)/i);
    if (archMatch?.[1]?.trim()) {
      const styleMatch = archMatch[1].match(/style:\s*(.+)/i);
      if (styleMatch?.[1]?.trim()) {
        updates.techStack = styleMatch[1].trim();
        result.synced++;
      }
    }

    // conventions 추출
    const convMatch = content.match(/## Conventions\s*\n([\s\S]*?)(?=\n## |\n$)/i);
    if (convMatch?.[1]?.trim()) {
      const existingConventions = (updates.conventions as string) ?? '';
      const newConventions = convMatch[1].trim();
      updates.conventions = [existingConventions, newConventions].filter(Boolean).join('\n');
      result.synced++;
    }

    // glossary 추출
    const glossaryMatch = content.match(/## Glossary\s*\n([\s\S]*?)(?=\n## |\n$)/i);
    if (glossaryMatch?.[1]?.trim()) {
      const existingNotes = (updates.notes as string) ?? '';
      const glossaryNotes = glossaryMatch[1]
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => `[glossary] ${line.replace(/^-\s*/, '')}`)
        .join('\n');
      updates.notes = [existingNotes, glossaryNotes].filter(Boolean).join('\n');
      result.synced++;
    }

    if (!dryRun) {
      writeOmcProjectMemory(projectRoot, updates);
    }
  } catch (err) {
    result.errors.push(`syncOntologyToOmc 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * 워크플로우 상태 -> OMC 동기화 (단방향)
 *
 * .harness/workflows/active.json + state.json
 *   -> .omc/state/workflow-state.json (OMC 인식용)
 *   -> .omc/project-memory.json notes 섹션
 */
export function syncWorkflowToOmc(projectRoot: string, dryRun = false): SyncResult {
  const result = emptySyncResult();

  try {
    const activeId = loadActiveWorkflowId(projectRoot);
    if (!activeId) {
      // 활성 워크플로우 없으면 OMC 워크플로우 상태 초기화
      if (!dryRun) {
        writeOmcWorkflowState(projectRoot, { active: false });
      }
      result.skipped++;
      return result;
    }

    const instance = loadWorkflowInstance(projectRoot, activeId);
    if (!instance) {
      result.skipped++;
      return result;
    }

    if (!dryRun) {
      // .omc/state/workflow-state.json 업데이트
      const currentStep = instance.steps[instance.currentStep - 1];
      writeOmcWorkflowState(projectRoot, {
        active: instance.status === 'running' || instance.status === 'waiting_checkpoint' || instance.status === 'failed_step',
        workflowId: instance.id,
        workflowType: instance.workflowType,
        status: instance.status,
        currentStep: instance.currentStep,
        totalSteps: instance.totalSteps,
        currentAgent: currentStep?.agent ?? null,
        currentAction: currentStep?.action ?? null,
        updatedAt: instance.updatedAt,
      });
      result.synced++;

      // project-memory notes 섹션 업데이트
      syncWorkflowStateToOmc(projectRoot, instance);
      result.synced++;
    }
  } catch (err) {
    result.errors.push(`syncWorkflowToOmc 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * 전체 동기화 (Harness→OMC + OMC→Harness + Ontology→OMC + Workflow→OMC)
 */
export function fullSync(projectRoot: string, dryRun = false): SyncResult {
  const combined = emptySyncResult();

  const results = [
    syncHarnessToOmc(projectRoot, dryRun),
    syncOmcToHarness(projectRoot, dryRun),
    syncOntologyToOmc(projectRoot, dryRun),
    syncWorkflowToOmc(projectRoot, dryRun),
  ];

  for (const r of results) {
    combined.synced += r.synced;
    combined.skipped += r.skipped;
    combined.conflicts.push(...r.conflicts);
    combined.errors.push(...r.errors);
  }

  return combined;
}
