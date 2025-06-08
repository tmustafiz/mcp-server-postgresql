import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";

const listSchemasHandler: ToolCallback<{}> = async (args, extra) => {
  console.log("[list_schemas] Starting handler");
  console.log("[list_schemas] Pool status:", {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });

  let client;
  try {
    console.log("[list_schemas] Attempting to get client from pool");
    client = await pool.connect();
    console.log("[list_schemas] Successfully got client from pool");

    console.log("[list_schemas] Executing query");
    const query = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name
    `;
    console.log("[list_schemas] Query:", query);
    
    const res = await client.query(query);
    console.log("[list_schemas] Raw query result:", res.rows);
    
    const schemas = res.rows.map(row => row.schema_name);
    console.log("[list_schemas] Processed schemas:", schemas);
    
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({ schemas })
      }],
      structuredContent: { schemas }
    };
  } catch (error: any) {
    console.error("[list_schemas] Error details:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    throw error;
  } finally {
    if (client) {
      console.log("[list_schemas] Releasing client back to pool");
      client.release();
    }
  }
};

const listTablesHandler: ToolCallback<{ schema: z.ZodString }> = async (args, extra) => {
  console.log("[list_tables] Starting handler with args:", args);
  
  if (!args.schema) {
    console.log("[list_tables] Missing schema parameter");
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Schema parameter is required. Please provide a schema name (e.g., 'public')."
        })
      }]
    };
  }

  let client;
  try {
    console.log("[list_tables] Attempting to get client from pool");
    client = await pool.connect();
    console.log("[list_tables] Successfully got client from pool");

    console.log("[list_tables] Executing query for schema:", args.schema);
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    `;
    console.log("[list_tables] Query:", query, "with params:", [args.schema]);
    
    const res = await client.query(query, [args.schema]);
    console.log("[list_tables] Raw query result:", res.rows);
    
    const tables = res.rows.map(row => row.table_name);
    console.log("[list_tables] Processed tables:", tables);
    
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({ tables })
      }],
      structuredContent: { tables }
    };
  } catch (error: any) {
    console.error("[list_tables] Error details:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    throw error;
  } finally {
    if (client) {
      console.log("[list_tables] Releasing client back to pool");
      client.release();
    }
  }
};

const listColumnsHandler: ToolCallback<{ schema: z.ZodString; table: z.ZodString }> = async (args, extra) => {
  console.log("[list_columns] Starting handler with args:", args);
  
  if (!args.schema || !args.table) {
    console.log("[list_columns] Missing required parameters");
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Both schema and table parameters are required. Please provide both schema and table names."
        })
      }]
    };
  }

  let client;
  try {
    console.log("[list_columns] Attempting to get client from pool");
    client = await pool.connect();
    console.log("[list_columns] Successfully got client from pool");

    console.log("[list_columns] Executing query for schema:", args.schema, "table:", args.table);
    const query = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
    `;
    console.log("[list_columns] Query:", query, "with params:", [args.schema, args.table]);
    
    const res = await client.query(query, [args.schema, args.table]);
    console.log("[list_columns] Raw query result:", res.rows);
    
    const columns = res.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      is_nullable: row.is_nullable === "YES"
    }));
    console.log("[list_columns] Processed columns:", columns);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ columns })
      }],
      structuredContent: { columns }
    };
  } catch (error: any) {
    console.error("[list_columns] Error details:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    throw error;
  } finally {
    if (client) {
      console.log("[list_columns] Releasing client back to pool");
      client.release();
    }
  }
};

export function register(server: McpServer) {
  console.log("[schema] Registering schema tools");
  console.log("[schema] Pool configuration:", {
    host: pool.options.host,
    port: pool.options.port,
    database: pool.options.database,
    user: pool.options.user,
    ssl: pool.options.ssl
  });
  
  server.registerTool("list_schemas", {
    description: "List all available schemas in the database, excluding system schemas.",
    inputSchema: {},
    outputSchema: {
      schemas: z.array(z.string())
    }
  }, listSchemasHandler);

  server.registerTool("list_tables", {
    description: "List all tables in a schema. Requires a schema name (e.g., 'public').",
    inputSchema: {
      schema: z.string().describe("The name of the schema to list tables from (e.g., 'public')")
    },
    outputSchema: {
      tables: z.array(z.string())
    }
  }, listTablesHandler);

  server.registerTool("list_columns", {
    description: "List columns for a table. Requires both schema and table names.",
    inputSchema: {
      schema: z.string().describe("The name of the schema containing the table"),
      table: z.string().describe("The name of the table to list columns from")
    },
    outputSchema: {
      columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        is_nullable: z.boolean()
      }))
    }
  }, listColumnsHandler);
  
  console.log("[schema] Schema tools registered successfully");
}