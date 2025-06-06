/**
 * MCP PostgreSQL Server
 *
 * How to run:
 *   1. Create a .env file with your PostgreSQL config (see below).
 *   2. Build:   npm run build
 *   3. Start:   npm start
 *   4. Or for dev: npm run dev
 *
 * .env example:
 *   PGHOST=localhost
 *   PGPORT=5432
 *   PGUSER=postgres
 *   PGPASSWORD=yourpassword
 *   PGDATABASE=mydb
 *   PORT=8080
 *
 * The server supports HTTP (with SSE) and STDIO transports as per MCP spec.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { config } from "./config.js";
import './db.js';
import * as schemaTools from './tools/schema.js';
import * as erdTools from './tools/erd.js';
import * as fuzzyTools from './tools/fuzzy.js';
import * as sampleTools from './tools/sample.js';

const server = new McpServer({
  name: "PostgreSQL MCP Server",
  version: "1.0.0"
});

// Register all tools
schemaTools.register(server);
erdTools.register(server);
fuzzyTools.register(server);
sampleTools.register(server);

async function start() {
  if (process.argv.includes("--stdio")) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP server running on STDIO");
  } else {
    const app = express();
    app.use(express.json());
    app.post("/mcp", async (req, res) => {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
    app.listen(config.serverPort, () => {
      console.log(`MCP server running on port ${config.serverPort}`);
    });
  }
}

start().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
