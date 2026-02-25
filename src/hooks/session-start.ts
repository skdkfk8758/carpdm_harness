import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

interface HookInput {
  cwd?: string;
  [key: string]: unknown;
}

interface HookOutput {
  result: 'continue';
  additionalContext?: string;
}

function main(): void {
  let input: HookInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = JSON.parse(raw) as HookInput;
  } catch {
    outputResult();
    return;
  }

  const cwd = input.cwd || process.cwd();
  const configPath = join(cwd, 'carpdm-harness.config.json');

  if (!existsSync(configPath)) {
    outputResult();
    return;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    const infoLines = [
      `[carpdm-harness v4] 설치됨 (preset: ${config.preset || 'unknown'})`,
      `모듈: ${(config.modules || []).join(', ')}`,
      config.updatedAt ? `마지막 업데이트: ${config.updatedAt}` : '',
    ];

    // OMC 통합 상태
    const omcConfigPath = join(homedir(), '.claude', '.omc-config.json');
    if (existsSync(omcConfigPath)) {
      try {
        const omcConfig = JSON.parse(readFileSync(omcConfigPath, 'utf-8'));
        infoLines.push(`OMC: v${omcConfig.version || 'unknown'}`);
      } catch {
        infoLines.push('OMC: 감지됨');
      }
    }

    // capabilities 캐시 요약
    const capabilitiesPath = join(cwd, '.harness', 'capabilities.json');
    if (existsSync(capabilitiesPath)) {
      try {
        const caps = JSON.parse(readFileSync(capabilitiesPath, 'utf-8'));
        const tools = caps.tools || {};
        const detected = Object.entries(tools)
          .filter(([, v]) => (v as Record<string, unknown>).detected)
          .map(([k]) => k);
        if (detected.length > 0) {
          infoLines.push(`외부 도구: ${detected.join(', ')}`);
        }
      } catch {
        // 무시
      }
    }

    // 마지막 동기화 시각
    if (config.capabilities?.detectedAt) {
      infoLines.push(`capabilities 감지: ${config.capabilities.detectedAt.slice(0, 10)}`);
    }

    // 첫 세션 온보딩 감지
    const onboardedMarker = join(cwd, '.harness', 'state', 'onboarded');
    if (!existsSync(onboardedMarker)) {
      infoLines.push(
        '[AGENT SUGGEST] 첫 세션 감지! 프로젝트 온보딩이 필요합니다. agents/onboarding-guide.md를 참조하여 온보딩 절차를 진행하세요.',
      );
      try {
        const markerDir = dirname(onboardedMarker);
        mkdirSync(markerDir, { recursive: true });
        writeFileSync(onboardedMarker, new Date().toISOString(), 'utf-8');
      } catch {
        // 마커 생성 실패는 무시
      }
    }

    const info = infoLines.filter(Boolean).join(' | ');
    outputResult(info);
  } catch {
    outputResult();
  }
}

function outputResult(additionalContext?: string): void {
  const output: HookOutput = { result: 'continue' };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}

main();
