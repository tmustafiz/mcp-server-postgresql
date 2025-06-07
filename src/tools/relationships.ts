import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";

const findRelatedTablesHandler: ToolCallback<{ schema: z.ZodString; table: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    const referencedRes = await client.query(
      `
      SELECT
        kcu.table_schema as fk_schema,
        kcu.table_name as fk_table,
        kcu.column_name as fk_column,
        ccu.table_schema as pk_schema,
        ccu.table_name as pk_table,
        ccu.column_name as pk_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.table_schema = $1
        AND kcu.table_name = $2
      `,
      [args.schema, args.table]
    );
    const referencingRes = await client.query(
      `
      SELECT
        kcu.table_schema as fk_schema,
        kcu.table_name as fk_table,
        kcu.column_name as fk_column,
        ccu.table_schema as pk_schema,
        ccu.table_name as pk_table,
        ccu.column_name as pk_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = $1
        AND ccu.table_name = $2
      `,
      [args.schema, args.table]
    );
    const related = [
      ...referencedRes.rows.map(row => ({
        schema: row.pk_schema,
        table: row.pk_table,
        fk_column: row.fk_column,
        pk_column: row.pk_column,
      })),
      ...referencingRes.rows.map(row => ({
        schema: row.fk_schema,
        table: row.fk_table,
        fk_column: row.fk_column,
        pk_column: row.pk_column,
      })),
    ];
    return { content: [{ type: "text", text: JSON.stringify({ related_tables: related }) }] };
  } finally {
    client.release();
  }
};

const describeRelationshipHandler: ToolCallback<{ schema: z.ZodString; table1: z.ZodString; table2: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    // Find direct FK relationships
    const fkRes = await client.query(`
      SELECT kcu.column_name AS fk_column, ccu.column_name AS pk_column, tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (
          (kcu.table_schema = $1 AND kcu.table_name = $2 AND ccu.table_name = $3) OR
          (kcu.table_schema = $1 AND kcu.table_name = $3 AND ccu.table_name = $2)
        )
    `, [args.schema, args.table1, args.table2]);
    if (fkRes.rowCount === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            explanation: `There is no direct foreign key relationship between "${args.table1}" and "${args.table2}" in schema "${args.schema}".`
          })
        }]
      };
    }
    const rel = fkRes.rows[0];
    if (rel.constraint_type === "FOREIGN KEY") {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            explanation: `Table "${args.table1}" is related to "${args.table2}" via foreign key: "${rel.fk_column}" references "${rel.pk_column}".`
          })
        }]
      };
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          explanation: "Relationship found but type could not be determined."
        })
      }]
    };
  } finally {
    client.release();
  }
};

export function register(server: McpServer) {
  server.registerTool("find_related_tables", {
    description: "Find related tables for the specified table using FK constraints.",
    inputSchema: {
      schema: z.string(),
      table: z.string()
    },
    outputSchema: {
      related_tables: z.array(z.object({
        schema: z.string(),
        table: z.string(),
        fk_column: z.string(),
        pk_column: z.string()
      }))
    }
  }, findRelatedTablesHandler);

  server.registerTool("describe_relationship", {
    description: "Describe the relationship between two tables in English.",
    inputSchema: {
      schema: z.string(),
      table1: z.string(),
      table2: z.string()
    },
    outputSchema: {
      explanation: z.string()
    }
  }, describeRelationshipHandler);
}