export type FileStatus = 'UPSTREAM_CHANGED' | 'USER_MODIFIED' | 'CONFLICT' | 'UNCHANGED';

export interface FileHash {
  module: string;
  version: string;
  hash: string;
}

export interface FileChange {
  relativePath: string;
  status: FileStatus;
  currentHash: string;
  templateHash: string;
  module: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  files?: string[];
  errors?: string[];
}

export const PROTECTED_FILES = [
  'CLAUDE.md',
  '.agent',
  '.omc',
  '.mcp.json',
] as const;

export const PROTECTED_DIRS = [
  '.agent',
  '.omc',
] as const;
