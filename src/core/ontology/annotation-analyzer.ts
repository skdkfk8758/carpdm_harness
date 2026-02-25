import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../../utils/logger.js';
import type {
  SemanticsLayer,
  SemanticFile,
  MxAnnotation,
  AnnotationSummary,
  FunctionEntry,
} from '../../types/ontology.js';

// ────────────────────────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────────────────────────

/** ANCHOR 태그 기준: 이 수 이상의 파일이 참조하면 ANCHOR */
const ANCHOR_FAN_IN_THRESHOLD = 3;

/** WARN 기준: 함수 줄 수 */
const WARN_FUNCTION_LENGTH = 50;

/** WARN 기준: 매개변수 수 */
const WARN_PARAM_COUNT = 5;

/** WARN 기준: 중첩 깊이 */
const WARN_NESTING_DEPTH = 3;

// ────────────────────────────────────────────────────────────────────────────
// @MX:ANCHOR — 높은 fan_in 함수 분석
// ────────────────────────────────────────────────────────────────────────────

/**
 * SymbolIndex.byName에서 참조 수 >= threshold 인 심볼을 ANCHOR로 태깅
 */
export function analyzeFanIn(
  semantics: SemanticsLayer,
  threshold: number = ANCHOR_FAN_IN_THRESHOLD,
): MxAnnotation[] {
  const annotations: MxAnnotation[] = [];

  for (const [symbolName, entries] of Object.entries(semantics.symbols.byName)) {
    // 실제 fan_in은 이 심볼을 import하는 파일 수를 계산
    // SymbolIndex.byName에는 선언 위치만 있으므로, imports에서 참조 추적
    let fanIn = 0;
    const declarationFiles = new Set(entries.map((e) => e.file));

    for (const file of semantics.files) {
      if (declarationFiles.has(file.path)) continue;
      // 이 파일의 import에서 해당 심볼을 가져오는지 확인
      for (const imp of file.imports) {
        if (imp.specifiers.includes(symbolName)) {
          fanIn++;
          break;
        }
      }
    }

    if (fanIn >= threshold) {
      // 첫 번째 선언 위치 기준
      const primary = entries[0];
      annotations.push({
        tag: 'ANCHOR',
        message: `높은 fan_in (${fanIn}개 파일이 참조) — 수정 시 영향 범위 큼`,
        line: primary.line,
        symbolName,
        metadata: { fanIn, declarationFile: primary.file },
      });
    }
  }

  return annotations;
}

// ────────────────────────────────────────────────────────────────────────────
// @MX:WARN — 복잡도 분석
// ────────────────────────────────────────────────────────────────────────────

/**
 * 함수 길이, 매개변수 수, any 타입 사용 등을 분석하여 WARN 태깅
 */
export function analyzeComplexity(files: SemanticFile[]): MxAnnotation[] {
  const annotations: MxAnnotation[] = [];

  for (const file of files) {
    // 함수 분석
    const allFunctions: FunctionEntry[] = [
      ...file.functions,
      ...file.classes.flatMap((cls) => cls.methods),
    ];

    for (const fn of allFunctions) {
      const reasons: string[] = [];

      // 매개변수 수 체크
      if (fn.params.length >= WARN_PARAM_COUNT) {
        reasons.push(`매개변수 ${fn.params.length}개`);
      }

      // any 타입 사용 체크
      const hasAnyParam = fn.params.some((p) => p.type === 'any');
      const hasAnyReturn = fn.returnType === 'any';
      if (hasAnyParam || hasAnyReturn) {
        reasons.push('any 타입 사용');
      }

      if (reasons.length > 0) {
        annotations.push({
          tag: 'WARN',
          message: reasons.join(', '),
          line: fn.line,
          symbolName: fn.name,
          metadata: {
            file: file.path,
            paramCount: fn.params.length,
            hasAnyType: hasAnyParam || hasAnyReturn,
          },
        });
      }
    }
  }

  return annotations;
}

/**
 * 소스 파일 내용을 읽어 함수 길이, 중첩 깊이 기반 WARN 생성
 */
export function analyzeFileComplexity(
  files: SemanticFile[],
  projectRoot: string,
): MxAnnotation[] {
  const annotations: MxAnnotation[] = [];

  for (const file of files) {
    let content: string;
    try {
      const absPath = file.path.startsWith('/') ? file.path : join(projectRoot, file.path);
      content = readFileSync(absPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    // 함수별 줄 수 추정 (시작 줄 ~ 다음 함수/파일 끝)
    const allFunctions = [
      ...file.functions,
      ...file.classes.flatMap((cls) => cls.methods),
    ].sort((a, b) => a.line - b.line);

    for (let i = 0; i < allFunctions.length; i++) {
      const fn = allFunctions[i];
      const startLine = fn.line;
      const endLine = i + 1 < allFunctions.length
        ? allFunctions[i + 1].line - 1
        : lines.length;
      const fnLength = endLine - startLine + 1;

      if (fnLength >= WARN_FUNCTION_LENGTH) {
        annotations.push({
          tag: 'WARN',
          message: `함수 길이 ${fnLength}줄`,
          line: fn.line,
          symbolName: fn.name,
          metadata: {
            file: file.path,
            functionLength: fnLength,
          },
        });
      }
    }

    // 중첩 깊이 분석 (중괄호 기반 근사)
    let maxDepth = 0;
    let currentDepth = 0;
    let maxDepthLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') {
          currentDepth++;
          if (currentDepth > maxDepth) {
            maxDepth = currentDepth;
            maxDepthLine = i + 1;
          }
        } else if (ch === '}') {
          currentDepth = Math.max(0, currentDepth - 1);
        }
      }
    }

    if (maxDepth >= WARN_NESTING_DEPTH) {
      // 해당 위치의 함수 찾기
      const enclosingFn = allFunctions.find(
        (fn) => fn.line <= maxDepthLine && maxDepthLine <= fn.line + WARN_FUNCTION_LENGTH * 2,
      );
      annotations.push({
        tag: 'WARN',
        message: `중첩 깊이 ${maxDepth}`,
        line: maxDepthLine,
        symbolName: enclosingFn?.name,
        metadata: {
          file: file.path,
          nestingDepth: maxDepth,
        },
      });
    }
  }

  return annotations;
}

// ────────────────────────────────────────────────────────────────────────────
// @MX:NOTE — 기존 @MX:NOTE 주석 스캔
// ────────────────────────────────────────────────────────────────────────────

/** 코드 내 @MX:NOTE 주석 패턴 스캔 */
export function scanExistingAnnotations(
  files: SemanticFile[],
  projectRoot: string,
): MxAnnotation[] {
  const annotations: MxAnnotation[] = [];
  const notePattern = /@MX:NOTE\s+(.+)/g;

  for (const file of files) {
    let content: string;
    try {
      const absPath = file.path.startsWith('/') ? file.path : join(projectRoot, file.path);
      content = readFileSync(absPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      const re = new RegExp(notePattern.source, 'g');
      while ((match = re.exec(line)) !== null) {
        annotations.push({
          tag: 'NOTE',
          message: match[1].trim(),
          line: i + 1,
          metadata: { file: file.path },
        });
      }
    }
  }

  return annotations;
}

// ────────────────────────────────────────────────────────────────────────────
// @MX:TODO — TODO/FIXME/HACK/XXX 주석 스캔
// ────────────────────────────────────────────────────────────────────────────

/** TODO, FIXME, HACK, XXX 주석 패턴 스캔 */
export function scanTodoComments(
  files: SemanticFile[],
  projectRoot: string,
): MxAnnotation[] {
  const annotations: MxAnnotation[] = [];
  const todoPattern = /\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)$/;

  for (const file of files) {
    let content: string;
    try {
      const absPath = file.path.startsWith('/') ? file.path : join(projectRoot, file.path);
      content = readFileSync(absPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 주석 내에서만 검색 (// 또는 /* */ 또는 * 라인)
      const commentMatch = line.match(/\/\/(.+)|\/\*(.+)\*\/|\*\s*(.+)/);
      if (!commentMatch) continue;

      const commentText = commentMatch[1] ?? commentMatch[2] ?? commentMatch[3] ?? '';
      const match = todoPattern.exec(commentText);
      if (match) {
        const keyword = match[1];
        const message = match[2]?.trim() || `${keyword} 발견`;
        annotations.push({
          tag: 'TODO',
          message: `[${keyword}] ${message}`,
          line: i + 1,
          metadata: {
            file: file.path,
            keyword,
          },
        });
      }
    }
  }

  return annotations;
}

// ────────────────────────────────────────────────────────────────────────────
// 어노테이션 결과 집계
// ────────────────────────────────────────────────────────────────────────────

export interface AnnotationResult {
  /** 파일별 어노테이션 맵 (파일 경로 → 어노테이션 배열) */
  byFile: Record<string, MxAnnotation[]>;
  /** 전체 요약 */
  summary: AnnotationSummary;
}

/**
 * 모든 어노테이션을 SemanticFile에 부착하고 요약 생성
 */
function attachAnnotationsToFiles(
  _files: SemanticFile[],
  allAnnotations: MxAnnotation[],
): Record<string, MxAnnotation[]> {
  const byFile: Record<string, MxAnnotation[]> = {};

  for (const ann of allAnnotations) {
    const filePath = (ann.metadata?.file as string) ?? (ann.metadata?.declarationFile as string) ?? '';
    if (!filePath) continue;
    if (!byFile[filePath]) byFile[filePath] = [];
    byFile[filePath].push(ann);
  }

  return byFile;
}

/**
 * AnnotationSummary 빌드
 */
function buildAnnotationSummary(
  allAnnotations: MxAnnotation[],
): AnnotationSummary {
  const byTag: Record<string, number> = {};
  const topAnchors: AnnotationSummary['topAnchors'] = [];
  const warnings: AnnotationSummary['warnings'] = [];

  for (const ann of allAnnotations) {
    byTag[ann.tag] = (byTag[ann.tag] ?? 0) + 1;

    if (ann.tag === 'ANCHOR' && ann.symbolName) {
      topAnchors.push({
        symbol: ann.symbolName,
        file: (ann.metadata?.declarationFile as string) ?? '',
        fanIn: (ann.metadata?.fanIn as number) ?? 0,
      });
    }

    if (ann.tag === 'WARN' && ann.symbolName) {
      warnings.push({
        symbol: ann.symbolName,
        file: (ann.metadata?.file as string) ?? '',
        reason: ann.message,
      });
    }
  }

  // topAnchors를 fan_in 내림차순 정렬
  topAnchors.sort((a, b) => b.fanIn - a.fanIn);

  return {
    total: allAnnotations.length,
    byTag,
    topAnchors: topAnchors.slice(0, 20),
    warnings: warnings.slice(0, 30),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 통합 분석 API
// ────────────────────────────────────────────────────────────────────────────

/**
 * @MX 어노테이션 통합 분석
 * fan_in, 복잡도, 기존 주석, TODO 모두를 분석하여 결과를 반환합니다.
 */
export function generateAnnotations(
  semantics: SemanticsLayer,
  projectRoot: string,
): AnnotationResult {
  logger.info('@MX 어노테이션 분석 시작');
  const startTime = Date.now();

  // 1. ANCHOR: fan_in 분석
  const anchorAnnotations = analyzeFanIn(semantics);
  logger.dim(`ANCHOR: ${anchorAnnotations.length}개 감지`);

  // 2. WARN: AST 기반 복잡도 (매개변수, any 타입)
  const astWarnAnnotations = analyzeComplexity(semantics.files);

  // 3. WARN: 파일 기반 복잡도 (함수 길이, 중첩)
  const fileWarnAnnotations = analyzeFileComplexity(semantics.files, projectRoot);

  const warnAnnotations = [...astWarnAnnotations, ...fileWarnAnnotations];
  logger.dim(`WARN: ${warnAnnotations.length}개 감지`);

  // 4. NOTE: 기존 @MX:NOTE 주석 스캔
  const noteAnnotations = scanExistingAnnotations(semantics.files, projectRoot);
  logger.dim(`NOTE: ${noteAnnotations.length}개 감지`);

  // 5. TODO: TODO/FIXME/HACK/XXX 스캔
  const todoAnnotations = scanTodoComments(semantics.files, projectRoot);
  logger.dim(`TODO: ${todoAnnotations.length}개 감지`);

  // 전체 합산
  const allAnnotations = [
    ...anchorAnnotations,
    ...warnAnnotations,
    ...noteAnnotations,
    ...todoAnnotations,
  ];

  // 파일별 분류 및 SemanticFile에 부착
  const byFile = attachAnnotationsToFiles(semantics.files, allAnnotations);

  // SemanticFile.annotations에 직접 부착
  for (const file of semantics.files) {
    const fileAnns = byFile[file.path];
    if (fileAnns && fileAnns.length > 0) {
      file.annotations = fileAnns;
    }
  }

  // SymbolEntry.annotations에 심볼 단위로 부착
  for (const file of semantics.files) {
    if (!file.annotations) continue;
    for (const ann of file.annotations) {
      if (!ann.symbolName) continue;
      // exports에서 찾기
      const sym = file.exports.find((s) => s.name === ann.symbolName);
      if (sym) {
        if (!sym.annotations) sym.annotations = [];
        sym.annotations.push(ann);
      }
    }
  }

  // 요약 빌드
  const summary = buildAnnotationSummary(allAnnotations);

  const duration = Date.now() - startTime;
  logger.ok(`@MX 어노테이션 분석 완료 — 총 ${allAnnotations.length}개 (${duration}ms)`);

  return { byFile, summary };
}
