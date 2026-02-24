/**
 * 독립 실행 가능한 온톨로지 점진적 갱신 스크립트
 * 사용법: node <plugin-root>/dist/ontology-refresh.js <projectRoot>
 * ontology-update.sh 훅에서 백그라운드로 호출됨
 */
import { refreshOntology } from '../core/ontology/index.js';
import { loadConfig } from '../core/config.js';
import { DEFAULT_ONTOLOGY_CONFIG } from '../types/ontology.js';

const projectRoot = process.argv[2];
if (!projectRoot) {
  process.exit(1);
}

const config = loadConfig(projectRoot);
const ontologyConfig = config?.ontology ?? DEFAULT_ONTOLOGY_CONFIG;

if (!ontologyConfig.enabled) {
  process.exit(0);
}

try {
  await refreshOntology(projectRoot, ontologyConfig);
} catch {
  process.exit(1);
}
