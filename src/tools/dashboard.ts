import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { loadConfig } from '../core/config.js';
import { getAllModules } from '../core/module-registry.js';
import { computeFileHash } from '../core/file-ops.js';
import { loadStore } from '../core/team-memory.js';
import { getOntologyStatus } from '../core/ontology/index.js';
import { loadOntologyCache } from '../core/ontology/incremental-updater.js';
import type { OntologyDashboardData } from '../core/ontology/dashboard-snippet.js';
import { readEvents, listSessions, getEventStats, pruneOldSessions } from '../core/event-logger.js';
import { renderDashboard } from '../core/dashboard-renderer.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';
import type { DashboardData, EventEntry } from '../types/dashboard.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';
import { safeWriteFile } from '../core/file-ops.js';

export function registerDashboardTool(server: McpServer): void {
  server.tool(
    'harness_dashboard',
    '워크플로우 대시보드를 생성합니다 — 이벤트 통계, 모듈 상태, 세션 리플레이를 HTML로 시각화',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      sessionId: z.string().optional().describe('특정 세션 ID (생략 시 전체)'),
      open: z.boolean().optional().describe('생성 후 브라우저에서 열기'),
    },
    async ({ projectRoot, sessionId, open }) => {
      try {
        const res = new McpResponseBuilder();
        const root = projectRoot as string;

        // 0. config 로딩 + 오래된 세션 정리
        const config = loadConfig(root);
        const retentionDays = config?.eventRetentionDays ?? 30;
        pruneOldSessions(root, retentionDays);

        // 1. 이벤트 데이터 수집
        const sessions = listSessions(root);
        const allEvents = readEvents(root);
        const currentSession = sessionId
          ? readEvents(root, sessionId)
          : sessions.length > 0
            ? readEvents(root, sessions[0].sessionId)
            : null;
        const stats = getEventStats(allEvents);

        // 1b. 전체 세션 데이터 수집 (최근 10개, 총 1000건 제한)
        const recentSessions = sessions.slice(0, 10);
        const allSessions: Record<string, EventEntry[]> = {};
        let totalEmbedded = 0;
        const MAX_EMBEDDED_EVENTS = 1000;
        for (const s of recentSessions) {
          if (totalEmbedded >= MAX_EMBEDDED_EVENTS) break;
          const events = readEvents(root, s.sessionId);
          const remaining = MAX_EMBEDDED_EVENTS - totalEmbedded;
          allSessions[s.sessionId] = events.slice(-remaining);
          totalEmbedded += allSessions[s.sessionId].length;
        }

        // 2. 모듈 상태/의존성 수집
        const allModules = getAllModules();
        const installedModules = config?.modules ?? [];

        const modules = Object.entries(allModules).map(([name, mod]) => ({
          name,
          installed: installedModules.includes(name),
          fileCount: [...mod.commands, ...mod.hooks, ...mod.docs, ...(mod.rules ?? []), ...(mod.agents ?? [])].length,
          hookCount: mod.hooks.length,
        }));

        const moduleGraph = Object.entries(allModules)
          .flatMap(([name, mod]) =>
            mod.dependencies.map(dep => ({ source: name, target: dep })),
          );

        // 3. 파일 무결성 수집
        let original = 0;
        let modified = 0;
        let missing = 0;
        if (config?.files) {
          for (const [relPath, record] of Object.entries(config.files)) {
            const absPath = join(root, relPath);
            if (!existsSync(absPath)) {
              missing++;
            } else {
              try {
                const currentHash = computeFileHash(absPath);
                if (currentHash === record.hash) {
                  original++;
                } else {
                  modified++;
                }
              } catch {
                missing++;
              }
            }
          }
        }

        // 4. 팀 메모리 상태 수집
        let teamMemory: DashboardData['teamMemory'] = null;
        try {
          const store = loadStore(root);
          if (store.entries.length > 0) {
            const categories: Record<string, number> = {};
            for (const entry of store.entries) {
              categories[entry.category] = (categories[entry.category] || 0) + 1;
            }
            teamMemory = { categories };
          }
        } catch {
          // 팀 메모리 없음
        }

        // 5. 온톨로지 상태 + 상세 데이터 수집
        let ontologyStatus: DashboardData['ontologyStatus'] = null;
        let ontologyDetail: OntologyDashboardData | undefined;
        try {
          const ontologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;
          const status = getOntologyStatus(root, ontologyConfig);
          if (status) {
            const enabledLayers = (['structure', 'semantics', 'domain'] as const)
              .filter(l => status.layerStatus[l].enabled);
            const lastBuilts = (['structure', 'semantics', 'domain'] as const)
              .map(l => status.layerStatus[l].lastBuilt)
              .filter((v): v is string => v !== null)
              .sort()
              .reverse();
            ontologyStatus = {
              enabled: ontologyConfig.enabled,
              layers: enabledLayers,
              lastBuilt: lastBuilts[0] ?? null,
            };

            // 캐시에서 상세 레이어 데이터 로드
            const cache = loadOntologyCache(root, ontologyConfig.outputDir);
            ontologyDetail = {
              enabled: ontologyConfig.enabled,
              layers: enabledLayers,
              lastBuilt: lastBuilts[0] ?? null,
              structure: cache?.layerData.structure,
              semantics: cache?.layerData.semantics,
              domain: cache?.layerData.domain,
            };
          }
        } catch {
          // 온톨로지 없음
        }

        // 6. 훅 맵 수집
        const hookMapRaw: Record<string, Set<string>> = {};
        for (const mod of Object.values(allModules)) {
          for (const hook of mod.hooks) {
            const hookName = basename(hook.destination, '.sh');
            // event를 hook destination 패턴으로 추론
            const event = inferEventFromHook(hookName);
            if (!hookMapRaw[event]) hookMapRaw[event] = new Set();
            hookMapRaw[event].add(hookName);
          }
        }
        const hookMap = Object.entries(hookMapRaw).map(([event, hooks]) => ({
          event,
          hooks: Array.from(hooks),
        }));

        // 7. DashboardData 구성 + HTML 생성
        const projectName = basename(root);
        const data: DashboardData = {
          generatedAt: new Date().toISOString(),
          projectName,
          sessions,
          currentSession,
          allSessions,
          stats,
          modules,
          moduleGraph,
          integrity: { original, modified, missing },
          teamMemory,
          ontologyStatus,
          ontologyDetail,
          hookMap,
        };

        const html = renderDashboard(data);
        const outputPath = join(root, '.harness', 'dashboard.html');
        safeWriteFile(outputPath, html);

        res.header('대시보드 생성 완료');
        res.line(`경로: ${outputPath}`);
        res.line(`세션 수: ${sessions.length}`);
        res.line(`총 이벤트: ${stats.totalEvents}`);
        res.line(`BLOCK 비율: ${(stats.blockRate * 100).toFixed(1)}%`);
        res.line(`WARN 비율: ${(stats.warnRate * 100).toFixed(1)}%`);
        res.line(`모듈: ${modules.filter(m => m.installed).length}/${modules.length} 설치됨`);

        // 8. 브라우저 열기
        if (open) {
          try {
            execSync(`open "${outputPath}"`, { stdio: 'ignore' });
            res.info('브라우저에서 대시보드를 열었습니다.');
          } catch {
            res.warn('브라우저 열기 실패. 수동으로 열어주세요.');
          }
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`대시보드 생성 실패: ${String(err)}`);
      }
    },
  );
}

function inferEventFromHook(hookName: string): string {
  const map: Record<string, string> = {
    'pre-task': 'UserPromptSubmit',
    'plan-guard': 'PreToolUse',
    'post-task': 'Stop',
    'code-change': 'PostToolUse',
    'tdd-guard': 'PreToolUse',
    'command-guard': 'PreToolUse',
    'db-guard': 'PreToolUse',
    'secret-filter': 'PostToolUse',
    'security-trigger': 'PostToolUse',
    'ontology-update': 'PostToolUse',
  };
  return map[hookName] ?? 'Unknown';
}
