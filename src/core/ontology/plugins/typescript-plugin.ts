import { extname } from 'node:path';
import { logger } from '../../../utils/logger.js';
import type {
  LanguagePlugin,
  SemanticFile,
  ImportEntry,
  SymbolEntry,
  SymbolKind,
  ClassEntry,
  FunctionEntry,
  InterfaceEntry,
  TypeAliasEntry,
} from '../../../types/ontology.js';

// ────────────────────────────────────────────────────────────────────────────
// 정규식 기반 추출 (TypeScript Compiler API 없이 동작하는 폴백)
// ────────────────────────────────────────────────────────────────────────────

/** import 구문 정규식 — named / default / namespace / side-effect */
const IMPORT_RE =
  /^import\s+(?:(type)\s+)?(?:(\*\s+as\s+\w+|\{[^}]*\}|\w+)(?:\s*,\s*(\{[^}]*\}))?|(\{[^}]*\}))\s+from\s+['"]([^'"]+)['"]/gm;

/** 정규식으로 import 항목 추출 */
function parseImportsWithRegex(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  // named/default/namespace import
  let match: RegExpExecArray | null;
  const re = new RegExp(IMPORT_RE.source, 'gm');
  while ((match = re.exec(content)) !== null) {
    const isTypeOnly = match[1] === 'type';
    const first = match[2]?.trim() ?? '';
    const second = match[3]?.trim() ?? '';
    const onlyNamed = match[4]?.trim() ?? '';
    const source = match[5] ?? '';

    const specifiers: string[] = [];
    let isDefault = false;

    // { a, b } 파싱
    function extractNamed(block: string): string[] {
      return block
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/\s+as\s+\w+/, '').trim())
        .filter(Boolean);
    }

    if (onlyNamed) {
      specifiers.push(...extractNamed(onlyNamed));
    } else {
      if (first.startsWith('{')) {
        specifiers.push(...extractNamed(first));
      } else if (first.startsWith('*')) {
        specifiers.push(first.replace(/\s+/g, ' ').trim());
      } else if (first) {
        // default import
        isDefault = true;
        specifiers.push(first);
      }
      if (second) {
        specifiers.push(...extractNamed(second));
      }
    }

    if (source) {
      results.push({ source, specifiers, isTypeOnly, isDefault });
    }
  }

  // side-effect import: import 'foo'
  const sideEffectRe = /^import\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = sideEffectRe.exec(content)) !== null) {
    results.push({ source: m[1], specifiers: [], isTypeOnly: false, isDefault: false });
  }

  return results;
}

/** export된 심볼 이름 추출 (정규식 폴백) */
function parseExportsWithRegex(content: string): SymbolEntry[] {
  const results: SymbolEntry[] = [];
  const lines = content.split('\n');

  const exportRe =
    /^export\s+(?:default\s+)?(?:(async\s+)?function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)\s*=|const\s+(\w+)|let\s+(\w+)|var\s+(\w+)|enum\s+(\w+))/;

  lines.forEach((line, idx) => {
    const m = exportRe.exec(line.trim());
    if (!m) return;

    let name = '';
    let kind: SymbolKind = 'variable';

    if (m[2]) { name = m[2]; kind = 'function'; }
    else if (m[3]) { name = m[3]; kind = 'class'; }
    else if (m[4]) { name = m[4]; kind = 'interface'; }
    else if (m[5]) { name = m[5]; kind = 'type'; }
    else if (m[6] || m[7] || m[8]) { name = (m[6] ?? m[7] ?? m[8])!; kind = 'constant'; }
    else if (m[9]) { name = m[9]; kind = 'enum'; }

    if (name) {
      results.push({ name, kind, line: idx + 1, exported: true });
    }
  });

  return results;
}

/** 정규식 기반 전체 파일 분석 */
function analyzeWithRegex(filePath: string, content: string): SemanticFile {
  const imports = parseImportsWithRegex(content);
  const exports = parseExportsWithRegex(content);

  return {
    path: filePath,
    language: 'typescript',
    exports,
    imports,
    classes: [],
    functions: [],
    interfaces: [],
    types: [],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// TypeScript Compiler API 기반 분석
// ────────────────────────────────────────────────────────────────────────────

// ts 모듈을 런타임에 동적 로드하기 위한 타입 선언
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSModule = any;

/** jsdoc 주석 추출 */
function extractJsDoc(node: TSModule, sourceFile: TSModule, _ts: TSModule): string | undefined {
  const fullText = sourceFile.getFullText();
  const triviaStart = node.getFullStart();
  const nodeStart = node.getStart(sourceFile);
  const trivia = fullText.slice(triviaStart, nodeStart);
  const match = /\/\*\*([\s\S]*?)\*\//.exec(trivia);
  if (!match) return undefined;
  return match[1]
    .split('\n')
    .map((l: string) => l.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
}

/** 노드 텍스트 안전 추출 */
function safeGetText(node: TSModule | undefined, sourceFile: TSModule): string {
  if (!node) return 'unknown';
  try {
    return node.getText(sourceFile);
  } catch {
    return 'unknown';
  }
}

/** TypeScript Compiler API로 파일 분석 */
function analyzeWithTS(filePath: string, content: string, ts: TSModule): SemanticFile {
  const sourceFile: TSModule = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.Unknown,
  );

  const imports: ImportEntry[] = [];
  const exports: SymbolEntry[] = [];
  const classes: ClassEntry[] = [];
  const functions: FunctionEntry[] = [];
  const interfaces: InterfaceEntry[] = [];
  const types: TypeAliasEntry[] = [];

  /** 파라미터 목록 추출 */
  function extractParams(params: TSModule[]): FunctionEntry['params'] {
    return params.map((p: TSModule) => ({
      name: safeGetText(p.name, sourceFile),
      type: p.type ? safeGetText(p.type, sourceFile) : 'unknown',
      optional: !!p.questionToken,
    }));
  }

  /** 노드가 export 되어 있는지 확인 */
  function isExported(node: TSModule): boolean {
    const mods: TSModule[] | undefined = node.modifiers;
    if (!mods) return false;
    return mods.some(
      (m: TSModule) =>
        m.kind === ts.SyntaxKind.ExportKeyword ||
        m.kind === ts.SyntaxKind.DefaultKeyword,
    );
  }

  /** 줄 번호 계산 (1-based) */
  function lineOf(node: TSModule): number {
    const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
    return pos.line + 1;
  }

  /** 노드 순회 */
  function visit(node: TSModule): void {
    // import 선언
    if (ts.isImportDeclaration(node)) {
      const source = (node.moduleSpecifier as TSModule).text as string;
      const clause = node.importClause;
      const isTypeOnly = clause?.isTypeOnly ?? false;
      const specifiers: string[] = [];
      let isDefault = false;

      if (clause) {
        if (clause.name) {
          isDefault = true;
          specifiers.push((clause.name as TSModule).text as string);
        }
        const bindings = clause.namedBindings;
        if (bindings) {
          if (ts.isNamespaceImport(bindings)) {
            specifiers.push(`* as ${(bindings.name as TSModule).text}`);
          } else if (ts.isNamedImports(bindings)) {
            for (const el of bindings.elements) {
              specifiers.push((el.name as TSModule).text as string);
            }
          }
        }
      }

      imports.push({ source, specifiers, isTypeOnly, isDefault });
      return;
    }

    // 클래스 선언
    if (ts.isClassDeclaration(node) && node.name) {
      const name = (node.name as TSModule).text as string;
      const exported = isExported(node);
      const line = lineOf(node);
      const jsdoc = extractJsDoc(node, sourceFile, ts);

      const methods: FunctionEntry[] = [];
      const properties: SymbolEntry[] = [];

      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          const mName = safeGetText(member.name, sourceFile);
          const mods: TSModule[] = member.modifiers ?? [];
          const isAsync = mods.some((m: TSModule) => m.kind === ts.SyntaxKind.AsyncKeyword);
          methods.push({
            name: mName,
            kind: 'method',
            line: lineOf(member),
            exported: false,
            params: extractParams(Array.from(member.parameters)),
            returnType: member.type ? safeGetText(member.type, sourceFile) : 'void',
            isAsync,
          });
        } else if (ts.isPropertyDeclaration(member) && member.name) {
          properties.push({
            name: safeGetText(member.name, sourceFile),
            kind: 'property',
            line: lineOf(member),
            exported: false,
          });
        }
      }

      const extendsClause = node.heritageClauses?.find(
        (h: TSModule) => h.token === ts.SyntaxKind.ExtendsKeyword,
      );
      const implementsClause = node.heritageClauses?.find(
        (h: TSModule) => h.token === ts.SyntaxKind.ImplementsKeyword,
      );

      const classEntry: ClassEntry = {
        name,
        kind: 'class',
        line,
        exported,
        jsdoc,
        methods,
        properties,
        extends: extendsClause?.types[0]
          ? safeGetText(extendsClause.types[0].expression, sourceFile)
          : undefined,
        implements: implementsClause?.types.map((t: TSModule) =>
          safeGetText(t.expression, sourceFile),
        ),
      };

      classes.push(classEntry);
      if (exported) exports.push({ name, kind: 'class', line, exported, jsdoc });
      return;
    }

    // 함수 선언
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = (node.name as TSModule).text as string;
      const exported = isExported(node);
      const line = lineOf(node);
      const jsdoc = extractJsDoc(node, sourceFile, ts);
      const mods: TSModule[] = node.modifiers ?? [];
      const isAsync = mods.some((m: TSModule) => m.kind === ts.SyntaxKind.AsyncKeyword);

      const fn: FunctionEntry = {
        name,
        kind: 'function',
        line,
        exported,
        jsdoc,
        params: extractParams(Array.from(node.parameters)),
        returnType: node.type ? safeGetText(node.type, sourceFile) : 'void',
        isAsync,
      };

      functions.push(fn);
      if (exported) exports.push({ name, kind: 'function', line, exported, jsdoc });
      return;
    }

    // interface 선언
    if (ts.isInterfaceDeclaration(node)) {
      const name = (node.name as TSModule).text as string;
      const exported = isExported(node);
      const line = lineOf(node);
      const jsdoc = extractJsDoc(node, sourceFile, ts);

      const properties = node.members
        .filter((m: TSModule) => ts.isPropertySignature(m) && m.name)
        .map((m: TSModule) => ({
          name: safeGetText(m.name, sourceFile),
          type: m.type ? safeGetText(m.type, sourceFile) : 'unknown',
          optional: !!m.questionToken,
        }));

      const extendsClause = node.heritageClauses?.find(
        (h: TSModule) => h.token === ts.SyntaxKind.ExtendsKeyword,
      );

      const iface: InterfaceEntry = {
        name,
        kind: 'interface',
        line,
        exported,
        jsdoc,
        properties,
        extends: extendsClause?.types.map((t: TSModule) =>
          safeGetText(t.expression, sourceFile),
        ),
      };

      interfaces.push(iface);
      if (exported) exports.push({ name, kind: 'interface', line, exported, jsdoc });
      return;
    }

    // type alias 선언
    if (ts.isTypeAliasDeclaration(node)) {
      const name = (node.name as TSModule).text as string;
      const exported = isExported(node);
      const line = lineOf(node);
      const jsdoc = extractJsDoc(node, sourceFile, ts);
      const definition = safeGetText(node.type, sourceFile);

      const typeEntry: TypeAliasEntry = {
        name,
        kind: 'type',
        line,
        exported,
        jsdoc,
        definition,
      };

      types.push(typeEntry);
      if (exported) exports.push({ name, kind: 'type', line, exported, jsdoc });
      return;
    }

    // 변수 선언 (export const/let/var)
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.name && ts.isIdentifier(decl.name)) {
          const name = (decl.name as TSModule).text as string;
          const line = lineOf(decl);
          exports.push({ name, kind: 'constant', line, exported: true });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return {
    path: filePath,
    language: 'typescript',
    exports,
    imports,
    classes,
    functions,
    interfaces,
    types,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// TypeScriptPlugin 클래스
// ────────────────────────────────────────────────────────────────────────────

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export class TypeScriptPlugin implements LanguagePlugin {
  readonly name = 'typescript';
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  readonly language = 'typescript';

  /** TypeScript Compiler API 모듈 (없으면 null → 정규식 폴백) */
  private tsModule: TSModule | null = null;

  constructor() {
    try {
      // ESM 환경에서 동기 require를 사용하는 optional dependency 처리
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.tsModule = require('typescript');
      logger.dim('TypeScriptPlugin: TypeScript Compiler API 로드 성공');
    } catch {
      logger.dim('TypeScriptPlugin: TypeScript Compiler API 없음 → 정규식 폴백 사용');
    }
  }

  /** 이 플러그인이 처리 가능한 파일인지 확인 */
  canHandle(filePath: string): boolean {
    return TS_EXTENSIONS.has(extname(filePath).toLowerCase());
  }

  /** 정규식 기반 import 추출 */
  extractImports(filePath: string, content: string): ImportEntry[] {
    try {
      return parseImportsWithRegex(content);
    } catch (err) {
      logger.warn(`import 추출 실패: ${filePath} — ${String(err)}`);
      return [];
    }
  }

  /** 파일 분석 — TS Compiler API 또는 정규식 폴백 */
  async analyzeFile(filePath: string, content: string): Promise<SemanticFile> {
    try {
      if (this.tsModule) {
        return analyzeWithTS(filePath, content, this.tsModule);
      }
      return analyzeWithRegex(filePath, content);
    } catch (err) {
      logger.warn(`파일 분석 실패: ${filePath} — ${String(err)}, 정규식 폴백 사용`);
      return analyzeWithRegex(filePath, content);
    }
  }
}
