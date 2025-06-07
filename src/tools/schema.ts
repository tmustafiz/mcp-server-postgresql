import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";

const listTablesHandler: ToolCallback<{ schema: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [args.schema]
    );
    return { content: [{ type: "text", text: JSON.stringify({ tables: res.rows.map(row => row.table_name) }) }] };
  } finally {
    client.release();
  }
};

const listColumnsHandler: ToolCallback<{ schema: z.ZodString; table: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [args.schema, args.table]
    );
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          columns: res.rows.map(row => ({
            name: row.column_name,
            type: row.data_type,
            is_nullable: row.is_nullable === "YES"
          }))
        })
      }]
    };
  } finally {
    client.release();
  }
};

export function register(server: McpServer) {
  server.registerTool("list_tables", {
    description: "List all tables in a schema.",
    inputSchema: {
      schema: z.string()
    },
    outputSchema: {
      tables: z.array(z.string())
    }
  }, listTablesHandler);

  server.registerTool("list_columns", {
    description: "List columns for a table.",
    inputSchema: {
      schema: z.string(),
      table: z.string()
    },
    outputSchema: {
      columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        is_nullable: z.boolean()
      }))
    }
  }, listColumnsHandler);
}