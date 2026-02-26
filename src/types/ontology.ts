// === 온톨로지 설정 ===

export interface OntologyConfig {
  enabled: boolean;
  outputDir: string;                    // 기본값: '.agent/ontology'
  layers: OntologyLayerConfig;
  autoUpdate: AutoUpdateConfig;
  ai: AIProviderConfig | null;
}

export interface OntologyLayerConfig {
  structure: { enabled: boolean; maxDepth: number; excludePatterns: string[] };
  semantics: { enabled: boolean; languages: string[] };
  domain:    { enabled: boolean; provider: string; model: string; maxTokens: number; enabledSteps?: number[] };
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
  classSamples?: string;
  testFilePaths?: string[];
  interfaceSamples?: string;
  docFiles?: string[];
  docSummaries?: string;
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

// === @MX 어노테이션 ===

export type MxTag = 'ANCHOR' | 'WARN' | 'NOTE' | 'TODO';

export interface MxAnnotation {
  tag: MxTag;
  message: string;
  line?: number;
  symbolName?: string;
  metadata?: Record<string, unknown>;
}

export interface AnnotationSummary {
  total: number;
  byTag: Record<string, number>;
  topAnchors: Array<{ symbol: string; file: string; fanIn: number }>;
  warnings: Array<{ symbol: string; file: string; reason: string }>;
}

// === Layer 2: Code Semantics ===

export interface SemanticsLayer {
  files: SemanticFile[];
  symbols: SymbolIndex;
  dependencies: DependencyGraph;
  annotationSummary?: AnnotationSummary;
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
  annotations?: MxAnnotation[];
}

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  line: number;
  exported: boolean;
  signature?: string;
  jsdoc?: string;
  annotations?: MxAnnotation[];
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
  ddd?: DDDInsight;
  testMaturity?: TestMaturityInsight;
  schemaConsistency?: SchemaConsistencyInsight;
  documentationIndex?: DocumentationIndex;
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

// === Step 5: DDD 구조 인식 ===

export interface DDDInsight {
  boundedContexts: BoundedContextInsight[];
  aggregateRoots: AggregateRootInsight[];
  domainServices: string[];
  repositories: string[];
  valueObjects: string[];
  domainEvents: string[];
}

export interface BoundedContextInsight {
  name: string;
  modules: string[];
  description: string;
}

export interface AggregateRootInsight {
  name: string;
  file: string;
  entities: string[];
  valueObjects: string[];
}

// === Step 6: 테스트 성숙도 ===

export interface TestMaturityInsight {
  overallLevel: 'none' | 'basic' | 'moderate' | 'comprehensive';
  testFramework: string | null;
  testPatterns: string[];
  coverage: TestCoverageEstimate;
  gaps: TestGap[];
  recommendations: string[];
}

export interface TestCoverageEstimate {
  testedModules: string[];
  untestedModules: string[];
  ratio: string;
}

export interface TestGap {
  area: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

// === Step 7: 스키마/타입 일관성 ===

export interface SchemaConsistencyInsight {
  typeStrategy: string;
  sharedTypes: string[];
  inconsistencies: SchemaInconsistency[];
  recommendations: string[];
}

export interface SchemaInconsistency {
  type: 'duplicate-definition' | 'any-usage' | 'missing-validation' | 'naming-mismatch';
  description: string;
  files: string[];
  severity: 'error' | 'warning' | 'info';
}

// === Step 8: Documentation Indexing ===

export type DocType = 'schema' | 'api-spec' | 'guide' | 'reference' | 'runbook' | 'adr' | 'config' | 'other';

export interface DocumentInsight {
  path: string;
  title: string;
  docType: DocType;
  summary: string;
  keyConcepts: string[];
  relatedSymbols: string[];
  codeBlockLanguages: string[];
  headings: string[];
}

export interface DocumentationIndex {
  docsRoot: string;
  totalFiles: number;
  documents: DocumentInsight[];
  crossReferences: DocCrossReference[];
}

export interface DocCrossReference {
  docPath: string;
  symbolName: string;
  symbolFile: string;
  confidence: 'high' | 'medium' | 'low';
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
  annotationSummary?: AnnotationSummary;
}

// === 점진적 갱신 ===

export interface IncrementalChange {
  added: string[];
  modified: string[];
  deleted: string[];
}

export interface IncrementalChangeResult {
  changes: IncrementalChange;
  currentHashes: Record<string, string>;
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
    structure: { enabled: true, maxDepth: 10, excludePatterns: [
      // JavaScript / TypeScript
      'node_modules', '.next', '.nuxt', '.output', '.svelte-kit',
      // Python
      '.venv', 'venv', '__pycache__', '.mypy_cache', '.pytest_cache', '.ruff_cache', '.tox', '.eggs',
      // Java / Kotlin / Scala
      'target', '.gradle', '.idea',
      // Ruby
      'vendor', '.bundle',
      // Go
      '.gopath',
      // Rust
      // (target already listed above)
      // PHP
      // (vendor already listed above)
      // .NET
      'bin', 'obj', 'packages',
      // Build / Output
      'dist', 'build', 'out', 'output',
      // Test / Coverage
      'coverage', '.nyc_output',
      // Version Control / OS
      '.git', '.hg', '.svn', '.DS_Store',
      // Cache / Temp
      '.cache', '.tmp', 'tmp', '.temp',
      // IDE
      '.vscode', '.idea', '.eclipse',
      // Infrastructure
      '.terraform', '.serverless',
      // AI Agent / Tool
      '.omc', '.serena', '.agent', '.harness',
    ] },
    semantics: { enabled: true, languages: [] },
    domain:    { enabled: false, provider: 'anthropic', model: 'claude-sonnet-4-20250514', maxTokens: 4096 },
  },
  autoUpdate: {
    enabled: false,
    gitHook: 'post-commit',
    debounceMs: 5000,
    incrementalOnly: true,
  },
  ai: null,
};

// === .agent/ 인덱스 ===

export type AgentFileStatus = 'exists' | 'missing' | 'auto-generated';

export interface AgentFileInfo {
  path: string;
  status: AgentFileStatus;
  description: string;
  managed: 'auto' | 'manual' | 'semi-auto';
}

export interface OntologyIndexData {
  generatedAt: string;
  harnessVersion: string;
  agentFiles: AgentFileInfo[];
  ontologyFiles: AgentFileInfo[];
}
