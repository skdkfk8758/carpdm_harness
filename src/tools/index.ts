import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListTool } from './list.js';
import { registerInfoTool } from './info.js';
import { registerDoctorTool } from './doctor.js';
import { registerOntologyStatusTool } from './ontology-status.js';
import { registerOntologyGenerateTool } from './ontology-generate.js';
import { registerOntologyRefreshTool } from './ontology-refresh.js';
import { registerInitTool } from './init.js';
import { registerUpdateTool } from './update.js';
import { registerMigrateTool } from './migrate.js';

export function registerAllTools(server: McpServer): void {
  registerListTool(server);
  registerInfoTool(server);
  registerDoctorTool(server);
  registerOntologyStatusTool(server);
  registerOntologyGenerateTool(server);
  registerOntologyRefreshTool(server);
  registerInitTool(server);
  registerUpdateTool(server);
  registerMigrateTool(server);
}
