import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';

const server = new McpServer({
  name: 'carpdm-harness',
  version: '4.1.2',
});

registerAllTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
