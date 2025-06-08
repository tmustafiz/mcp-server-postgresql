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
import { registerAllTools } from "./tools/index.js";

const server = new McpServer({
  name: "PostgreSQL MCP Server",
  version: "1.0.0"
});

// Register all built-in tools
registerAllTools(server);

async function start() {
  if (process.argv.includes("--stdio")) {
    // Use STDIO transport
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
    // Use HTTP transport
    const app = express();
    app.use(express.json());

    const httpTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(httpTransport);

    // Handle both root path and /mcp for compatibility
    const handleMcpRequest = async (req: express.Request, res: express.Response) => {
      await httpTransport.handleRequest(req, res, req.body);
    };

    app.post("/", handleMcpRequest);
    app.post("/mcp", handleMcpRequest);

    const httpServer = app.listen(config.serverPort, () => {
      console.log(`MCP server running on port ${config.serverPort}`);
      console.log(`Available endpoints:`);
      console.log(`  - POST http://localhost:${config.serverPort}/`);
      console.log(`  - POST http://localhost:${config.serverPort}/mcp`);
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
