import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";
import stringSimilarity from "string-similarity";

const fuzzyColumnMatchHandler: ToolCallback<{ schema: z.ZodString; table: z.ZodString; keyword: z.ZodString }> = async (args, extra) => {
  const client = await pool.connect();
  try {
    // Get columns and comments from pg_catalog
    const columnsRes = await client.query(
      `
      SELECT
        a.attname as column_name,
        d.description as comment
      FROM
        pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_description d ON a.attrelid = d.objoid AND a.attnum = d.objsubid
      WHERE
        c.relkind = 'r'
        AND n.nspname = $1
        AND c.relname = $2
        AND a.attnum > 0
      `,
      [args.schema, args.table]
    );
    const columns = columnsRes.rows.map((row) => ({
      name: row.column_name,
      comment: row.comment || undefined,
    }));

    // Combine keyword, column name, and comment for best match
    const possibilities = columns.map(col => {
      let base = col.name;
      if (col.comment) base += " " + col.comment;
      return base;
    });

    const matches = stringSimilarity.findBestMatch(
      args.keyword.toLowerCase(),
      possibilities.map(s => s.toLowerCase())
    );

    const all_matches = matches.ratings
      .map((rating, i) => ({
        column: columns[i].name,
        similarity: rating.rating,
        comment: columns[i].comment
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const best = all_matches[0];
    const result = {
      best_match: best && best.similarity > 0.3 ? best.column : null,
      all_matches
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result)
      }],
      structuredContent: result
    };
  } finally {
    client.release();
  }
};

export function register(server: McpServer) {
  server.registerTool("fuzzy_column_match", {
    description: "Finds the best matching column in a table given a user keyword, using similarity and column comments.",
    inputSchema: {
      schema: z.string(),
      table: z.string(),
      keyword: z.string()
    },
    outputSchema: {
      best_match: z.union([z.string(), z.null()]),
      all_matches: z.array(z.object({
        column: z.string(),
        similarity: z.number(),
        comment: z.string().optional()
      }))
    }
  }, fuzzyColumnMatchHandler);
}