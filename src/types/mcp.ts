import type { TextContent } from '@modelcontextprotocol/sdk/types.js';

export interface ToolResult {
  [key: string]: unknown;
  content: TextContent[];
  isError?: boolean;
}

export class McpResponseBuilder {
  private lines: string[] = [];

  header(title: string): this {
    this.lines.push('', `--- ${title} ---`, '');
    return this;
  }

  subheader(title: string): this {
    this.lines.push('', `  [${title}]`, '');
    return this;
  }

  info(msg: string): this {
    this.lines.push(`ℹ ${msg}`);
    return this;
  }

  ok(msg: string): this {
    this.lines.push(`✓ ${msg}`);
    return this;
  }

  warn(msg: string): this {
    this.lines.push(`⚠ ${msg}`);
    return this;
  }

  error(msg: string): this {
    this.lines.push(`✗ ${msg}`);
    return this;
  }

  check(passed: boolean, msg: string): this {
    this.lines.push(passed ? `  ✓ ${msg}` : `  ✗ ${msg}`);
    return this;
  }

  divider(): this {
    this.lines.push('────────────────────');
    return this;
  }

  table(rows: [string, string][]): this {
    if (rows.length === 0) return this;
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      this.lines.push(`  ${key.padEnd(maxKey)} : ${value}`);
    }
    return this;
  }

  fileAction(action: 'create' | 'update' | 'skip' | 'conflict' | 'backup', path: string): this {
    const icons: Record<string, string> = {
      create: '+',
      update: '~',
      skip: '-',
      conflict: '!',
      backup: 'B',
    };
    this.lines.push(`  ${icons[action]} ${path}`);
    return this;
  }

  line(msg: string): this {
    this.lines.push(msg);
    return this;
  }

  blank(): this {
    this.lines.push('');
    return this;
  }

  toText(): string {
    return this.lines.join('\n');
  }

  toResult(isError = false): ToolResult {
    return {
      content: [{ type: 'text' as const, text: this.toText() }],
      isError,
    };
  }
}

export function textResult(text: string, isError = false): ToolResult {
  return {
    content: [{ type: 'text' as const, text }],
    isError,
  };
}

export function errorResult(message: string): ToolResult {
  return textResult(`✗ ${message}`, true);
}
