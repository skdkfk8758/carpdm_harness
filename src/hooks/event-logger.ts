import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface HookInput {
  tool_name?: string;
  tool_response?: unknown;
  session_id?: string;
  cwd?: string;
  [key: string]: unknown;
}

function main(): void {
  let input: HookInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = JSON.parse(raw) as HookInput;
  } catch {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const toolName = input.tool_name || '';
  if (!toolName.startsWith('harness_')) {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || 'unknown';
  const eventsDir = join(cwd, '.harness', 'events');

  try {
    mkdirSync(eventsDir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      tool: toolName,
      session: sessionId,
    };
    appendFileSync(join(eventsDir, `${sessionId}.jsonl`), JSON.stringify(entry) + '\n');
  } catch {
    // 기록 실패는 무시
  }

  process.stdout.write(JSON.stringify({ result: 'continue' }));
}

main();
