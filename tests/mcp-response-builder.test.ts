import { describe, it, expect } from 'vitest';
import { McpResponseBuilder, errorResult, textResult } from '../src/types/mcp.js';

describe('McpResponseBuilder', () => {
  describe('header()', () => {
    it('should use --- delimiters instead of ##', () => {
      const res = new McpResponseBuilder();
      const text = res.header('제목').toText();
      expect(text).toContain('--- 제목 ---');
      expect(text).not.toContain('##');
    });

    it('should include blank lines around the title', () => {
      const res = new McpResponseBuilder();
      const text = res.header('제목').toText();
      const lines = text.split('\n');
      expect(lines[0]).toBe('');
      expect(lines[1]).toBe('--- 제목 ---');
      expect(lines[2]).toBe('');
    });
  });

  describe('subheader()', () => {
    it('should wrap title in brackets with indent', () => {
      const res = new McpResponseBuilder();
      const text = res.subheader('섹션').toText();
      expect(text).toContain('  [섹션]');
    });

    it('should include blank lines around the subheader', () => {
      const res = new McpResponseBuilder();
      const text = res.subheader('섹션').toText();
      const lines = text.split('\n');
      expect(lines[0]).toBe('');
      expect(lines[1]).toBe('  [섹션]');
      expect(lines[2]).toBe('');
    });
  });

  describe('info()', () => {
    it('should prefix with ℹ', () => {
      const res = new McpResponseBuilder();
      const text = res.info('정보 메시지').toText();
      expect(text).toBe('ℹ 정보 메시지');
      expect(text).not.toContain('[INFO]');
    });
  });

  describe('ok()', () => {
    it('should prefix with ✓', () => {
      const res = new McpResponseBuilder();
      const text = res.ok('성공 메시지').toText();
      expect(text).toBe('✓ 성공 메시지');
      expect(text).not.toContain('[OK]');
    });
  });

  describe('warn()', () => {
    it('should prefix with ⚠', () => {
      const res = new McpResponseBuilder();
      const text = res.warn('경고 메시지').toText();
      expect(text).toBe('⚠ 경고 메시지');
      expect(text).not.toContain('[WARN]');
    });
  });

  describe('error()', () => {
    it('should prefix with ✗', () => {
      const res = new McpResponseBuilder();
      const text = res.error('에러 메시지').toText();
      expect(text).toBe('✗ 에러 메시지');
      expect(text).not.toContain('[ERROR]');
    });
  });

  describe('check()', () => {
    it('should show ✓ with indent when passed', () => {
      const res = new McpResponseBuilder();
      const text = res.check(true, 'Git 레포지토리').toText();
      expect(text).toBe('  ✓ Git 레포지토리');
    });

    it('should show ✗ with indent when failed', () => {
      const res = new McpResponseBuilder();
      const text = res.check(false, '설정 파일 없음').toText();
      expect(text).toBe('  ✗ 설정 파일 없음');
    });
  });

  describe('divider()', () => {
    it('should output a horizontal line', () => {
      const res = new McpResponseBuilder();
      const text = res.divider().toText();
      expect(text).toBe('────────────────────');
    });
  });

  describe('table()', () => {
    it('should use colon separator between key and value', () => {
      const res = new McpResponseBuilder();
      const text = res.table([['키', '값']]).toText();
      expect(text).toContain(' : ');
    });

    it('should align keys with padEnd', () => {
      const res = new McpResponseBuilder();
      const text = res.table([
        ['short', 'a'],
        ['longerkey', 'b'],
      ]).toText();
      const lines = text.split('\n');
      // Both lines should have colon at the same position
      const colonPos0 = lines[0].indexOf(':');
      const colonPos1 = lines[1].indexOf(':');
      expect(colonPos0).toBe(colonPos1);
    });

    it('should handle empty array without error', () => {
      const res = new McpResponseBuilder();
      const text = res.table([]).toText();
      expect(text).toBe('');
    });
  });

  describe('fluent API chaining', () => {
    it('should support method chaining', () => {
      const res = new McpResponseBuilder();
      const result = res
        .header('제목')
        .blank()
        .info('정보')
        .ok('성공')
        .warn('경고')
        .error('에러')
        .check(true, '통과')
        .subheader('섹션')
        .divider()
        .table([['k', 'v']])
        .line('라인')
        .toResult();

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBe(false);
    });
  });

  describe('toResult()', () => {
    it('should return isError=false by default', () => {
      const result = new McpResponseBuilder().ok('완료').toResult();
      expect(result.isError).toBe(false);
    });

    it('should pass through isError flag', () => {
      const result = new McpResponseBuilder().error('실패').toResult(true);
      expect(result.isError).toBe(true);
    });
  });

  describe('errorResult()', () => {
    it('should prefix with ✗ and set isError=true', () => {
      const result = errorResult('실패 메시지');
      expect(result.content[0].text).toBe('✗ 실패 메시지');
      expect(result.content[0].text).not.toContain('[ERROR]');
      expect(result.isError).toBe(true);
    });
  });

  describe('textResult()', () => {
    it('should wrap text in content array', () => {
      const result = textResult('텍스트');
      expect(result.content[0].text).toBe('텍스트');
      expect(result.isError).toBe(false);
    });
  });
});
