import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as schemaTools from "./schema.js";
import * as erdTools from "./erd.js";
import * as fuzzyTools from "./fuzzy.js";
import * as sampleTools from "./sample.js";
import * as relationshipTools from "./relationships.js";

export interface ToolModule {
  register(server: McpServer): void;
}

export const builtInTools: ToolModule[] = [
  schemaTools,
  erdTools,
  fuzzyTools,
  sampleTools,
  relationshipTools
];

export function registerAllTools(server: McpServer) {
  for (const toolModule of builtInTools) {
    toolModule.register(server);
  }
}

// Export individual tool modules for extensibility
export { schemaTools, erdTools, fuzzyTools, sampleTools, relationshipTools }; 