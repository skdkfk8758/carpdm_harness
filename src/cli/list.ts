import { getAllModules, getPresetNames, loadPreset } from '../core/module-registry.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

interface ListOptions {
  modules?: boolean;
  presets?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const showAll = !options.modules && !options.presets;

  if (showAll || options.modules) {
    logger.header('사용 가능한 모듈');
    const modules = getAllModules();
    for (const [name, mod] of Object.entries(modules)) {
      const deps = mod.dependencies.length > 0
        ? chalk.dim(` (의존: ${mod.dependencies.join(', ')})`)
        : '';
      const counts = `${mod.commands.length}cmd ${mod.hooks.length}hook ${mod.docs.length}doc`;
      console.log(`  ${chalk.bold(name.padEnd(15))} ${mod.description}`);
      console.log(`  ${' '.repeat(15)} ${chalk.dim(counts)}${deps}`);
    }
    console.log('');
  }

  if (showAll || options.presets) {
    logger.header('사용 가능한 프리셋');
    for (const name of getPresetNames()) {
      const preset = loadPreset(name);
      if (preset) {
        const mods = preset.modules.join(', ');
        console.log(`  ${chalk.bold(name.padEnd(12))} ${preset.description}`);
        console.log(`  ${' '.repeat(12)} ${chalk.dim(`모듈: ${mods}`)}`);
      }
    }
    console.log('');
  }
}
