import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/server.ts',
    'src/cli/ontology-refresh.ts',
    'src/hooks/session-start.ts',
    'src/hooks/event-logger.ts',
    'src/hooks/workflow-guard.ts',
    'src/hooks/session-end.ts',
    'src/hooks/quality-gate.ts',
    'src/hooks/prompt-enricher.ts',
    'src/hooks/subagent-context.ts',
    'src/hooks/subagent-complete.ts',
    'src/hooks/pre-compact.ts',
  ],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: true,
  external: [],
});
