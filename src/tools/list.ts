import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAllModules, getPresetNames, loadPreset } from '../core/module-registry.js';
import { McpResponseBuilder, errorResult } from '../types/mcp.js';

export function registerListTool(server: McpServer): void {
  server.tool(
    'harness_list',
    '사용 가능한 모듈과 프리셋 목록을 표시합니다',
    {
      showModules: z.boolean().optional().describe('모듈 목록 표시'),
      showPresets: z.boolean().optional().describe('프리셋 목록 표시'),
    },
    async ({ showModules, showPresets }) => {
      try {
        const res = new McpResponseBuilder();
        const showAll = !showModules && !showPresets;

        if (showAll || showModules) {
          res.header('사용 가능한 모듈');
          const modules = getAllModules();
          for (const [name, mod] of Object.entries(modules)) {
            const deps = mod.dependencies.length > 0
              ? ` (의존: ${mod.dependencies.join(', ')})`
              : '';
            const counts = `${mod.commands.length}cmd ${mod.hooks.length}hook ${mod.docs.length}doc`;
            res.line(`  ${name.padEnd(15)} ${mod.description}`);
            res.line(`  ${' '.repeat(15)} ${counts}${deps}`);
          }
          res.blank();
        }

        if (showAll || showPresets) {
          res.header('사용 가능한 프리셋');
          for (const name of getPresetNames()) {
            const preset = loadPreset(name);
            if (preset) {
              const mods = preset.modules.join(', ');
              res.line(`  ${name.padEnd(12)} ${preset.description}`);
              res.line(`  ${' '.repeat(12)} 모듈: ${mods}`);
            }
          }
          res.blank();
        }

        return res.toResult();
      } catch (err) {
        return errorResult(`목록 조회 실패: ${String(err)}`);
      }
    },
  );
}
