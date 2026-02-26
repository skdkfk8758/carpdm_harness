import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { logger } from '../../utils/logger.js';
import type {
  DomainLayer,
  OntologyLayerConfig,
  StructureLayer,
  SemanticsLayer,
  AIProviderConfig,
  BuildResult,
  ArchitectureInsight,
  PatternInsight,
  ConventionInsight,
  GlossaryEntry,
  DomainBuildContext,
  DDDInsight,
  TestMaturityInsight,
  SchemaConsistencyInsight,
  DocumentInsight,
  DocumentationIndex,
  DocCrossReference,
  DocType,
} from '../../types/ontology.js';

// ────────────────────────────────────────────────────────────────────────────
// 캐시
// ────────────────────────────────────────────────────────────────────────────

interface DomainCache {
  inputHash: string;
  builtAt: string;
  data: DomainLayer;
}

function getCachePath(projectRoot: string): string {
  return join(projectRoot, '.agent', 'ontology', '.cache', 'domain-cache.json');
}

function loadDomainCache(projectRoot: string): DomainCache | null {
  try {
    const cachePath = getCachePath(projectRoot);
    const raw = readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as DomainCache;
  } catch {
    return null;
  }
}

function saveDomainCache(projectRoot: string, cache: DomainCache): void {
  try {
    const cachePath = getCachePath(projectRoot);
    mkdirSync(join(projectRoot, '.agent', 'ontology', '.cache'), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    logger.warn(`도메인 캐시 저장 실패: ${String(err)}`);
  }
}

function computeInputHash(
  structureLayer: StructureLayer,
  semanticsLayer: SemanticsLayer | null,
): string {
  const payload = JSON.stringify({
    structureStats: structureLayer.stats,
    moduleCount: structureLayer.modules.length,
    semanticsFileCount: semanticsLayer?.files.length ?? 0,
    symbolCount: semanticsLayer?.symbols.totalCount ?? 0,
  });
  return createHash('sha256').update(payload).digest('hex');
}

// ────────────────────────────────────────────────────────────────────────────
// AI API 호출
// ────────────────────────────────────────────────────────────────────────────

/** API 호출 결과 */
interface ApiResponse {
  content: string;
}

/** 대기 유틸 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Anthropic Messages API 호출 */
async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
  maxTokens: number,
): Promise<ApiResponse> {
  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Anthropic API 오류 ${res.status}: ${await res.text()}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const content = (data?.content?.[0]?.text as string | undefined) ?? '';
  return { content };
}

/** OpenAI Chat Completions API 호출 */
async function callOpenAI(
  prompt: string,
  apiKey: string,
  model: string,
  maxTokens: number,
): Promise<ApiResponse> {
  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`OpenAI API 오류 ${res.status}: ${await res.text()}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const content = (data?.choices?.[0]?.message?.content as string | undefined) ?? '';
  return { content };
}

/** AI 프로바이더 라우팅 */
async function callAI(
  prompt: string,
  aiConfig: AIProviderConfig,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env[aiConfig.apiKeyEnv] ?? '';
  if (!apiKey) {
    throw new Error(`API 키 환경변수 '${aiConfig.apiKeyEnv}'가 설정되지 않았습니다.`);
  }

  let response: ApiResponse;
  switch (aiConfig.provider) {
    case 'anthropic':
      response = await callAnthropic(prompt, apiKey, aiConfig.model, maxTokens);
      break;
    case 'openai':
      response = await callOpenAI(prompt, apiKey, aiConfig.model, maxTokens);
      break;
    default:
      // custom: openai 호환 형식으로 시도
      response = await callOpenAI(prompt, apiKey, aiConfig.model, maxTokens);
      break;
  }

  return response.content;
}

/** JSON 파싱 시도, 실패 시 폴백 값 반환 */
function tryParseJSON<T>(text: string, fallback: T): T {
  // 마크다운 코드 블록 제거
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 프롬프트 구성 유틸
// ────────────────────────────────────────────────────────────────────────────

/** 디렉토리 트리 요약 텍스트 생성 (최대 50개 항목) */
function summarizeDirectoryTree(structureLayer: StructureLayer): string {
  const lines: string[] = [];
  let count = 0;

  function walk(node: import('../../types/ontology.js').DirectoryNode, depth: number): void {
    if (count >= 50) return;
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${node.name}${node.type === 'directory' ? '/' : ''}`);
    count++;
    for (const child of node.children ?? []) {
      walk(child, depth + 1);
    }
  }

  walk(structureLayer.tree, 0);
  if (count >= 50) lines.push('  ... (이하 생략)');
  return lines.join('\n');
}

/** package.json 내용 읽기 */
function readPackageJson(projectRoot: string): string {
  try {
    return readFileSync(join(projectRoot, 'package.json'), 'utf-8');
  } catch {
    return '{}';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4단계 AI 분석
// ────────────────────────────────────────────────────────────────────────────

async function runStep1ProjectSummary(
  projectRoot: string,
  structureLayer: StructureLayer,
  aiConfig: AIProviderConfig,
): Promise<string> {
  const treeText = summarizeDirectoryTree(structureLayer);
  const pkgJson = readPackageJson(projectRoot);

  const prompt = `다음은 TypeScript 프로젝트의 디렉토리 구조와 package.json입니다.
이 프로젝트가 무엇을 하는지 1-3문장으로 간결하게 요약하세요.
JSON 형식으로 { "summary": "..." } 형태로 응답하세요.

## 디렉토리 트리
${treeText}

## package.json
${pkgJson}`;

  try {
    const raw = await callAI(prompt, aiConfig, 1024);
    const parsed = tryParseJSON<{ summary?: string }>(raw, {});
    return parsed.summary ?? raw.slice(0, 500);
  } catch (err) {
    logger.warn(`Step1 Project Summary 실패: ${String(err)}`);
    return '';
  }
}

async function runStep2Architecture(
  structureLayer: StructureLayer,
  semanticsLayer: SemanticsLayer | null,
  aiConfig: AIProviderConfig,
): Promise<ArchitectureInsight> {
  const entryPoints = structureLayer.modules
    .filter((m) => m.source.includes('index') || m.source.includes('main') || m.source.includes('cli'))
    .map((m) => m.source)
    .slice(0, 10);

  const depSummary = semanticsLayer?.dependencies.external
    .map((d) => `${d.name}@${d.version}`)
    .join(', ') ?? '';

  const prompt = `다음은 프로젝트 진입점 파일 목록과 외부 의존성입니다.
아키텍처 스타일, 계층, 핵심 결정 사항을 분석하세요.
JSON 형식으로 응답하세요:
{
  "style": "아키텍처 스타일 (예: layered, modular, microservices 등)",
  "layers": ["계층1", "계층2"],
  "keyDecisions": ["결정1", "결정2"],
  "entryPoints": ["파일1", "파일2"]
}

## 진입점 파일
${entryPoints.join('\n') || '(없음)'}

## 외부 의존성
${depSummary || '(없음)'}`;

  try {
    const raw = await callAI(prompt, aiConfig, 2048);
    const parsed = tryParseJSON<Partial<ArchitectureInsight>>(raw, {});
    return {
      style: parsed.style ?? 'unknown',
      layers: parsed.layers ?? [],
      keyDecisions: parsed.keyDecisions ?? [],
      entryPoints: parsed.entryPoints ?? entryPoints,
    };
  } catch (err) {
    logger.warn(`Step2 Architecture 실패: ${String(err)}`);
    return { style: 'unknown', layers: [], keyDecisions: [], entryPoints: entryPoints };
  }
}

async function runStep3Patterns(
  semanticsLayer: SemanticsLayer | null,
  aiConfig: AIProviderConfig,
): Promise<{ patterns: PatternInsight[]; conventions: ConventionInsight[] }> {
  if (!semanticsLayer || semanticsLayer.files.length === 0) {
    return { patterns: [], conventions: [] };
  }

  // 심볼 시그니처 샘플 추출 (최대 30개)
  const symbolSamples = semanticsLayer.files
    .flatMap((f) =>
      f.exports.slice(0, 3).map((s) => `${f.path}:${s.line} — ${s.kind} ${s.name}`),
    )
    .slice(0, 30)
    .join('\n');

  const prompt = `다음은 프로젝트의 심볼 시그니처 샘플입니다.
반복 패턴과 코딩 컨벤션을 분석하세요.
JSON 형식으로 응답하세요:
{
  "patterns": [
    { "name": "패턴명", "description": "설명", "files": ["파일1"], "example": "예시" }
  ],
  "conventions": [
    { "category": "naming|structure|error-handling|testing|other", "rule": "규칙", "evidence": ["증거1"] }
  ]
}

## 심볼 샘플
${symbolSamples}`;

  try {
    const raw = await callAI(prompt, aiConfig, 2048);
    const parsed = tryParseJSON<{
      patterns?: PatternInsight[];
      conventions?: ConventionInsight[];
    }>(raw, {});
    return {
      patterns: parsed.patterns ?? [],
      conventions: parsed.conventions ?? [],
    };
  } catch (err) {
    logger.warn(`Step3 Patterns 실패: ${String(err)}`);
    return { patterns: [], conventions: [] };
  }
}

async function runStep4Glossary(
  _projectRoot: string,
  structureLayer: StructureLayer,
  aiConfig: AIProviderConfig,
): Promise<GlossaryEntry[]> {
  const treeText = summarizeDirectoryTree(structureLayer);

  const prompt = `다음은 프로젝트 디렉토리 구조입니다.
이 프로젝트 도메인에서 사용되는 주요 용어와 개념을 추출하세요.
JSON 형식으로 응답하세요:
{
  "glossary": [
    { "term": "용어", "definition": "정의", "context": "사용 맥락" }
  ]
}

## 디렉토리 트리
${treeText}`;

  try {
    const raw = await callAI(prompt, aiConfig, 1024);
    const parsed = tryParseJSON<{ glossary?: GlossaryEntry[] }>(raw, {});
    return parsed.glossary ?? [];
  } catch (err) {
    logger.warn(`Step4 Glossary 실패: ${String(err)}`);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Step 5-7: 확장 분석
// ────────────────────────────────────────────────────────────────────────────

/** 클래스/인터페이스 시그니처 샘플 추출 (최대 40개) */
function extractClassSamples(semanticsLayer: SemanticsLayer): string {
  const samples: string[] = [];
  for (const f of semanticsLayer.files) {
    for (const cls of f.classes.slice(0, 3)) {
      const methods = cls.methods.map((m) => m.name).join(', ');
      const props = cls.properties.map((p) => p.name).join(', ');
      samples.push(`${f.path} — class ${cls.name} { methods: [${methods}], props: [${props}] }${cls.extends ? ` extends ${cls.extends}` : ''}${cls.implements?.length ? ` implements ${cls.implements.join(', ')}` : ''}`);
    }
    if (samples.length >= 40) break;
  }
  return samples.slice(0, 40).join('\n');
}

/** 인터페이스/타입 시그니처 샘플 추출 (최대 40개) */
function extractInterfaceSamples(semanticsLayer: SemanticsLayer): string {
  const samples: string[] = [];
  for (const f of semanticsLayer.files) {
    for (const iface of f.interfaces.slice(0, 3)) {
      const props = iface.properties.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
      samples.push(`${f.path}:${iface.line} — interface ${iface.name} { ${props} }${iface.extends?.length ? ` extends ${iface.extends.join(', ')}` : ''}`);
    }
    for (const t of f.types.slice(0, 2)) {
      samples.push(`${f.path}:${t.line} — type ${t.name} = ${t.definition.slice(0, 80)}`);
    }
    if (samples.length >= 40) break;
  }
  return samples.slice(0, 40).join('\n');
}

/** 테스트 파일 경로 추출 */
function extractTestFilePaths(structureLayer: StructureLayer): string[] {
  const testPaths: string[] = [];

  function walk(node: import('../../types/ontology.js').DirectoryNode): void {
    if (node.type === 'file') {
      const name = node.name.toLowerCase();
      if (
        name.includes('.test.') || name.includes('.spec.') ||
        name.includes('_test.') || name.includes('_spec.') ||
        name.startsWith('test_') || name.startsWith('test.')
      ) {
        testPaths.push(node.path);
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(structureLayer.tree);
  return testPaths;
}

async function runStep5DDD(
  semanticsLayer: SemanticsLayer | null,
  structureLayer: StructureLayer,
  architecture: ArchitectureInsight,
  aiConfig: AIProviderConfig,
): Promise<DDDInsight> {
  const empty: DDDInsight = {
    boundedContexts: [], aggregateRoots: [], domainServices: [],
    repositories: [], valueObjects: [], domainEvents: [],
  };

  if (!semanticsLayer || semanticsLayer.files.length === 0) {
    return empty;
  }

  const classSamples = extractClassSamples(semanticsLayer);
  if (!classSamples) return empty;

  const moduleRelations = structureLayer.modules
    .slice(0, 30)
    .map((m) => `${m.source} → ${m.target}`)
    .join('\n');

  const prompt = `다음은 프로젝트의 클래스/인터페이스 시그니처, 모듈 관계, 아키텍처 정보입니다.
DDD(Domain-Driven Design) 관점에서 분석하세요.
JSON 형식으로 응답하세요:
{
  "boundedContexts": [{ "name": "컨텍스트명", "modules": ["모듈1"], "description": "설명" }],
  "aggregateRoots": [{ "name": "클래스명", "file": "파일경로", "entities": ["엔티티1"], "valueObjects": ["VO1"] }],
  "domainServices": ["서비스명"],
  "repositories": ["레포지토리명"],
  "valueObjects": ["VO명"],
  "domainEvents": ["이벤트명"]
}
DDD 패턴이 명확하지 않으면 가장 유사한 구조를 식별하세요.
배열이 비어있어도 괜찮습니다.

## 아키텍처
스타일: ${architecture.style}
계층: ${architecture.layers.join(', ')}

## 클래스/인터페이스 시그니처
${classSamples}

## 모듈 관계
${moduleRelations || '(없음)'}`;

  try {
    const raw = await callAI(prompt, aiConfig, 2048);
    const parsed = tryParseJSON<Partial<DDDInsight>>(raw, {});
    return {
      boundedContexts: parsed.boundedContexts ?? [],
      aggregateRoots: parsed.aggregateRoots ?? [],
      domainServices: parsed.domainServices ?? [],
      repositories: parsed.repositories ?? [],
      valueObjects: parsed.valueObjects ?? [],
      domainEvents: parsed.domainEvents ?? [],
    };
  } catch (err) {
    logger.warn(`Step5 DDD 분석 실패: ${String(err)}`);
    return empty;
  }
}

async function runStep6TestMaturity(
  projectRoot: string,
  structureLayer: StructureLayer,
  semanticsLayer: SemanticsLayer | null,
  aiConfig: AIProviderConfig,
): Promise<TestMaturityInsight> {
  const empty: TestMaturityInsight = {
    overallLevel: 'none', testFramework: null, testPatterns: [],
    coverage: { testedModules: [], untestedModules: [], ratio: '0/0' },
    gaps: [], recommendations: [],
  };

  const testFiles = extractTestFilePaths(structureLayer);
  const pkgJson = readPackageJson(projectRoot);

  const testFileList = testFiles.slice(0, 30).join('\n') || '(테스트 파일 없음)';
  const treeText = summarizeDirectoryTree(structureLayer);

  // 심볼에서 테스트 관련 함수 추출
  const testSymbols = semanticsLayer
    ? semanticsLayer.files
        .filter((f) => testFiles.some((tf) => f.path.includes(tf.split('/').pop() ?? '')))
        .flatMap((f) => f.functions.slice(0, 3).map((fn) => `${f.path}: ${fn.name}`))
        .slice(0, 20)
        .join('\n')
    : '';

  const prompt = `다음은 프로젝트의 테스트 파일 목록, 디렉토리 구조, package.json입니다.
테스트 성숙도를 분석하세요.
JSON 형식으로 응답하세요:
{
  "overallLevel": "none|basic|moderate|comprehensive",
  "testFramework": "프레임워크명 또는 null",
  "testPatterns": ["패턴1"],
  "coverage": {
    "testedModules": ["모듈1"],
    "untestedModules": ["모듈1"],
    "ratio": "12/20 modules"
  },
  "gaps": [{ "area": "영역", "description": "설명", "priority": "high|medium|low" }],
  "recommendations": ["권장1"]
}

## 테스트 파일 (${testFiles.length}개)
${testFileList}

## 테스트 심볼 샘플
${testSymbols || '(없음)'}

## 디렉토리 트리
${treeText}

## package.json
${pkgJson}`;

  try {
    const raw = await callAI(prompt, aiConfig, 1024);
    const parsed = tryParseJSON<Partial<TestMaturityInsight>>(raw, {});
    return {
      overallLevel: parsed.overallLevel ?? (testFiles.length === 0 ? 'none' : 'basic'),
      testFramework: parsed.testFramework ?? null,
      testPatterns: parsed.testPatterns ?? [],
      coverage: parsed.coverage ?? { testedModules: [], untestedModules: [], ratio: `${testFiles.length} test files` },
      gaps: parsed.gaps ?? [],
      recommendations: parsed.recommendations ?? [],
    };
  } catch (err) {
    logger.warn(`Step6 Test Maturity 분석 실패: ${String(err)}`);
    return empty;
  }
}

async function runStep7SchemaConsistency(
  semanticsLayer: SemanticsLayer | null,
  aiConfig: AIProviderConfig,
): Promise<SchemaConsistencyInsight> {
  const empty: SchemaConsistencyInsight = {
    typeStrategy: 'unknown', sharedTypes: [], inconsistencies: [], recommendations: [],
  };

  if (!semanticsLayer || semanticsLayer.files.length === 0) {
    return empty;
  }

  const interfaceSamples = extractInterfaceSamples(semanticsLayer);
  if (!interfaceSamples) return empty;

  const externalDeps = semanticsLayer.dependencies.external
    .map((d) => d.name)
    .join(', ');

  const prompt = `다음은 프로젝트의 인터페이스/타입 정의 샘플과 외부 의존성입니다.
스키마와 타입 일관성을 분석하세요.
JSON 형식으로 응답하세요:
{
  "typeStrategy": "strict|loose|mixed",
  "sharedTypes": ["공유타입1"],
  "inconsistencies": [{
    "type": "duplicate-definition|any-usage|missing-validation|naming-mismatch",
    "description": "설명",
    "files": ["파일1"],
    "severity": "error|warning|info"
  }],
  "recommendations": ["권장1"]
}
불일치가 없으면 빈 배열로 응답하세요.

## 인터페이스/타입 시그니처
${interfaceSamples}

## 외부 의존성
${externalDeps || '(없음)'}`;

  try {
    const raw = await callAI(prompt, aiConfig, 1024);
    const parsed = tryParseJSON<Partial<SchemaConsistencyInsight>>(raw, {});
    return {
      typeStrategy: parsed.typeStrategy ?? 'unknown',
      sharedTypes: parsed.sharedTypes ?? [],
      inconsistencies: parsed.inconsistencies ?? [],
      recommendations: parsed.recommendations ?? [],
    };
  } catch (err) {
    logger.warn(`Step7 Schema Consistency 분석 실패: ${String(err)}`);
    return empty;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Step 8: Documentation Indexing
// ────────────────────────────────────────────────────────────────────────────

const DOC_DIRS = ['docs', 'doc', 'documentation'];
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.yaml', '.yml']);
const MAX_DOC_DEPTH = 3;
const MAX_DOC_CONTENT_CHARS = 2000;

/** docs 디렉토리에서 문서 파일 스캔 */
export function scanDocFiles(projectRoot: string): { docsRoot: string; files: string[] } {
  for (const dir of DOC_DIRS) {
    const absDir = join(projectRoot, dir);
    if (existsSync(absDir) && statSync(absDir).isDirectory()) {
      const files = collectDocFilesRecursive(absDir, 0);
      return { docsRoot: dir, files: files.map((f) => relative(projectRoot, f)) };
    }
  }
  return { docsRoot: '', files: [] };
}

function collectDocFilesRecursive(dir: string, depth: number): string[] {
  if (depth > MAX_DOC_DEPTH) return [];
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...collectDocFilesRecursive(fullPath, depth + 1));
      } else if (entry.isFile() && DOC_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch {
    // 읽기 실패 시 무시
  }
  return results;
}

/** 문서 내용에서 제목 추출 (첫 번째 H1 또는 파일명) */
function extractTitle(content: string, filePath: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return basename(filePath, extname(filePath));
}

/** 마크다운 헤딩 추출 */
function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const match of content.matchAll(/^(#{1,4})\s+(.+)$/gm)) {
    headings.push(`${'#'.repeat(match[1].length)} ${match[2].trim()}`);
  }
  return headings;
}

/** 코드 블록 언어 태그 추출 */
function extractCodeBlockLanguages(content: string): string[] {
  const langs = new Set<string>();
  for (const match of content.matchAll(/^```(\w+)/gm)) {
    langs.add(match[1].toLowerCase());
  }
  return [...langs];
}

/** docType 추론 휴리스틱 */
export function inferDocType(content: string, filePath: string): DocType {
  const lower = content.toLowerCase();
  const name = basename(filePath).toLowerCase();

  if (/create\s+table|alter\s+table/i.test(content)) return 'schema';
  if (lower.includes('openapi:') || lower.includes('swagger:')) return 'api-spec';
  if (name.includes('adr') || /##\s*(decision|status)/i.test(content)) return 'adr';
  if (name.includes('runbook') || /##\s*(steps|procedure)/i.test(content)) return 'runbook';
  if (name.includes('guide') || name.includes('tutorial')) return 'guide';
  if (name.includes('reference') || name.includes('api')) return 'reference';

  const ext = extname(filePath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml' || ext === '.json') return 'config';

  return 'other';
}

/** Phase A: 로컬 파싱 (AI 불필요) */
export function parseDocLocally(projectRoot: string, relPath: string): DocumentInsight {
  const absPath = join(projectRoot, relPath);
  let content = '';
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch {
    // 읽기 실패
  }

  return {
    path: relPath,
    title: extractTitle(content, relPath),
    docType: inferDocType(content, relPath),
    summary: '',
    keyConcepts: [],
    relatedSymbols: [],
    codeBlockLanguages: extractCodeBlockLanguages(content),
    headings: extractHeadings(content),
  };
}

/** Semantics Layer 심볼과 문서 내용 크로스레퍼런스 */
export function buildCrossReferences(
  projectRoot: string,
  docFiles: string[],
  semanticsLayer: SemanticsLayer | null,
): DocCrossReference[] {
  if (!semanticsLayer) return [];

  // exported 심볼 목록 수집 (이름 → 파일 매핑)
  const symbolMap = new Map<string, string>();
  for (const [name, entries] of Object.entries(semanticsLayer.symbols.byName)) {
    if (name.length < 3) continue; // 너무 짧은 심볼 무시
    if (entries.length > 0) {
      symbolMap.set(name, entries[0].file);
    }
  }

  const refs: DocCrossReference[] = [];

  for (const docPath of docFiles) {
    let content = '';
    try {
      content = readFileSync(join(projectRoot, docPath), 'utf-8');
    } catch {
      continue;
    }

    for (const [symbolName, symbolFile] of symbolMap) {
      // 정확한 단어 경계 매칭
      const wordRegex = new RegExp(`\\b${symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (wordRegex.test(content)) {
        refs.push({
          docPath,
          symbolName,
          symbolFile,
          confidence: 'high',
        });
      }
    }
  }

  return refs;
}

/** Phase B: AI 기반 문서 분석 — 각 문서의 요약 + 핵심 개념 + 관련 심볼 */
async function runStep8DocIndexing(
  projectRoot: string,
  semanticsLayer: SemanticsLayer | null,
  aiConfig: AIProviderConfig,
): Promise<DocumentationIndex> {
  const empty: DocumentationIndex = { docsRoot: '', totalFiles: 0, documents: [], crossReferences: [] };

  const { docsRoot, files } = scanDocFiles(projectRoot);
  if (files.length === 0) return empty;

  // Phase A: 로컬 파싱
  const documents = files.map((f) => parseDocLocally(projectRoot, f));

  // Phase A: 크로스레퍼런스
  const crossReferences = buildCrossReferences(projectRoot, files, semanticsLayer);

  // 심볼 이름 목록 (AI에 전달)
  const symbolNames = semanticsLayer
    ? Object.keys(semanticsLayer.symbols.byName).slice(0, 50).join(', ')
    : '';

  // Phase B: AI 분석 (각 문서에 대해)
  for (const doc of documents) {
    let content = '';
    try {
      content = readFileSync(join(projectRoot, doc.path), 'utf-8');
    } catch {
      continue;
    }

    // 대용량 문서 잘라내기
    const truncated = content.length > MAX_DOC_CONTENT_CHARS
      ? content.slice(0, MAX_DOC_CONTENT_CHARS) + '\n... (이하 생략)'
      : content;

    const prompt = `다음은 프로젝트 문서 파일입니다.
요약, 핵심 개념, 관련 코드 심볼을 분석하세요.
JSON 형식으로 응답하세요:
{
  "summary": "1-2문장 요약",
  "keyConcepts": ["개념1", "개념2"],
  "relatedSymbols": ["심볼1", "심볼2"]
}

## 파일: ${doc.path}
## 감지된 유형: ${doc.docType}
## 프로젝트 심볼 목록 (참고용)
${symbolNames || '(없음)'}

## 문서 내용
${truncated}`;

    try {
      const raw = await callAI(prompt, aiConfig, 512);
      const parsed = tryParseJSON<{
        summary?: string;
        keyConcepts?: string[];
        relatedSymbols?: string[];
      }>(raw, {});

      doc.summary = parsed.summary ?? '';
      doc.keyConcepts = parsed.keyConcepts ?? [];
      // AI가 식별한 추가 관련 심볼
      if (parsed.relatedSymbols) {
        const existingSymbols = new Set(doc.relatedSymbols);
        for (const sym of parsed.relatedSymbols) {
          if (!existingSymbols.has(sym)) {
            doc.relatedSymbols.push(sym);
          }
        }
      }

      await sleep(aiConfig.rateLimitMs);
    } catch (err) {
      logger.warn(`Step8 문서 분석 실패 (${doc.path}): ${String(err)}`);
      // Phase A 결과만 유지
    }
  }

  // 크로스레퍼런스의 심볼을 각 문서의 relatedSymbols에 반영
  for (const ref of crossReferences) {
    const doc = documents.find((d) => d.path === ref.docPath);
    if (doc && !doc.relatedSymbols.includes(ref.symbolName)) {
      doc.relatedSymbols.push(ref.symbolName);
    }
  }

  return {
    docsRoot,
    totalFiles: files.length,
    documents,
    crossReferences,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Domain 빌드용 context 데이터 수집 (API 호출 없이)
 * claude-code provider에서 사용: context만 수집하여 Claude Code가 분석하도록 반환
 */
export function collectDomainContext(
  projectRoot: string,
  structureLayer: StructureLayer,
  semanticsLayer: SemanticsLayer | null,
): DomainBuildContext {
  const directoryTree = summarizeDirectoryTree(structureLayer);
  const packageJson = readPackageJson(projectRoot);

  const entryPoints = structureLayer.modules
    .filter((m) => m.source.includes('index') || m.source.includes('main') || m.source.includes('cli'))
    .map((m) => m.source)
    .slice(0, 10);

  const externalDeps = semanticsLayer?.dependencies.external
    .map((d) => `${d.name}@${d.version}`)
    ?? [];

  const symbolSamples = semanticsLayer
    ? semanticsLayer.files
        .flatMap((f) =>
          f.exports.slice(0, 3).map((s) => `${f.path}:${s.line} — ${s.kind} ${s.name}`),
        )
        .slice(0, 30)
        .join('\n')
    : '';

  const classSamples = semanticsLayer ? extractClassSamples(semanticsLayer) : undefined;
  const interfaceSamples = semanticsLayer ? extractInterfaceSamples(semanticsLayer) : undefined;
  const testFilePaths = extractTestFilePaths(structureLayer);

  const { files: docFiles } = scanDocFiles(projectRoot);

  // 각 문서 파일의 제목 + 유형 요약
  const docSummaries = docFiles.length > 0
    ? docFiles.map((f) => {
        const parsed = parseDocLocally(projectRoot, f);
        return `${f} — [${parsed.docType}] ${parsed.title}`;
      }).join('\n')
    : undefined;

  return {
    directoryTree, packageJson, symbolSamples, entryPoints, externalDeps,
    classSamples: classSamples || undefined,
    testFilePaths: testFilePaths.length > 0 ? testFilePaths : undefined,
    interfaceSamples: interfaceSamples || undefined,
    docFiles: docFiles.length > 0 ? docFiles : undefined,
    docSummaries,
  };
}

/**
 * Layer 3 전체 빌드
 * 4단계 AI 프롬프트로 도메인 지식을 추출합니다.
 * 캐시가 유효하면 AI 호출을 스킵합니다.
 */
export async function buildDomainLayer(
  projectRoot: string,
  structureLayer: StructureLayer,
  semanticsLayer: SemanticsLayer | null,
  _config: OntologyLayerConfig['domain'],
  aiConfig: AIProviderConfig,
): Promise<BuildResult & { data: DomainLayer }> {
  const startTime = Date.now();
  logger.info('Domain Layer 빌드 시작');

  const warnings: string[] = [];

  // AI config null 체크 — graceful return
  if (!aiConfig) {
    logger.warn('AI 설정이 없어 Domain Layer를 건너뜁니다.');
    return {
      layer: 'domain',
      success: true,
      duration: Date.now() - startTime,
      fileCount: 0,
      warnings: ['AI 설정 누락으로 Domain Layer 스킵'],
      data: {
        projectSummary: '',
        architecture: { style: 'unknown', layers: [], keyDecisions: [], entryPoints: [] },
        patterns: [],
        conventions: [],
        glossary: [],
      },
    };
  }

  // 입력 해시 계산 및 캐시 확인
  const inputHash = computeInputHash(structureLayer, semanticsLayer);
  const cached = loadDomainCache(projectRoot);
  if (cached && cached.inputHash === inputHash) {
    logger.ok('Domain Layer 캐시 히트 — AI 호출 스킵');
    const duration = Date.now() - startTime;
    return {
      layer: 'domain',
      success: true,
      duration,
      fileCount: 0,
      warnings,
      data: cached.data,
    };
  }

  // Step 1: 프로젝트 요약
  logger.dim('Step 1/8: 프로젝트 요약 생성 중...');
  const projectSummary = await runStep1ProjectSummary(projectRoot, structureLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 2: 아키텍처 분석
  logger.dim('Step 2/8: 아키텍처 분석 중...');
  const architecture = await runStep2Architecture(structureLayer, semanticsLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 3: 패턴 및 컨벤션 감지
  logger.dim('Step 3/8: 패턴 및 컨벤션 감지 중...');
  const { patterns, conventions } = await runStep3Patterns(semanticsLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 4: 용어집 추출
  logger.dim('Step 4/8: 용어집 추출 중...');
  const glossary = await runStep4Glossary(projectRoot, structureLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 5: DDD 구조 인식
  logger.dim('Step 5/8: DDD 구조 분석 중...');
  const ddd = await runStep5DDD(semanticsLayer, structureLayer, architecture, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 6: 테스트 성숙도 평가
  logger.dim('Step 6/8: 테스트 성숙도 분석 중...');
  const testMaturity = await runStep6TestMaturity(projectRoot, structureLayer, semanticsLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 7: 스키마/타입 일관성 분석
  logger.dim('Step 7/8: 스키마/타입 일관성 분석 중...');
  const schemaConsistency = await runStep7SchemaConsistency(semanticsLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 8: Documentation Indexing
  logger.dim('Step 8/8: 문서 인덱싱 중...');
  const documentationIndex = await runStep8DocIndexing(projectRoot, semanticsLayer, aiConfig);

  const domainData: DomainLayer = {
    projectSummary,
    architecture,
    patterns,
    conventions,
    glossary,
    ddd,
    testMaturity,
    schemaConsistency,
    documentationIndex: documentationIndex.totalFiles > 0 ? documentationIndex : undefined,
  };

  // 캐시 저장
  saveDomainCache(projectRoot, {
    inputHash,
    builtAt: new Date().toISOString(),
    data: domainData,
  });

  const duration = Date.now() - startTime;
  const docCount = documentationIndex.totalFiles;
  logger.ok(`Domain Layer 빌드 완료 — 패턴 ${patterns.length}개, 용어 ${glossary.length}개, DDD ${ddd.boundedContexts.length} BC, 문서 ${docCount}개 (${duration}ms)`);

  return {
    layer: 'domain',
    success: true,
    duration,
    fileCount: 0,
    warnings,
    data: domainData,
  };
}
