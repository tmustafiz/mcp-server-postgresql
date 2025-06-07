import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";

const sampleColumnDataHandler: ToolCallback<{ schema: z.ZodString; table: z.ZodString; column: z.ZodString; limit?: z.ZodNumber }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT DISTINCT "${args.column}" FROM "${args.schema}"."${args.table}" LIMIT $1`,
      [args.limit ?? 5]
    );
    return { content: [{ type: "text", text: JSON.stringify({ values: res.rows.map(row => row[args.column]) }) }] };
  } finally {
    client.release();
  }
};

export function register(server: McpServer) {
  server.registerTool("sample_column_data", {
    description: "Get sample data values from a column for data inspection.",
    inputSchema: {
      schema: z.string(),
      table: z.string(),
      column: z.string(),
      limit: z.number().optional()
    },
    outputSchema: {
      values: z.array(z.any())
    }
  }, sampleColumnDataHandler);
}