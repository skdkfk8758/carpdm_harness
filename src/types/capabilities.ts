export interface ToolCapability {
  name: string;
  detected: boolean;
  version?: string;
  features?: string[];
}

export interface OmcStatus {
  installed: boolean;
  version?: string;
  configPath?: string;
  activeMode?: string;
}

export interface CapabilityResult {
  omc: OmcStatus;
  tools: {
    serena: ToolCapability;
    context7: ToolCapability;
    codex: ToolCapability;
    gemini: ToolCapability;
  };
  detectedAt: string;
}

export const DEFAULT_CAPABILITY_RESULT: CapabilityResult = {
  omc: { installed: false },
  tools: {
    serena: { name: 'serena', detected: false },
    context7: { name: 'context7', detected: false },
    codex: { name: 'codex', detected: false },
    gemini: { name: 'gemini', detected: false },
  },
  detectedAt: new Date().toISOString(),
};
