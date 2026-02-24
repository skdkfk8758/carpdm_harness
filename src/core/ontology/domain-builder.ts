import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

  return { directoryTree, packageJson, symbolSamples, entryPoints, externalDeps };
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
  logger.dim('Step 1/4: 프로젝트 요약 생성 중...');
  const projectSummary = await runStep1ProjectSummary(projectRoot, structureLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 2: 아키텍처 분석
  logger.dim('Step 2/4: 아키텍처 분석 중...');
  const architecture = await runStep2Architecture(structureLayer, semanticsLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 3: 패턴 및 컨벤션 감지
  logger.dim('Step 3/4: 패턴 및 컨벤션 감지 중...');
  const { patterns, conventions } = await runStep3Patterns(semanticsLayer, aiConfig);
  await sleep(aiConfig.rateLimitMs);

  // Step 4: 용어집 추출
  logger.dim('Step 4/4: 용어집 추출 중...');
  const glossary = await runStep4Glossary(projectRoot, structureLayer, aiConfig);

  const domainData: DomainLayer = {
    projectSummary,
    architecture,
    patterns,
    conventions,
    glossary,
  };

  // 캐시 저장
  saveDomainCache(projectRoot, {
    inputHash,
    builtAt: new Date().toISOString(),
    data: domainData,
  });

  const duration = Date.now() - startTime;
  logger.ok(`Domain Layer 빌드 완료 — 패턴 ${patterns.length}개, 용어 ${glossary.length}개 (${duration}ms)`);

  return {
    layer: 'domain',
    success: true,
    duration,
    fileCount: 0,
    warnings,
    data: domainData,
  };
}
