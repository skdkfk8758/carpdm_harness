import type { FileHash } from './common.js';
import type { OntologyConfig } from './ontology.js';
import type { CapabilityResult } from './capabilities.js';
import type { QualityGateConfig } from './quality-gate.js';
import type { WorkflowEngineConfig } from './workflow-engine.js';
import type { BehavioralGuardConfig } from './behavioral-guard.js';
import type { OverlapPreferences } from './overlap.js';

export interface HarnessConfig {
  version: string;
  installedAt: string;
  updatedAt: string;
  preset: string;
  modules: string[];
  globalCommandsInstalled: boolean;
  options: ConfigOptions;
  files: Record<string, FileHash>;
  ontology?: OntologyConfig;
  eventRetentionDays?: number;
  pluginVersion?: string;
  lastPluginUpdateAt?: string;
  capabilities?: CapabilityResult;
  planGuard?: 'block' | 'warn';
  qualityGate?: QualityGateConfig;
  workflowEngine?: WorkflowEngineConfig;
  omcConfig?: OmcConfig;
  behavioralGuard?: BehavioralGuardConfig;
  overlapPreferences?: OverlapPreferences;
  knowledge?: KnowledgeConfig;
}

export interface ConfigOptions {
  hooksRegistered: boolean;
  docsTemplatesDir: string;
  agentDir: string;
}

export const DEFAULT_CONFIG: HarnessConfig = {
  version: '1.0.0',
  installedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  preset: 'standard',
  modules: [],
  globalCommandsInstalled: false,
  options: {
    hooksRegistered: true,
    docsTemplatesDir: 'docs/templates',
    agentDir: '.agent',
  },
  files: {},
  planGuard: 'block',
};

export const CONFIG_FILENAME = 'carpdm-harness.config.json';

export interface OmcConfig {
  autoSync: boolean;
  workflowIntegration: boolean;
  ontologySync: boolean;
}

export const DEFAULT_OMC_CONFIG: OmcConfig = {
  autoSync: true,
  workflowIntegration: true,
  ontologySync: true,
};

export interface KnowledgeConfig {
  enabled: boolean;
  vaultDir: string;
  autoCreateBranch: boolean;
  autoArchive: boolean;
  syncOntology: boolean;
  publishOntology: boolean;
  syncAutoMemory: boolean;
}

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  enabled: true,
  vaultDir: '.knowledge',
  autoCreateBranch: true,
  autoArchive: true,
  syncOntology: true,
  publishOntology: false,
  syncAutoMemory: true,
};
