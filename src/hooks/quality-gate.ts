import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
  cwd?: string;
  [key: string]: unknown;
}

interface HookOutput {
  result: 'continue' | 'block';
  additionalContext?: string;
}

function main(): void {
  let input: HookInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    input = JSON.parse(raw) as HookInput;
  } catch {
    outputResult('continue');
    return;
  }

  const toolName = input.tool_name || '';
  const toolInput = (input.tool_input || {}) as { command?: string };
  const command = toolInput.command || '';

  // Bash 도구에서 git commit 실행 시에만 트리거
  if (toolName !== 'Bash' || !/git\s+commit/.test(command)) {
    outputResult('continue');
    return;
  }

  const cwd = input.cwd || process.cwd();

  // config 확인
  const configPath = join(cwd, 'carpdm-harness.config.json');
  if (!existsSync(configPath)) {
    outputResult('continue');
    return;
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    outputResult('continue');
    return;
  }

  // qualityGate 설정 확인
  const qualityGate = (config.qualityGate || {}) as { mode?: string };
  const mode = qualityGate.mode || 'warn';

  if (mode === 'off') {
    outputResult('continue');
    return;
  }

  // OMC 모드 확인 - team/swarm 모드에서는 로깅만
  if (isOmcTeamMode(cwd)) {
    outputResult('continue', '[quality-gate] OMC team/swarm 모드 활성 - 품질 게이트 로깅만 수행');
    return;
  }

  // git staged 파일 목록 추출
  let stagedFiles: string[] = [];
  try {
    const staged = execSync('git diff --cached --name-only', { cwd, stdio: 'pipe' }).toString().trim();
    stagedFiles = staged ? staged.split('\n').filter(Boolean) : [];
  } catch {
    outputResult('continue');
    return;
  }

  if (stagedFiles.length === 0) {
    outputResult('continue');
    return;
  }

  // 경량 검증: Secured (시크릿 스캔) + Trackable (커밋 컨벤션)
  const warnings: string[] = [];

  // Secured: 시크릿 패턴 스캔
  const secretPatterns: RegExp[] = [
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i,
    /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    /(?:secret|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9]{36,}/,
  ];

  let secretFound = false;
  const secretFiles: string[] = [];
  for (const file of stagedFiles) {
    const filePath = join(cwd, file);
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, 'utf-8');
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          secretFound = true;
          secretFiles.push(file);
          break;
        }
      }
    } catch {
      // 파일 읽기 실패 무시
    }
  }

  if (secretFound) {
    warnings.push(`Secured: [ERROR] 시크릿 패턴 감지 - ${secretFiles.slice(0, 3).join(', ')}`);
  } else {
    warnings.push('Secured: [OK] 시크릿 미감지');
  }

  // Trackable: 최근 커밋 메시지 컨벤션 (커밋 진행 중이므로 --amend인 경우만 체크 가능)
  // 브랜치명 컨벤션 체크
  try {
    const branch = execSync('git branch --show-current', { cwd, stdio: 'pipe' }).toString().trim();
    const branchConvention = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|hotfix|release|main|master|develop|dev)\//;
    if (branch && branch !== 'main' && branch !== 'master' && branch !== 'develop' && branch !== 'dev') {
      if (branchConvention.test(branch)) {
        warnings.push(`Trackable: [OK] 브랜치 컨벤션 준수 (${branch})`);
      } else {
        warnings.push(`Trackable: [WARN] 브랜치 컨벤션 미준수 (${branch})`);
      }
    } else {
      warnings.push(`Trackable: [OK] 기본 브랜치 (${branch})`);
    }
  } catch {
    warnings.push('Trackable: [INFO] 브랜치 확인 실패');
  }

  const report = [
    `[quality-gate] 커밋 감지. 빠른 보안/추적 검증 결과:`,
    ...warnings.map(w => `- ${w}`),
    `전체 TRUST 5 검증은 harness_quality_check({ projectRoot: "${cwd}" }) 실행을 권장합니다.`,
  ].join('\n');

  // block 모드에서 시크릿 발견 시 차단
  if (mode === 'block' && secretFound) {
    outputResult('block', report);
    return;
  }

  // 그 외는 continue + 경고 주입
  outputResult('continue', report);
}

/** OMC team/swarm 모드 활성 여부 확인 */
function isOmcTeamMode(cwd: string): boolean {
  const omcStateDir = join(cwd, '.omc', 'state');
  if (!existsSync(omcStateDir)) return false;

  try {
    const stateFiles = readdirSync(omcStateDir).filter(f => f.endsWith('-state.json'));
    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(join(omcStateDir, file), 'utf-8')) as { active?: boolean };
        if (state.active) {
          const mode = file.replace('-state.json', '');
          if (mode === 'team' || mode === 'swarm' || mode === 'ultrapilot') {
            return true;
          }
        }
      } catch {
        // 개별 파일 파싱 실패 무시
      }
    }
  } catch {
    // 디렉토리 읽기 실패 무시
  }

  return false;
}

function outputResult(result: 'continue' | 'block', additionalContext?: string): void {
  const output: HookOutput = { result };
  if (additionalContext) {
    output.additionalContext = additionalContext;
  }
  process.stdout.write(JSON.stringify(output));
}

main();
