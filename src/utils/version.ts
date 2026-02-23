import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPackageRoot } from './paths.js';

export function getPackageVersion(): string {
  try {
    const pkgPath = join(getPackageRoot(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(latest, current) > 0;
}
