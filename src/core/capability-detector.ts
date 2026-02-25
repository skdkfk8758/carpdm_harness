import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { CapabilityResult, OmcStatus, ToolCapability } from '../types/capabilities.js';
import { DEFAULT_CAPABILITY_RESULT } from '../types/capabilities.js';
import { readFileContent, safeWriteFile, ensureDir } from './file-ops.js';
import { omcConfigPath, harnessCapabilitiesPath } from './omc-compat.js';

/**
 * OMC(oh-my-claudecode) 설치 여부와 버전을 감지합니다.
 */
export function detectOmc(): OmcStatus {
  try {
    const configPath = omcConfigPath();
    if (!existsSync(configPath)) {
      return { installed: false };
    }

    const content = readFileContent(configPath);
    if (!content) {
      return { installed: false };
    }

    const config = JSON.parse(content) as Record<string, unknown>;
    return {
      installed: true,
      version: typeof config.version === 'string' ? config.version : undefined,
      configPath,
    };
  } catch {
    return { installed: false };
  }
}

/**
 * MCP 설정에서 외부 도구(serena, context7, codex, gemini) 존재 여부를 감지합니다.
 */
export function detectMcpTools(projectRoot: string): Record<string, ToolCapability> {
  const tools: Record<string, ToolCapability> = {
    serena: { name: 'serena', detected: false },
    context7: { name: 'context7', detected: false },
    codex: { name: 'codex', detected: false },
    gemini: { name: 'gemini', detected: false },
  };

  try {
    // 프로젝트 로컬 .mcp.json 우선, 없으면 글로벌
    const localMcpPath = join(projectRoot, '.mcp.json');
    const globalMcpPath = join(homedir(), '.claude', '.mcp.json');
    const mcpPath = existsSync(localMcpPath) ? localMcpPath : globalMcpPath;

    if (!existsSync(mcpPath)) {
      return tools;
    }

    const content = readFileContent(mcpPath);
    if (!content) {
      return tools;
    }

    const mcpConfig = JSON.parse(content) as Record<string, unknown>;
    const servers = mcpConfig.mcpServers as Record<string, unknown> | undefined;
    if (!servers || typeof servers !== 'object') {
      return tools;
    }

    const serverNames = Object.keys(servers);
    const toolNames = ['serena', 'context7', 'codex', 'gemini'] as const;

    for (const toolName of toolNames) {
      const found = serverNames.some(
        (name) => name.toLowerCase().includes(toolName),
      );
      if (found) {
        tools[toolName] = { name: toolName, detected: true };
      }
    }
  } catch {
    // MCP 설정 파싱 실패 시 기본값 반환
  }

  return tools;
}

/**
 * OMC 상태와 MCP 도구를 종합하여 전체 Capability 결과를 반환합니다.
 */
export function detectCapabilities(projectRoot: string): CapabilityResult {
  const omc = detectOmc();
  const tools = detectMcpTools(projectRoot);

  return {
    omc,
    tools: {
      serena: tools.serena ?? DEFAULT_CAPABILITY_RESULT.tools.serena,
      context7: tools.context7 ?? DEFAULT_CAPABILITY_RESULT.tools.context7,
      codex: tools.codex ?? DEFAULT_CAPABILITY_RESULT.tools.codex,
      gemini: tools.gemini ?? DEFAULT_CAPABILITY_RESULT.tools.gemini,
    },
    detectedAt: new Date().toISOString(),
  };
}

/**
 * 캐시된 Capability 결과를 읽습니다.
 */
export function getCachedCapabilities(projectRoot: string): CapabilityResult | null {
  try {
    const cachePath = harnessCapabilitiesPath(projectRoot);
    const content = readFileContent(cachePath);
    if (!content) return null;
    return JSON.parse(content) as CapabilityResult;
  } catch {
    return null;
  }
}

/**
 * Capability 결과를 캐시 파일에 저장합니다.
 */
export function cacheCapabilities(projectRoot: string, result: CapabilityResult): void {
  try {
    const cachePath = harnessCapabilitiesPath(projectRoot);
    ensureDir(dirname(cachePath));
    safeWriteFile(cachePath, JSON.stringify(result, null, 2) + '\n');
  } catch {
    // 캐시 저장 실패는 무시
  }
}

/**
 * 교차 검증에 사용할 리뷰 도구를 capabilities 기반으로 선택합니다.
 */
export function getReviewTool(projectRoot: string): { type: 'codex' | 'agent'; instruction: string } {
  const capabilities = getCachedCapabilities(projectRoot);
  if (capabilities?.tools.codex.detected) {
    return {
      type: 'codex',
      instruction:
        'Codex MCP로 코드 리뷰: ask_codex(agent_role: "code-reviewer", task: "코드 변경사항 리뷰", context_files: [변경된 파일])',
    };
  }
  return {
    type: 'agent',
    instruction:
      'Claude 에이전트로 코드 리뷰: Task(subagent_type: "code-reviewer", model: "sonnet", prompt: "변경사항 리뷰")',
  };
}

/**
 * OMC 미설치 시 에러를 throw합니다.
 */
export function requireOmc(): void {
  const status = detectOmc();
  if (!status.installed) {
    throw new Error(
      'OMC(oh-my-claudecode)가 설치되어 있지 않습니다. 설치 후 다시 시도하세요.\n설치: npm i -g oh-my-claudecode && omc setup',
    );
  }
}
