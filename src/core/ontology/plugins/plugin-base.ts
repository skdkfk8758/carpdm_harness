/**
 * 플러그인 개발자용 진입점
 * 이 파일만 import하면 플러그인 구현에 필요한 모든 타입을 얻을 수 있습니다.
 *
 * 사용 예:
 *   import type { LanguagePlugin, SemanticFile, ImportEntry } from './plugin-base.js';
 */

export type {
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
