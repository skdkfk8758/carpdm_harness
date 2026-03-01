import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectLocalMcpConflict, localMcpConfigPath } from '../../src/core/omc-compat.js';

describe('mcp-conflict', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'harness-mcp-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ─── localMcpConfigPath ───

  describe('localMcpConfigPath', () => {
    it('should return .mcp.json path under project root', () => {
      expect(localMcpConfigPath(testDir)).toBe(join(testDir, '.mcp.json'));
    });
  });

  // ─── detectLocalMcpConflict ───

  describe('detectLocalMcpConflict', () => {
    it('should return false when .mcp.json does not exist', () => {
      expect(detectLocalMcpConflict(testDir)).toBe(false);
    });

    it('should return true when carpdm-harness is registered', () => {
      writeFileSync(join(testDir, '.mcp.json'), JSON.stringify({
        mcpServers: {
          'carpdm-harness': { command: 'node', args: ['dist/server.js'] },
        },
      }));
      expect(detectLocalMcpConflict(testDir)).toBe(true);
    });

    it('should return false when only other servers are registered', () => {
      writeFileSync(join(testDir, '.mcp.json'), JSON.stringify({
        mcpServers: {
          'some-other-server': { command: 'node', args: ['server.js'] },
        },
      }));
      expect(detectLocalMcpConflict(testDir)).toBe(false);
    });

    it('should return false for source project (package.json name === carpdm-harness)', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: 'carpdm-harness' }));
      writeFileSync(join(testDir, '.mcp.json'), JSON.stringify({
        mcpServers: {
          'carpdm-harness': { command: 'node', args: ['dist/server.js'] },
        },
      }));
      expect(detectLocalMcpConflict(testDir)).toBe(false);
    });

    it('should return false when .mcp.json contains invalid JSON', () => {
      writeFileSync(join(testDir, '.mcp.json'), '{ invalid json !!!');
      expect(detectLocalMcpConflict(testDir)).toBe(false);
    });

    it('should return false when mcpServers is missing', () => {
      writeFileSync(join(testDir, '.mcp.json'), JSON.stringify({ otherKey: true }));
      expect(detectLocalMcpConflict(testDir)).toBe(false);
    });
  });
});
