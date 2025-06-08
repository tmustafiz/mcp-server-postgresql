import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pool } from "../db.js";
import { QueryResult } from "pg";

// Constants for safety measures
const MAX_ROWS = 1000;
const QUERY_TIMEOUT_MS = 30000; // 30 seconds
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_QUERIES_PER_WINDOW = 10;
const MAX_EXECUTION_TIME_MS = 60000; // 1 minute

// Rate limiting state
const queryCounts = new Map<string, number>();
const lastReset = new Map<string, number>();

// Helper function to check if query is SELECT only
function isSelectOnly(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery.startsWith('select') && 
         !normalizedQuery.includes('insert') &&
         !normalizedQuery.includes('update') &&
         !normalizedQuery.includes('delete') &&
         !normalizedQuery.includes('drop') &&
         !normalizedQuery.includes('alter') &&
         !normalizedQuery.includes('create') &&
         !normalizedQuery.includes('truncate');
}

// Helper function to check rate limit
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const lastResetTime = lastReset.get(clientId) || 0;
  
  if (now - lastResetTime > RATE_LIMIT_WINDOW_MS) {
    queryCounts.set(clientId, 0);
    lastReset.set(clientId, now);
  }
  
  const count = queryCounts.get(clientId) || 0;
  if (count >= MAX_QUERIES_PER_WINDOW) {
    return false;
  }
  
  queryCounts.set(clientId, count + 1);
  return true;
}

// Helper function to analyze query complexity
function analyzeQueryComplexity(query: string): { 
  isComplex: boolean; 
  reason?: string;
} {
  const normalizedQuery = query.toLowerCase();
  
  // Check for potentially expensive operations
  const hasSubqueries = (normalizedQuery.match(/select.*select/gi) || []).length > 0;
  const hasWindowFunctions = normalizedQuery.includes('over(');
  const hasRecursiveCTE = normalizedQuery.includes('with recursive');
  const hasFullTextSearch = normalizedQuery.includes('to_tsvector') || normalizedQuery.includes('to_tsquery');
  const hasAggregations = normalizedQuery.includes('group by') || normalizedQuery.includes('having');
  
  // Count the number of complex operations
  const complexOperations = [
    hasSubqueries,
    hasWindowFunctions,
    hasRecursiveCTE,
    hasFullTextSearch,
    hasAggregations
  ].filter(Boolean).length;

  if (complexOperations >= 3) {
    return {
      isComplex: true,
      reason: 'Query contains multiple complex operations that may impact performance'
    };
  }

  return { isComplex: false };
}

// Main tool handler
const runQueryHandler: ToolCallback<{ 
  query: z.ZodString,
  clientId: z.ZodString 
}> = async (args, extra) => {
  const { query, clientId } = args;

  try {
    // Safety checks
    if (!isSelectOnly(query)) {
      return {
        content: [{ 
          type: "text", 
          text: "Only SELECT queries are allowed for safety reasons." 
        }]
      };
    }

    // Analyze query complexity
    const complexity = analyzeQueryComplexity(query);
    if (complexity.isComplex) {
      return {
        content: [{ 
          type: "text", 
          text: `Query complexity warning: ${complexity.reason}. Please optimize your query or contact an administrator.` 
        }]
      };
    }

    if (!checkRateLimit(clientId)) {
      return {
        content: [{ 
          type: "text", 
          text: "Rate limit exceeded. Please wait before making more queries." 
        }]
      };
    }

    // Execute query with timeout and execution time limit
    const result = await Promise.race([
      (async () => {
        await pool.query(`SET statement_timeout = ${MAX_EXECUTION_TIME_MS}`);
        return pool.query(query);
      })(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
      )
    ]) as QueryResult;

    // Limit results
    const limitedRows = result.rows.slice(0, MAX_ROWS);
    const wasLimited = result.rows.length > MAX_ROWS;

    // Format the response
    const response = {
      rows: limitedRows,
      rowCount: limitedRows.length,
      totalRowCount: result.rows.length,
      wasLimited,
      fields: result.fields.map(f => ({
        name: f.name,
        dataTypeID: f.dataTypeID
      }))
    };

    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify(response, null, 2) 
      }],
      structuredContent: {
        rows: response.rows,
        rowCount: response.rowCount,
        totalRowCount: response.totalRowCount,
        wasLimited: response.wasLimited,
        fields: response.fields
      }
    };

  } catch (error) {
    const errorResponse = {
      rows: [],
      rowCount: 0,
      totalRowCount: 0,
      wasLimited: false,
      fields: []
    };

    return {
      content: [{ 
        type: "text", 
        text: `Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }],
      structuredContent: errorResponse
    };
  }
};

// Register the tool
export function register(server: McpServer) {
  server.registerTool("run_query", {
    description: "Execute a SELECT query with safety measures",
    inputSchema: {
      query: z.string().describe("The SELECT query to execute"),
      clientId: z.string().describe("Unique identifier for rate limiting")
    },
    outputSchema: {
      rows: z.array(z.record(z.any())),
      rowCount: z.number(),
      totalRowCount: z.number(),
      wasLimited: z.boolean(),
      fields: z.array(z.object({
        name: z.string(),
        dataTypeID: z.number()
      }))
    }
  }, runQueryHandler);
}
