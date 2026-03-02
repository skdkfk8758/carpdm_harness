/**
 * 온톨로지 설정 로더
 *
 * ontology-generate, ontology-refresh 도구에서 공유하는
 * config 로딩 + defaults deep merge 로직을 중앙화합니다.
 */

import { loadConfig } from '../config.js';
import { mergeExcludePatterns } from './structure-builder.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../../types/ontology.js';
import type { OntologyConfig } from '../../types/ontology.js';

/** 프로젝트 config에서 온톨로지 설정을 로드하고 defaults와 deep merge */
export function loadMergedOntologyConfig(projectRoot: string): OntologyConfig {
  const config = loadConfig(projectRoot);
  const userOntology = config?.ontology;
  return userOntology
    ? {
        ...DEFAULT_ONTOLOGY_CONFIG,
        ...userOntology,
        layers: {
          ...DEFAULT_ONTOLOGY_CONFIG.layers,
          ...userOntology.layers,
          structure: {
            ...DEFAULT_ONTOLOGY_CONFIG.layers.structure,
            ...userOntology.layers?.structure,
            excludePatterns: mergeExcludePatterns(
              DEFAULT_ONTOLOGY_CONFIG.layers.structure.excludePatterns,
              userOntology.layers?.structure?.excludePatterns ?? [],
            ),
          },
        },
      }
    : DEFAULT_ONTOLOGY_CONFIG;
}
