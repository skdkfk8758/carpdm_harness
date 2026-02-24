import { readdirSync, readFileSync, existsSync } from 'node:fs';
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

  for (const e of events) {
    byHook[e.hook] = (byHook[e.hook] || 0) + 1;
    byResult[e.result] = (byResult[e.result] || 0) + 1;
    byEvent[e.event] = (byEvent[e.event] || 0) + 1;
    if (e.tool) byTool[e.tool] = (byTool[e.tool] || 0) + 1;
    if (e.file) fileCounts[e.file] = (fileCounts[e.file] || 0) + 1;

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
  };
}
