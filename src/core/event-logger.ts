import { readdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { EventEntry, SessionSummary, EventStats } from '../types/dashboard.js';

const EVENTS_DIR = '.harness/events';

export function readEvents(projectRoot: string, sessionId?: string): EventEntry[] {
  const eventsDir = join(projectRoot, EVENTS_DIR);
  if (!existsSync(eventsDir)) return [];

  const files = readdirSync(eventsDir)
    .filter(f => f.endsWith('.jsonl'))
    .filter(f => !sessionId || basename(f, '.jsonl') === sessionId);

  const events: EventEntry[] = [];
  for (const file of files) {
    const content = readFileSync(join(eventsDir, file), 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as EventEntry);
      } catch {
        // 손상 줄 무시
      }
    }
  }
  return events.sort((a, b) => a.ts.localeCompare(b.ts));
}

export function listSessions(projectRoot: string): SessionSummary[] {
  const eventsDir = join(projectRoot, EVENTS_DIR);
  if (!existsSync(eventsDir)) return [];

  const files = readdirSync(eventsDir).filter(f => f.endsWith('.jsonl'));
  const sessions: SessionSummary[] = [];

  for (const file of files) {
    const sessionId = basename(file, '.jsonl');
    const events = readEvents(projectRoot, sessionId);
    if (events.length === 0) continue;

    const hookCounts: Record<string, number> = {};
    const resultCounts: Record<string, number> = {};
    for (const e of events) {
      hookCounts[e.hook] = (hookCounts[e.hook] || 0) + 1;
      resultCounts[e.result] = (resultCounts[e.result] || 0) + 1;
    }

    sessions.push({
      sessionId,
      startedAt: events[0].ts,
      lastEventAt: events[events.length - 1].ts,
      eventCount: events.length,
      hookCounts,
      resultCounts,
    });
  }

  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getEventStats(events: EventEntry[]): EventStats {
  const byHook: Record<string, number> = {};
  const byResult: Record<string, number> = {};
  const byEvent: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  const fileCounts: Record<string, number> = {};
  const hourCounts: Record<string, { count: number; blocks: number; warns: number }> = {};
  const byAgent: Record<string, number> = {};
  const bySkill: Record<string, number> = {};
  const byMode: Record<string, number> = {};
  const durationByHook: Record<string, { sum: number; max: number; count: number }> = {};
  let durationSum = 0;
  let durationCount = 0;
  let durationMax = 0;
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;
  const fileHotspotMap: Record<string, { changes: number; linesAdded: number; linesRemoved: number }> = {};
  const delegationPatternMap: Record<string, number> = {};
  let chainDepthSum = 0;
  let chainDepthCount = 0;
  const byTag: Record<string, number> = {};
  const taskEventMapRaw: Record<string, { eventCount: number; results: Record<string, number> }> = {};
  const causalDepths: Record<number, number> = {};

  for (const e of events) {
    byHook[e.hook] = (byHook[e.hook] || 0) + 1;
    byResult[e.result] = (byResult[e.result] || 0) + 1;
    byEvent[e.event] = (byEvent[e.event] || 0) + 1;
    if (e.tool) byTool[e.tool] = (byTool[e.tool] || 0) + 1;
    if (e.file) fileCounts[e.file] = (fileCounts[e.file] || 0) + 1;
    if (e.agent) byAgent[e.agent] = (byAgent[e.agent] || 0) + 1;
    if (e.skill) bySkill[e.skill] = (bySkill[e.skill] || 0) + 1;
    if (e.mode) byMode[e.mode] = (byMode[e.mode] || 0) + 1;

    // 라인 변경 집계
    if (e.linesChanged !== undefined) {
      totalLinesAdded += e.linesChanged.added;
      totalLinesRemoved += e.linesChanged.removed;
    }

    // 파일 핫스팟 집계
    if (e.filesAffected !== undefined) {
      for (const f of e.filesAffected) {
        if (!fileHotspotMap[f]) fileHotspotMap[f] = { changes: 0, linesAdded: 0, linesRemoved: 0 };
        fileHotspotMap[f].changes++;
        if (e.linesChanged !== undefined) {
          fileHotspotMap[f].linesAdded += e.linesChanged.added;
          fileHotspotMap[f].linesRemoved += e.linesChanged.removed;
        }
      }
    }

    // 위임 체인 집계
    if (e.delegationChain !== undefined && e.delegationChain.length > 0) {
      const chainKey = e.delegationChain.join('→');
      delegationPatternMap[chainKey] = (delegationPatternMap[chainKey] || 0) + 1;
      chainDepthSum += e.delegationChain.length;
      chainDepthCount++;
    }

    // 태그 집계
    if (e.tags) {
      for (const tag of e.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    // 태스크별 이벤트 맵
    if (e.taskId) {
      if (!taskEventMapRaw[e.taskId]) taskEventMapRaw[e.taskId] = { eventCount: 0, results: {} };
      taskEventMapRaw[e.taskId].eventCount++;
      taskEventMapRaw[e.taskId].results[e.result] = (taskEventMapRaw[e.taskId].results[e.result] || 0) + 1;
    }

    // 인과 체인 깊이
    if (e.parentEvent) {
      const depth = 2;
      causalDepths[depth] = (causalDepths[depth] || 0) + 1;
    } else {
      causalDepths[1] = (causalDepths[1] || 0) + 1;
    }

    // 실행 시간 집계
    if (e.durationMs !== undefined) {
      durationSum += e.durationMs;
      durationCount++;
      if (e.durationMs > durationMax) durationMax = e.durationMs;

      if (!durationByHook[e.hook]) durationByHook[e.hook] = { sum: 0, max: 0, count: 0 };
      durationByHook[e.hook].sum += e.durationMs;
      durationByHook[e.hook].count++;
      if (e.durationMs > durationByHook[e.hook].max) durationByHook[e.hook].max = e.durationMs;
    }

    // 시간대별 집계 (YYYY-MM-DDTHH 형태)
    const hour = e.ts.slice(0, 13);
    if (!hourCounts[hour]) hourCounts[hour] = { count: 0, blocks: 0, warns: 0 };
    hourCounts[hour].count++;
    if (e.result === 'BLOCK') hourCounts[hour].blocks++;
    if (e.result === 'WARN') hourCounts[hour].warns++;
  }

  const total = events.length || 1;
  const timeline = Object.entries(hourCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, data]) => ({ hour, ...data }));

  const topFiles = Object.entries(fileCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  const fileHotspots = Object.entries(fileHotspotMap)
    .sort(([, a], [, b]) => b.changes - a.changes)
    .slice(0, 15)
    .map(([file, data]) => ({ file, ...data }));

  const delegationPatterns = Object.entries(delegationPatternMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([chain, count]) => ({ chain, count }));

  const avgChainDepth = chainDepthCount > 0 ? Math.round((chainDepthSum / chainDepthCount) * 10) / 10 : 0;

  const taskEventMap = Object.entries(taskEventMapRaw)
    .sort(([, a], [, b]) => b.eventCount - a.eventCount)
    .slice(0, 20)
    .map(([taskId, data]) => ({ taskId, ...data }));

  const eventCausalChains = Object.entries(causalDepths)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([depth, count]) => ({ depth: Number(depth), count }));

  // 훅별 실행 시간 avg/max/count 변환
  const durationByHookFinal: Record<string, { avg: number; max: number; count: number }> = {};
  for (const [hook, data] of Object.entries(durationByHook)) {
    durationByHookFinal[hook] = {
      avg: Math.round(data.sum / data.count),
      max: data.max,
      count: data.count,
    };
  }

  return {
    totalEvents: events.length,
    byHook,
    byResult,
    byEvent,
    byTool,
    blockRate: (byResult['BLOCK'] || 0) / total,
    warnRate: (byResult['WARN'] || 0) / total,
    timeline,
    topFiles,
    byAgent,
    bySkill,
    byMode,
    avgDurationMs: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
    maxDurationMs: durationMax,
    durationByHook: durationByHookFinal,
    totalLinesAdded,
    totalLinesRemoved,
    fileHotspots,
    delegationPatterns,
    avgChainDepth,
    byTag,
    taskEventMap,
    eventCausalChains,
  };
}

export function pruneOldSessions(
  projectRoot: string,
  retentionDays: number,
): { pruned: number; kept: number } {
  const eventsDir = join(projectRoot, EVENTS_DIR);
  if (!existsSync(eventsDir)) return { pruned: 0, kept: 0 };

  const files = readdirSync(eventsDir).filter(f => f.endsWith('.jsonl'));
  if (files.length <= 3) return { pruned: 0, kept: files.length };

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  // 파일별 마지막 이벤트 ts 수집
  const fileAges: { file: string; lastTs: number }[] = [];
  for (const file of files) {
    const content = readFileSync(join(eventsDir, file), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;
    try {
      const lastEvent = JSON.parse(lines[lines.length - 1]) as EventEntry;
      fileAges.push({ file, lastTs: new Date(lastEvent.ts).getTime() });
    } catch {
      fileAges.push({ file, lastTs: 0 });
    }
  }

  // 최신순 정렬
  fileAges.sort((a, b) => b.lastTs - a.lastTs);

  let pruned = 0;
  let kept = 0;
  for (let i = 0; i < fileAges.length; i++) {
    // 최소 3개 보존
    if (i < 3 || fileAges[i].lastTs >= cutoff) {
      kept++;
    } else {
      unlinkSync(join(eventsDir, fileAges[i].file));
      pruned++;
    }
  }

  return { pruned, kept };
}
