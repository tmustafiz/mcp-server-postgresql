import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { query } from '../db.js';

/**
 * Return sample (distinct) data values from a specified column for data inspection and type inference.
 */
export async function sampleColumnData(schema: string, table: string, column: string, limit = 10): Promise<any[]> {
  // TODO: Implement
  return [];
}

export function register(server: McpServer) {
  server.tool(
    "sample_column_data",
    { schema: z.string(), table: z.string(), column: z.string(), limit: z.number().optional() },
    async ({ schema, table, column, limit }) => {
      // TODO: Implement
      return { content: [{ type: "text", text: JSON.stringify([]) }] };
    }
  );
}
