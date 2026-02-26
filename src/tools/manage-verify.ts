import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  scanVerifySkills,
  analyzeGitDrift,
  generateVerifySkill,
  updateVerifySkillCovers,
} from '../core/verify-skill-manager.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerManageVerifyTool(server: McpServer): void {
  server.tool(
    'harness_manage_verify',
    '프로젝트 검증 스킬을 관리합니다. git 변경 분석 → 드리프트 탐지 → verify 스킬 자동 생성/업데이트',
    {
      projectRoot: z.string().describe('프로젝트 루트 경로'),
      action: z.enum(['analyze', 'apply'])
        .optional()
        .default('analyze')
        .describe('analyze: 드리프트 분석만 / apply: 제안 적용까지'),
    },
    async ({ projectRoot, action }) => {
      try {
        const root = projectRoot as string;
        const skills = scanVerifySkills(root);
        const drift = analyzeGitDrift(root, skills);

        const res = new McpResponseBuilder();
        res.header('Verify 스킬 드리프트 분석');
        res.blank();

        // 현황 요약
        res.table([
          ['등록된 verify 스킬', `${skills.length}개`],
          ['변경된 파일', `${drift.changedFiles.length}개`],
          ['커버된 파일', `${drift.coveredFiles.length}개`],
          ['미커버 파일', `${drift.uncoveredFiles.length}개`],
        ]);
        res.blank();

        // 갭 보고
        if (drift.gaps.length === 0) {
          res.ok('드리프트 없음 — 모든 변경 파일이 verify 스킬로 커버됨');
        } else {
          res.warn(`${drift.gaps.length}개 드리프트 갭 발견:`);
          res.blank();
          for (const gap of drift.gaps) {
            const icon = gap.severity === 'error' ? 'ERROR' : gap.severity === 'warning' ? 'WARN' : 'INFO';
            res.line(`  [${icon}] ${gap.type}: ${gap.description}`);
            if (gap.affectedFiles.length <= 5) {
              for (const f of gap.affectedFiles) {
                res.line(`    - ${f}`);
              }
            } else {
              for (const f of gap.affectedFiles.slice(0, 3)) {
                res.line(`    - ${f}`);
              }
              res.line(`    ... 외 ${gap.affectedFiles.length - 3}개`);
            }
          }
        }

        // 제안
        if (drift.suggestions.length > 0) {
          res.blank();
          res.header('제안');
          for (const suggestion of drift.suggestions) {
            const actionLabel = suggestion.action === 'create' ? '생성' : '업데이트';
            res.line(`  [${actionLabel}] ${suggestion.skillName}: ${suggestion.reason}`);
            res.line(`    covers: ${suggestion.covers.join(', ')}`);
            res.line(`    검사 ${suggestion.proposedChecks.length}개 제안`);
          }
        }

        // apply 모드: 제안 적용
        if (action === 'apply' && drift.suggestions.length > 0) {
          res.blank();
          res.header('적용 결과');

          for (const suggestion of drift.suggestions) {
            if (suggestion.action === 'create') {
              const filePath = generateVerifySkill(root, suggestion);
              res.ok(`생성: ${suggestion.skillName} → ${filePath}`);
            } else {
              const existingSkill = skills.find(s => s.name === suggestion.skillName);
              if (existingSkill) {
                updateVerifySkillCovers(existingSkill, suggestion.covers);
                res.ok(`업데이트: ${suggestion.skillName} — covers 패턴 추가`);
              }
            }
          }
        } else if (action === 'analyze' && drift.suggestions.length > 0) {
          res.blank();
          res.info('제안을 적용하려면 action: "apply"로 다시 호출하세요');
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`verify 스킬 관리 실패: ${String(err)}`);
      }
    },
  );
}
