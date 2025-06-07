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
import * as relationshipTools from './tools/relationships.js';

const server = new McpServer({
  name: "PostgreSQL MCP Server",
  version: "1.0.0"
});

// Register all tools
schemaTools.register(server);
erdTools.register(server);
fuzzyTools.register(server);
sampleTools.register(server);
relationshipTools.register(server);

let httpTransport: StreamableHTTPServerTransport | null = null;

async function start() {
  if (process.argv.includes("--stdio")) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP server running on STDIO");

    // Handle cleanup on process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await server.close();
      process.exit(0);
    });
  } else {
    const app = express();
    app.use(express.json());

    // Create HTTP transport once
    httpTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(httpTransport);

    app.post("/mcp", async (req, res) => {
      if (!httpTransport) {
        res.status(500).json({ error: "Server not properly initialized" });
        return;
      }
      await httpTransport.handleRequest(req, res, req.body);
    });

    const httpServer = app.listen(config.serverPort, () => {
      console.log(`MCP server running on port ${config.serverPort}`);
    });

    // Handle cleanup on process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
      await server.close();
      process.exit(0);
    });
  }
}

start().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
