import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../core/config.js';
import { detectCapabilities, requireOmc, cacheCapabilities } from '../core/capability-detector.js';
import { logger } from '../utils/logger.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerSetupTool(server: McpServer): void {
  server.tool(
    'harness_setup',
    'OMC 기반 원스톱 프로젝트 셋업 (OMC 필수)',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      preset: z.string().optional().describe('프리셋 (full|standard|tdd|secure)'),
      dryRun: z.boolean().optional().describe('미리보기만'),
    },
    async ({ projectRoot, preset, dryRun }) => {
      try {
        logger.clear();
        const res = new McpResponseBuilder();
        const pRoot = projectRoot as string;
        const pDryRun = dryRun === true;

        // Step 1: OMC 필수 검증
        res.header('carpdm-harness 셋업');
        try {
          requireOmc();
          res.ok('OMC 설치 확인');
        } catch (err) {
          res.error(String(err instanceof Error ? err.message : err));
          res.blank();
          res.info('OMC 설치 방법:');
          res.line('  npm i -g oh-my-claudecode && omc setup');
          return res.toResult(true);
        }

        // Step 2: 기존 설치 확인
        const existingConfig = loadConfig(pRoot);
        if (existingConfig) {
          return errorResult(`이미 설치되어 있습니다 (preset: ${existingConfig.preset}). harness_update를 사용하세요.`);
        }

        // Step 3: 외부 도구 감지
        res.info('외부 도구 감지 중...');
        const capabilities = detectCapabilities(pRoot);

        const detectedTools: string[] = [];
        if (capabilities.tools.serena.detected) detectedTools.push('Serena');
        if (capabilities.tools.context7.detected) detectedTools.push('Context7');
        if (capabilities.tools.codex.detected) detectedTools.push('Codex');
        if (capabilities.tools.gemini.detected) detectedTools.push('Gemini');

        if (detectedTools.length > 0) {
          res.ok(`감지된 도구: ${detectedTools.join(', ')}`);
        } else {
          res.info('추가 외부 도구 없음 (기본 구성으로 진행)');
        }

        // Step 4: 프리셋 추천
        let recommendedPreset = preset || 'standard';
        if (!preset) {
          if (detectedTools.length >= 3) {
            recommendedPreset = 'full';
            res.info('다수의 외부 도구 감지 → full 프리셋 추천');
          } else if (capabilities.tools.serena.detected) {
            recommendedPreset = 'secure';
            res.info('Serena 감지 → secure 프리셋 추천 (코드 분석 + 보안)');
          }
        }

        res.blank();
        res.info(`선택된 프리셋: ${recommendedPreset}`);
        res.blank();

        // Step 5: harness_init 안내 (실제 init은 별도 도구로 실행)
        res.header('다음 단계');
        res.line('아래 도구를 호출하여 설치를 진행하세요:');
        res.blank();
        res.line(`  harness_init({ projectRoot: "${pRoot}", preset: "${recommendedPreset}" })`);

        // Step 6: capabilities 캐시 저장
        if (!pDryRun) {
          cacheCapabilities(pRoot, capabilities);
          res.ok('capabilities 캐시 저장 완료');
        }

        // Step 7: 부트스트랩 안내
        res.blank();
        res.header('자동 부트스트랩');
        res.line('`harness_init` 실행 시 다음 설정이 자동 생성됩니다:');
        res.table([
          ['permissions.allow', '핵심 도구 + Git + Node.js 기본 명령어'],
          ['permissions.deny', '파괴적 명령 차단 (보안 기본선)'],
          ['permissions.ask', '위험 명령 승인 요청 (rm, sudo 등)'],
          ['env', 'AGENT_TEAMS 활성화'],
          ['language', 'Korea'],
        ]);
        res.line('→ `.claude/settings.local.json`에 저장됩니다.');

        // Step 8: OMC 연동 안내
        res.blank();
        res.header('OMC 연동 안내');
        res.line('설치 완료 후 `harness_sync`로 OMC project-memory와 동기화하세요.');

        if (capabilities.omc.version) {
          res.info(`OMC 버전: ${capabilities.omc.version}`);
        }

        // Step 8: 추천 워크플로우 안내
        res.blank();
        res.header('추천 워크플로우');
        res.table([
          ['기능 개발', 'harness_workflow({ workflow: "feature" })'],
          ['버그 수정', 'harness_workflow({ workflow: "bugfix" })'],
          ['리팩토링', 'harness_workflow({ workflow: "refactor" })'],
        ]);

        const coreLog = logger.flush();
        if (coreLog) {
          res.blank();
          res.line(coreLog);
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`셋업 실패: ${String(err)}`);
      }
    },
  );
}
