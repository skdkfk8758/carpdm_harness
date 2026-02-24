/**
 * McpLogger — 메시지 수집기 패턴
 * MCP 서버에서는 stdout을 JSON-RPC 프로토콜이 사용하므로
 * console.log 대신 메시지를 내부 버퍼에 수집한 뒤 flush()로 일괄 반환합니다.
 * core 모듈의 기존 logger.info/ok/warn/error/header/table/fileAction 호출은 그대로 동작합니다.
 */

class McpLogger {
  private buffer: string[] = [];

  info(msg: string): void {
    this.buffer.push(`[INFO] ${msg}`);
  }

  ok(msg: string): void {
    this.buffer.push(`[OK] ${msg}`);
  }

  warn(msg: string): void {
    this.buffer.push(`[WARN] ${msg}`);
  }

  error(msg: string): void {
    this.buffer.push(`[ERROR] ${msg}`);
  }

  dim(msg: string): void {
    this.buffer.push(msg);
  }

  header(msg: string): void {
    this.buffer.push('');
    this.buffer.push(`## ${msg}`);
    this.buffer.push('─'.repeat(msg.length + 2));
  }

  table(rows: [string, string][]): void {
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      this.buffer.push(`  ${key.padEnd(maxKey)}  ${value}`);
    }
  }

  fileAction(action: 'create' | 'update' | 'skip' | 'conflict' | 'backup', path: string): void {
    const icons: Record<string, string> = {
      create: '+',
      update: '~',
      skip: '-',
      conflict: '!',
      backup: 'B',
    };
    this.buffer.push(`  ${icons[action]} ${path}`);
  }

  /** 버퍼의 모든 메시지를 하나의 문자열로 반환 */
  flush(): string {
    const text = this.buffer.join('\n');
    this.buffer = [];
    return text;
  }

  /** 버퍼를 비우지 않고 현재 내용 반환 */
  toText(): string {
    return this.buffer.join('\n');
  }

  /** 버퍼 초기화 */
  clear(): void {
    this.buffer = [];
  }
}

export const logger = new McpLogger();
