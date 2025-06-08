# MCP PostgreSQL Server

A production-grade, extensible Model Context Protocol (MCP) server for PostgreSQL, designed for LLM coding agents in VSCode, Cursor, and other IDEs.

## Features
- **MCP-compliant**: Implements the MCP spec using [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **PostgreSQL**: Uses `pg` with connection pooling
- **Modular Tools**: All tools are organized in separate modules for extensibility
- **Transports**: Supports both HTTP (Streamable HTTP) and STDIO
- **TypeScript**: Fully typed, strict, and documented
- **.env Config**: Uses `dotenv` for configuration
- **SSL Support**: Configurable SSL connection to PostgreSQL
- **Extensible**: Easy to add custom tools and extend functionality
- **Query Safety**: Built-in protection against resource-intensive queries

## Installation
```bash
npm install mcp-server-postgresql
```

## Usage
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "mcp-server-postgresql/tools";

const server = new McpServer({
  name: "My MCP Server",
  version: "1.0.0"
});

// Register all built-in tools
registerAllTools(server);

// Start the server
server.start();
```

## Extending with Custom Tools
You can create your own tools by implementing the `ToolModule` interface:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define your tool handler
const myCustomToolHandler: ToolCallback<{ param1: z.ZodString }> = async (args, extra) => {
  // Your tool implementation
  return { content: [{ type: "text", text: "Result" }] };
};

// Create a tool module
export function register(server: McpServer) {
  server.registerTool("my_custom_tool", {
    description: "Description of my custom tool",
    inputSchema: {
      param1: z.string()
    },
    outputSchema: {
      result: z.string()
    }
  }, myCustomToolHandler);
}

// Use in your server
import { register as registerCustomTool } from "./my-custom-tool.js";

const server = new McpServer({
  name: "My MCP Server",
  version: "1.0.0"
});

// Register built-in tools
registerAllTools(server);

// Register your custom tool
registerCustomTool(server);

server.start();
```

## Built-in Tools
- `list_tables`: List all tables in a schema
- `list_columns`: List all columns for a table (with comments)
- `find_related_tables`: Show direct FK relationships for a table
- `describe_relationship`: Describe the relationship between two tables
- `generate_erd_mermaid`: Generate a Mermaid ERD diagram for a schema
- `generate_erd_json`: Generate a JSON graph of schema structure
- `fuzzy_column_match`: Fuzzy match a column by natural language phrase
- `sample_column_data`: Return sample data from a column
- `run_query`: Execute SELECT queries with safety measures:
  - Query complexity analysis
  - Rate limiting
  - Result size limiting
  - Query timeout protection
  - Structured responses

## Configuration
Create a `.env` file in your project root:
```ini
# PostgreSQL Connection
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=yourpassword
PGDATABASE=mydb

# SSL Configuration (optional)
PGSSL=true                    # Enable SSL connection
PGSSL_REJECT_UNAUTHORIZED=true # Reject unauthorized SSL certificates

# Server Configuration
PORT=8080
```

## Development
1. **Clone the repo**
2. **Install dependencies**
   ```sh
   npm install
   ```
3. **Build**
   ```sh
   npm run build
   ```
4. **Run**
   ```sh
   npm start
   ```

### Development Scripts
- `npm run build` - Build the TypeScript project
- `npm start` - Run the built server
- `npm run dev` - Run the server in development mode using tsx
- `npm run release:beta` - Create and publish a beta release
- `npm run release:patch` - Create and publish a patch release
- `npm run release:minor` - Create and publish a minor release
- `npm run release:major` - Create and publish a major release

## Dependencies
- `@modelcontextprotocol/sdk`: ^1.12.1
- `dotenv`: ^16.4.5
- `pg`: ^8.12.0
- `string-similarity`: ^4.0.4

## License
MIT 