import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { readFileContent, safeWriteFile } from './file-ops.js';
import { loadConfig } from './config.js';
import { getPackageVersion } from '../utils/version.js';

const MARKER_START = '<!-- harness:auto:start -->';
const MARKER_END = '<!-- harness:auto:end -->';

export interface ClaudeMdSyncResult {
  updated: boolean;
  reason: string;
}

/**
 * CLAUDE.md에서 마커 위치를 파싱한다.
 * 마커가 없으면 null을 반환하여 갱신을 스킵한다.
 */
export function parseMarkers(content: string): { before: string; after: string } | null {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  const before = content.slice(0, startIdx + MARKER_START.length);
  const after = content.slice(endIdx);

  return { before, after };
}

/**
 * 프로젝트 상태를 수집하여 자동 섹션 마크다운을 생성한다.
 */
export function buildAutoSection(projectRoot: string): string {
  const config = loadConfig(projectRoot);
  const version = getPackageVersion();
  const lines: string[] = [];

  lines.push('');
  lines.push(`> 이 섹션은 carpdm-harness v${version}에 의해 자동 생성됩니다. 수동으로 편집하지 마세요.`);
  lines.push('');

  // 프리셋 + 모듈
  if (config) {
    lines.push(`## Harness 설정`);
    lines.push('');
    lines.push(`- **프리셋**: ${config.preset}`);
    lines.push(`- **모듈**: ${config.modules.join(', ') || '(없음)'}`);
    lines.push('');
  }

  // 스킬 (커맨드)
  const commandsDir = join(projectRoot, '.claude', 'commands');
  const commands = listFiles(commandsDir, '.md');
  if (commands.length > 0) {
    lines.push('## 사용 가능한 스킬');
    lines.push('');
    for (const cmd of commands) {
      lines.push(`- \`/${cmd.replace('.md', '')}\``);
    }
    lines.push('');
  }

  // 훅
  const hooksDir = join(projectRoot, '.claude', 'hooks');
  const hooks = listFiles(hooksDir, '.sh');
  if (hooks.length > 0) {
    lines.push('## 활성 훅');
    lines.push('');
    for (const hook of hooks) {
      lines.push(`- \`${hook}\``);
    }
    lines.push('');
  }

  // MCP 도구 (하드코딩 대신 config.files에서 추출)
  if (config) {
    const toolModules = config.modules.filter(m => m !== 'team-memory');
    if (toolModules.length > 0) {
      lines.push('## MCP 도구 모듈');
      lines.push('');
      for (const mod of toolModules) {
        lines.push(`- \`${mod}\``);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * CLAUDE.md의 마커 영역만 교체한다.
 * 마커가 없으면 아무것도 하지 않는다.
 */
export function syncClaudeMd(projectRoot: string): ClaudeMdSyncResult {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');

  const content = readFileContent(claudeMdPath);
  if (!content) {
    return { updated: false, reason: 'CLAUDE.md 파일 없음' };
  }

  const markers = parseMarkers(content);
  if (!markers) {
    return { updated: false, reason: '마커 없음 — 갱신 스킵' };
  }

  const autoSection = buildAutoSection(projectRoot);
  const newContent = markers.before + '\n' + autoSection + '\n' + markers.after;

  if (newContent === content) {
    return { updated: false, reason: '변경 없음' };
  }

  safeWriteFile(claudeMdPath, newContent);
  return { updated: true, reason: '마커 영역 갱신 완료' };
}

function listFiles(dir: string, ext: string): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => f.endsWith(ext)).sort();
  } catch {
    return [];
  }
}
