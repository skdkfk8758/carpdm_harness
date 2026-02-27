import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parseHookInput } from './hook-utils.js';
import { omcDir as getOmcDir, omcNotepadPath } from '../core/omc-compat.js';

interface RememberInput {
  tool_name?: string;
  tool_response?: unknown;
  cwd?: string;
  [key: string]: unknown;
}

const NOTEPAD_TEMPLATE = `# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->

## MANUAL
<!-- User content. Never auto-pruned. -->
`;

const TARGET_TOOLS = new Set(['Task', 'task', 'TaskCreate', 'TaskUpdate', 'TodoWrite']);

function getResponseText(toolResponse: unknown): string {
  if (typeof toolResponse === 'string') return toolResponse;
  if (toolResponse && typeof toolResponse === 'object') {
    const obj = toolResponse as Record<string, unknown>;
    if (typeof obj['output'] === 'string') return obj['output'];
    if (typeof obj['content'] === 'string') return obj['content'];
    try {
      return JSON.stringify(toolResponse);
    } catch {
      return '';
    }
  }
  return '';
}

function parseRememberTags(text: string): { priority: string[]; working: string[] } {
  const priority: string[] = [];
  const working: string[] = [];

  // <remember priority>...</remember>
  const priorityRegex = /<remember\s+priority>([\s\S]*?)<\/remember>/gi;
  let m: RegExpExecArray | null;
  while ((m = priorityRegex.exec(text)) !== null) {
    const content = m[1].trim();
    if (content) priority.push(content);
  }

  // <remember>...</remember> (priority 속성 없는 것만)
  const workingRegex = /<remember(?!\s+priority)>([\s\S]*?)<\/remember>/gi;
  while ((m = workingRegex.exec(text)) !== null) {
    const content = m[1].trim();
    if (content) working.push(content);
  }

  return { priority, working };
}

function readNotepad(notepadPath: string): string {
  if (!existsSync(notepadPath)) return NOTEPAD_TEMPLATE;
  try {
    return readFileSync(notepadPath, 'utf-8');
  } catch {
    return NOTEPAD_TEMPLATE;
  }
}

function updatePrioritySection(content: string, additions: string[]): string {
  const marker = '## Priority Context';
  const nextMarker = '## Working Memory';
  const idx = content.indexOf(marker);
  const nextIdx = content.indexOf(nextMarker);

  if (idx === -1) return content;

  const before = content.slice(0, idx + marker.length);
  const after = nextIdx !== -1 ? content.slice(nextIdx) : '';

  // 기존 Priority Context 섹션 내용 추출 (주석 제외)
  const sectionRaw = nextIdx !== -1
    ? content.slice(idx + marker.length, nextIdx)
    : content.slice(idx + marker.length);

  // 주석 라인 유지, 기존 텍스트 수집
  const commentLines = sectionRaw.split('\n').filter(l => l.trim().startsWith('<!--'));
  const existingText = sectionRaw.split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('<!--'))
    .join('\n')
    .trim();

  const combined = [existingText, ...additions].filter(Boolean).join('\n');
  const truncated = combined.length > 500 ? combined.slice(0, 497) + '...' : combined;

  const newSection = '\n' + commentLines.join('\n') + (commentLines.length ? '\n' : '') +
    (truncated ? truncated + '\n' : '') + '\n';

  return before + newSection + after;
}

function updateWorkingSection(content: string, additions: string[]): string {
  const marker = '## Working Memory';
  const nextMarker = '## MANUAL';
  const idx = content.indexOf(marker);
  const nextIdx = content.indexOf(nextMarker);

  if (idx === -1) return content;

  const before = content.slice(0, idx + marker.length);
  const after = nextIdx !== -1 ? content.slice(nextIdx) : '';

  const sectionRaw = nextIdx !== -1
    ? content.slice(idx + marker.length, nextIdx)
    : content.slice(idx + marker.length);

  const commentLines = sectionRaw.split('\n').filter(l => l.trim().startsWith('<!--'));
  const existingBody = sectionRaw.split('\n')
    .filter(l => !l.trim().startsWith('<!--'))
    .join('\n');

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const newEntries = additions.map(a => `[${timestamp}] ${a}`).join('\n');

  const newSection = '\n' + commentLines.join('\n') + (commentLines.length ? '\n' : '') +
    existingBody.trimEnd() + (existingBody.trim() ? '\n' : '') + newEntries + '\n\n';

  return before + newSection + after;
}

function main(): void {
  let input: RememberInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    const parsed = parseHookInput<RememberInput>(raw);
    if (!parsed) {
      process.stdout.write(JSON.stringify({ result: 'continue' }));
      return;
    }
    input = parsed;
  } catch {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const toolName = input.tool_name || '';
  if (!TARGET_TOOLS.has(toolName)) {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const cwd = input.cwd || process.cwd();
  const responseText = getResponseText(input.tool_response);
  const { priority, working } = parseRememberTags(responseText);

  if (priority.length === 0 && working.length === 0) {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  const omcBaseDir = getOmcDir(cwd);
  const notepadPath = omcNotepadPath(cwd);

  try {
    mkdirSync(omcBaseDir, { recursive: true });
  } catch {
    // 디렉토리 생성 실패 무시
  }

  try {
    let notepad = readNotepad(notepadPath);

    if (priority.length > 0) {
      notepad = updatePrioritySection(notepad, priority);
    }
    if (working.length > 0) {
      notepad = updateWorkingSection(notepad, working);
    }

    writeFileSync(notepadPath, notepad, 'utf-8');
  } catch {
    // 쓰기 실패는 무시 (훅은 항상 continue)
  }

  process.stdout.write(JSON.stringify({ result: 'continue' }));
}

main();
