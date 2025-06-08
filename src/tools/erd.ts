import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";

type TableInfo = {
  name: string;
  columns: string[];
  primary_keys: string[];
  foreign_keys: { column: string; references: { table: string; column: string } }[];
};

type Relationship = {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
};

const generateErdMermaidHandler: ToolCallback<{ schema: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [args.schema]
    );
    const tables = tablesRes.rows.map((row) => row.table_name);

    const columnsRes = await client.query(`
      SELECT c.table_name, c.column_name, 
             tc.constraint_type, kcu2.table_name as fk_table, kcu2.column_name as fk_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name AND tc.table_schema = c.table_schema
      LEFT JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      LEFT JOIN information_schema.key_column_usage kcu2
        ON rc.unique_constraint_name = kcu2.constraint_name AND kcu2.constraint_schema = c.table_schema
      WHERE c.table_schema = $1
    `, [args.schema]);

    const tableCols: Record<string, { columns: string[], pk: string[], fk: { col: string, ref_table: string, ref_col: string }[] }> = {};
    for (const table of tables) {
      tableCols[table] = { columns: [], pk: [], fk: [] };
    }
    for (const row of columnsRes.rows) {
      if (!tableCols[row.table_name]) continue;
      tableCols[row.table_name].columns.push(row.column_name);
      if (row.constraint_type === "PRIMARY KEY") tableCols[row.table_name].pk.push(row.column_name);
      if (row.constraint_type === "FOREIGN KEY" && row.fk_table) {
        tableCols[row.table_name].fk.push({ col: row.column_name, ref_table: row.fk_table, ref_col: row.fk_column });
      }
    }

    let mermaid = "erDiagram\n";
    for (const [table, { columns, pk }] of Object.entries(tableCols)) {
      mermaid += `  ${table} {\n`;
      for (const col of columns) {
        const pkMark = pk.includes(col) ? " PK" : "";
        mermaid += `    string ${col}${pkMark}\n`;
      }
      mermaid += `  }\n`;
    }
    for (const [table, { fk }] of Object.entries(tableCols)) {
      for (const relation of fk) {
        mermaid += `  ${table} }o--|| ${relation.ref_table} : "${relation.col} to ${relation.ref_col}"\n`;
      }
    }

    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({ diagram: mermaid })
      }],
      structuredContent: { diagram: mermaid }
    };
  } finally {
    client.release();
  }
};

const generateErdJsonHandler: ToolCallback<{ schema: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [args.schema]
    );
    const tables = tablesRes.rows.map((row) => row.table_name);

    const columnsRes = await client.query(`
      SELECT c.table_name, c.column_name, 
             tc.constraint_type, kcu2.table_name as fk_table, kcu2.column_name as fk_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name AND tc.table_schema = c.table_schema
      LEFT JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      LEFT JOIN information_schema.key_column_usage kcu2
        ON rc.unique_constraint_name = kcu2.constraint_name AND kcu2.constraint_schema = c.table_schema
      WHERE c.table_schema = $1
    `, [args.schema]);

    const tablesJson: TableInfo[] = [];
    const relationships: Relationship[] = [];
    const tableMap: Record<string, TableInfo> = {};
    for (const table of tables) {
      tableMap[table] = {
        name: table,
        columns: [],
        primary_keys: [],
        foreign_keys: []
      };
      tablesJson.push(tableMap[table]);
    }
    for (const row of columnsRes.rows) {
      if (!tableMap[row.table_name]) continue;
      tableMap[row.table_name].columns.push(row.column_name);
      if (row.constraint_type === "PRIMARY KEY") tableMap[row.table_name].primary_keys.push(row.column_name);
      if (row.constraint_type === "FOREIGN KEY" && row.fk_table) {
        tableMap[row.table_name].foreign_keys.push({
          column: row.column_name,
          references: { table: row.fk_table, column: row.fk_column }
        });
        relationships.push({
          from_table: row.table_name,
          from_column: row.column_name,
          to_table: row.fk_table,
          to_column: row.fk_column,
        });
      }
    }
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({ tables: tablesJson, relationships })
      }],
      structuredContent: { tables: tablesJson, relationships }
    };
  } finally {
    client.release();
  }
};

export function register(server: McpServer) {
  server.registerTool("generate_erd_mermaid", {
    description: "Generate a Mermaid ERD diagram for the given schema.",
    inputSchema: {
      schema: z.string()
    },
    outputSchema: {
      diagram: z.string()
    }
  }, generateErdMermaidHandler);

  server.registerTool("generate_erd_json", {
    description: "Return the ERD as a JSON graph for the given schema.",
    inputSchema: {
      schema: z.string()
    },
    outputSchema: {
      tables: z.array(z.object({
        name: z.string(),
        columns: z.array(z.string()),
        primary_keys: z.array(z.string()),
        foreign_keys: z.array(z.object({
          column: z.string(),
          references: z.object({
            table: z.string(),
            column: z.string()
          })
        }))
      })),
      relationships: z.array(z.object({
        from_table: z.string(),
        from_column: z.string(),
        to_table: z.string(),
        to_column: z.string()
      }))
    }
  }, generateErdJsonHandler);
}