import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModuleDefinition, ModuleManifest, PresetDefinition } from '../types/module.js';
import { getTemplatesDir, getPresetsDir } from '../utils/paths.js';

let cachedManifest: ModuleManifest | null = null;

export function loadManifest(): ModuleManifest {
  if (cachedManifest) return cachedManifest;
  const manifestPath = join(getTemplatesDir(), 'module-manifest.json');
  const content = readFileSync(manifestPath, 'utf-8');
  cachedManifest = JSON.parse(content) as ModuleManifest;
  return cachedManifest;
}

export function getModule(name: string): ModuleDefinition | undefined {
  const manifest = loadManifest();
  return manifest.modules[name];
}

export function getAllModules(): Record<string, ModuleDefinition> {
  return loadManifest().modules;
}

export function getModuleNames(): string[] {
  return Object.keys(loadManifest().modules);
}

export function resolveModules(requested: string[]): string[] {
  const manifest = loadManifest();
  const resolved = new Set<string>();

  function addWithDeps(name: string) {
    if (resolved.has(name)) return;
    const mod = manifest.modules[name];
    if (!mod) return;
    for (const dep of mod.dependencies) {
      addWithDeps(dep);
    }
    resolved.add(name);
  }

  for (const name of requested) {
    addWithDeps(name);
  }

  return Array.from(resolved);
}

export function loadPreset(name: string): PresetDefinition | null {
  try {
    const presetPath = join(getPresetsDir(), `${name}.json`);
    const content = readFileSync(presetPath, 'utf-8');
    return JSON.parse(content) as PresetDefinition;
  } catch {
    return null;
  }
}

export function getPresetNames(): string[] {
  return ['full', 'standard', 'minimal', 'tdd', 'secure'];
}

export function getPresetModules(presetName: string): string[] {
  const preset = loadPreset(presetName);
  return preset ? preset.modules : [];
}
