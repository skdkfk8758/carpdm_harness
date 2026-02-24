import type { LanguagePlugin } from '../../types/ontology.js';
import { TypeScriptPlugin } from './plugins/typescript-plugin.js';
import { logger } from '../../utils/logger.js';

/**
 * 언어 플러그인 레지스트리
 * 파일 확장자 기반으로 적절한 플러그인을 선택합니다.
 */
export class PluginRegistry {
  private plugins: Map<string, LanguagePlugin> = new Map();

  /** 플러그인 등록 */
  register(plugin: LanguagePlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn(`플러그인 '${plugin.name}'이 이미 등록되어 있습니다. 덮어씁니다.`);
    }
    this.plugins.set(plugin.name, plugin);
    logger.dim(`플러그인 등록: ${plugin.name} (확장자: ${plugin.extensions.join(', ')})`);
  }

  /**
   * 파일 경로에 맞는 플러그인 반환
   * 등록된 플러그인의 canHandle()을 순서대로 확인합니다.
   */
  getPluginForFile(filePath: string): LanguagePlugin | null {
    for (const plugin of this.plugins.values()) {
      if (plugin.canHandle(filePath)) {
        return plugin;
      }
    }
    return null;
  }

  /** 등록된 언어 목록 반환 */
  getRegisteredLanguages(): string[] {
    return Array.from(this.plugins.values()).map((p) => p.language);
  }

  /** 특정 이름의 플러그인 등록 여부 확인 */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * TypeScriptPlugin이 기본 등록된 레지스트리 생성
   */
  static createDefault(): PluginRegistry {
    const registry = new PluginRegistry();
    registry.register(new TypeScriptPlugin());
    return registry;
  }
}
