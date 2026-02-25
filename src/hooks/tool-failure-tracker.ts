import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import { parseHookInput } from './hook-utils.js';
import { harnessStateDir, harnessToolErrorPath } from '../core/omc-compat.js';

interface FailureInput {
  tool_name?: string;
  tool_input?: unknown;
  error?: string;
  is_interrupt?: boolean;
  cwd?: string;
  [key: string]: unknown;
}

interface ErrorRecord {
  tool_name: string;
  tool_input_preview: string;
  error: string;
  timestamp: string;
  retry_count: number;
}

const RETRY_WINDOW_MS = 60_000;

function isPathContained(targetPath: string, containerPath: string): boolean {
  const resolvedTarget = resolve(normalize(targetPath));
  const resolvedContainer = resolve(normalize(containerPath));
  return resolvedTarget.startsWith(resolvedContainer + '/') || resolvedTarget === resolvedContainer;
}

function previewJson(value: unknown, maxLen = 200): string {
  if (value === undefined || value === null) return '';
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
  } catch {
    return '';
  }
}

function truncate(str: string, maxLen = 500): string {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

function main(): void {
  let input: FailureInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    const parsed = parseHookInput<FailureInput>(raw);
    if (!parsed) {
      process.stdout.write(JSON.stringify({ result: 'continue' }));
      return;
    }
    input = parsed;
  } catch {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  // 사용자 인터럽트는 무시
  if (input.is_interrupt === true) {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const cwd = input.cwd || process.cwd();
  const stateDir = harnessStateDir(cwd);

  // 경로 트래버설 방지
  if (!isPathContained(stateDir, cwd)) {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  try {
    mkdirSync(stateDir, { recursive: true });
  } catch {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const errorFilePath = harnessToolErrorPath(cwd);
  const toolName = input.tool_name || 'unknown';
  const now = new Date();
  const timestamp = now.toISOString();

  // retry_count 계산
  let retryCount = 0;
  if (existsSync(errorFilePath)) {
    try {
      const prev = JSON.parse(readFileSync(errorFilePath, 'utf-8')) as ErrorRecord;
      const prevTime = new Date(prev.timestamp).getTime();
      const elapsed = now.getTime() - prevTime;
      if (prev.tool_name === toolName && elapsed <= RETRY_WINDOW_MS) {
        retryCount = (prev.retry_count || 0) + 1;
      }
    } catch {
      // 기존 파일 파싱 실패 시 카운트 리셋
    }
  }

  const record: ErrorRecord = {
    tool_name: toolName,
    tool_input_preview: previewJson(input.tool_input, 200),
    error: truncate(input.error || '', 500),
    timestamp,
    retry_count: retryCount,
  };

  try {
    writeFileSync(errorFilePath, JSON.stringify(record, null, 2), 'utf-8');
  } catch {
    // 쓰기 실패 무시
  }

  process.stdout.write(JSON.stringify({ result: 'continue' }));
}

main();
