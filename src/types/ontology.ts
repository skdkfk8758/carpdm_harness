// === 온톨로지 설정 ===

export interface OntologyConfig {
  enabled: boolean;
  outputDir: string;                    // 기본값: '.agent/ontology'
  layers: OntologyLayerConfig;
  autoUpdate: AutoUpdateConfig;
  plugins: string[];
  ai: AIProviderConfig | null;
}

export interface OntologyLayerConfig {
  structure: { enabled: boolean; maxDepth: number; excludePatterns: string[] };
  semantics: { enabled: boolean; languages: string[] };
  domain:    { enabled: boolean; provider: string; model: string; maxTokens: number };
}

export interface AutoUpdateConfig {
  enabled: boolean;
  gitHook: 'post-commit' | 'pre-push' | 'manual';
  debounceMs: number;
  incrementalOnly: boolean;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'claude-code' | 'custom';
  apiKeyEnv: string;
  model: string;
  maxTokensPerRequest: number;
  rateLimitMs: number;
}

export interface DomainBuildContext {
  directoryTree: string;
  packageJson: string;
  symbolSamples: string;
  entryPoints: string[];
  externalDeps: string[];
}

// === 온톨로지 데이터 모델 ===

export interface OntologyData {
  metadata: OntologyMetadata;
  structure: StructureLayer | null;
  semantics: SemanticsLayer | null;
  domain: DomainLayer | null;
}

export interface OntologyMetadata {
  projectName: string;
  generatedAt: string;
  harnessVersion: string;
  layerStatus: Record<OntologyLayerName, LayerStatus>;
}

export type OntologyLayerName = 'structure' | 'semantics' | 'domain';

export interface LayerStatus {
  enabled: boolean;
  lastBuilt: string | null;
  lastError: string | null;
  fileCount: number;
}

// === Layer 1: Structure Map ===

export interface StructureLayer {
  rootDir: string;
  tree: DirectoryNode;
  modules: ModuleRelation[];
  stats: StructureStats;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: DirectoryNode[];
  fileInfo?: FileInfo;
}

export interface FileInfo {
  extension: string;
  sizeBytes: number;
  lineCount: number;
  language: string | null;
}

export interface ModuleRelation {
  source: string;
  target: string;
  type: 'import' | 'reexport' | 'dynamic-import';
}

export interface StructureStats {
  totalFiles: number;
  totalDirs: number;
  byLanguage: Record<string, number>;
  byExtension: Record<string, number>;
}

// === Layer 2: Code Semantics ===

export interface SemanticsLayer {
  files: SemanticFile[];
  symbols: SymbolIndex;
  dependencies: DependencyGraph;
}

export interface SemanticFile {
  path: string;
  language: string;
  exports: SymbolEntry[];
  imports: ImportEntry[];
  classes: ClassEntry[];
  functions: FunctionEntry[];
  interfaces: InterfaceEntry[];
  types: TypeAliasEntry[];
}

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  line: number;
  exported: boolean;
  signature?: string;
  jsdoc?: string;
}

export type SymbolKind =
  | 'class' | 'interface' | 'type' | 'enum'
  | 'function' | 'variable' | 'constant'
  | 'method' | 'property';

export interface ImportEntry {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
  isDefault: boolean;
}

export interface ClassEntry extends SymbolEntry {
  kind: 'class';
  methods: FunctionEntry[];
  properties: SymbolEntry[];
  extends?: string;
  implements?: string[];
}

export interface FunctionEntry extends SymbolEntry {
  kind: 'function' | 'method';
  params: { name: string; type: string; optional: boolean }[];
  returnType: string;
  isAsync: boolean;
}

export interface InterfaceEntry extends SymbolEntry {
  kind: 'interface';
  properties: { name: string; type: string; optional: boolean }[];
  extends?: string[];
}

export interface TypeAliasEntry extends SymbolEntry {
  kind: 'type';
  definition: string;
}

export interface SymbolIndex {
  byName: Record<string, { file: string; line: number; kind: SymbolKind }[]>;
  exportedCount: number;
  totalCount: number;
}

export interface DependencyGraph {
  internal: ModuleRelation[];
  external: { name: string; version: string; usedBy: string[] }[];
}

// === Layer 3: Domain Knowledge ===

export interface DomainLayer {
  projectSummary: string;
  architecture: ArchitectureInsight;
  patterns: PatternInsight[];
  conventions: ConventionInsight[];
  glossary: GlossaryEntry[];
}

export interface ArchitectureInsight {
  style: string;
  layers: string[];
  keyDecisions: string[];
  entryPoints: string[];
}

export interface PatternInsight {
  name: string;
  description: string;
  files: string[];
  example?: string;
}

export interface ConventionInsight {
  category: 'naming' | 'structure' | 'error-handling' | 'testing' | 'other';
  rule: string;
  evidence: string[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  context: string;
}

// === 플러그인 ===

export interface LanguagePlugin {
  readonly name: string;
  readonly extensions: string[];
  readonly language: string;
  analyzeFile(filePath: string, content: string): Promise<SemanticFile>;
  extractImports(filePath: string, content: string): ImportEntry[];
  canHandle(filePath: string): boolean;
}

// === 빌드 결과 ===

export interface BuildResult {
  layer: OntologyLayerName;
  success: boolean;
  duration: number;
  fileCount: number;
  error?: string;
  warnings: string[];
}

export interface OntologyBuildReport {
  results: BuildResult[];
  totalDuration: number;
  outputFiles: string[];
  domainContext?: DomainBuildContext;
}

// === 점진적 갱신 ===

export interface IncrementalChange {
  added: string[];
  modified: string[];
  deleted: string[];
}

export interface OntologyCache {
  version: string;
  builtAt: string;
  fileHashes: Record<string, string>;
  layerData: {
    structure?: StructureLayer;
    semantics?: SemanticsLayer;
    domain?: DomainLayer;
  };
}

// === 기본값 ===

export const ONTOLOGY_LANGUAGE_PRESETS: Record<string, string[]> = {
  typescript: ['typescript'],
  javascript: ['javascript'],
  python: ['python'],
  go: ['go'],
  rust: ['rust'],
  java: ['java'],
  frontend: ['typescript', 'javascript'],
  backend: ['python', 'go', 'java', 'rust'],
  fullstack: ['typescript', 'javascript', 'python'],
};

export const DEFAULT_ONTOLOGY_CONFIG: OntologyConfig = {
  enabled: false,
  outputDir: '.agent/ontology',
  layers: {
    structure: { enabled: true, maxDepth: 10, excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache'] },
    semantics: { enabled: true, languages: [] },
    domain:    { enabled: false, provider: 'anthropic', model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
  autoUpdate: {
    enabled: false,
    gitHook: 'post-commit',
    debounceMs: 5000,
    incrementalOnly: true,
  },
  plugins: [],
  ai: null,
};
