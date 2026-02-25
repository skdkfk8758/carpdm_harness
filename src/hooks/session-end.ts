import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface HookInput {
  cwd?: string;
  session_id?: string;
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

  const cwd = input.cwd || process.cwd();
  const configPath = join(cwd, 'carpdm-harness.config.json');

  if (!existsSync(configPath)) {
    process.stdout.write(JSON.stringify({ result: 'continue' }));
    return;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    // autoSync가 활성화되어 있고 team-memory 모듈이 설치된 경우
    const omcConfig = config.omcConfig || {};
    const hasTeamMemory = (config.modules || []).includes('team-memory');

    if (omcConfig.autoSync !== false && hasTeamMemory) {
      // team-memory.json 존재 확인
      const teamMemoryPath = join(cwd, '.harness', 'team-memory.json');
      const omcProjectMemoryPath = join(cwd, '.omc', 'project-memory.json');

      if (existsSync(teamMemoryPath) && existsSync(omcProjectMemoryPath)) {
        // 간단한 동기화: team-memory의 conventions를 omc project-memory에 반영
        try {
          const teamMemory = JSON.parse(readFileSync(teamMemoryPath, 'utf-8'));
          const omcMemory = JSON.parse(readFileSync(omcProjectMemoryPath, 'utf-8'));

          // conventions 동기화
          if (teamMemory.conventions && Array.isArray(teamMemory.conventions)) {
            const conventionTexts = teamMemory.conventions
              .map((c: Record<string, unknown>) => c.title || c.content || '')
              .filter(Boolean);

            if (conventionTexts.length > 0) {
              const existingConventions = omcMemory.conventions || '';
              const newConventions = conventionTexts.join('\n');

              if (existingConventions !== newConventions) {
                // 변경 감지 시 알림만 (직접 쓰기는 하지 않음 - 훅에서는 안전하게)
                process.stdout.write(JSON.stringify({
                  result: 'continue',
                  additionalContext: '[harness-session-end] 팀 메모리 변경 감지. `harness_sync`로 OMC 동기화를 권장합니다.'
                }));
                return;
              }
            }
          }
        } catch {
          // 동기화 확인 실패 무시
        }
      }
    }
  } catch {
    // 설정 읽기 실패 무시
  }

  process.stdout.write(JSON.stringify({ result: 'continue' }));
}

main();
