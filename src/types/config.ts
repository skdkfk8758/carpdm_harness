import type { FileHash } from './common.js';
import type { OntologyConfig } from './ontology.js';

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
};

export const CONFIG_FILENAME = 'carpdm-harness.config.json';
