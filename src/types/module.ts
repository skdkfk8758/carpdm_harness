export interface ModuleDefinition {
  name: string;
  description: string;
  dependencies: string[];
  commands: ModuleFile[];
  hooks: ModuleFile[];
  docs: ModuleFile[];
  rules?: ModuleFile[];
  agents?: ModuleFile[];
  agentFiles?: ModuleFile[];
}

export interface ModuleFile {
  source: string;      // templates/ 내 상대 경로
  destination: string; // 프로젝트 내 설치 경로
  executable?: boolean;
}

export interface HookRegistration {
  event: string;       // e.g. "UserPromptSubmit", "PreToolUse", "Stop", "PostToolUse"
  command: string;     // 실행할 명령
  pattern?: string;    // 도구 이름 매칭 패턴 (PreToolUse/PostToolUse)
}

export interface ModuleManifest {
  version: string;
  modules: Record<string, ModuleDefinition>;
}

export interface PresetDefinition {
  name: string;
  description: string;
  modules: string[];
}
