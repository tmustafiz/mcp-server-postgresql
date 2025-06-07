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

## Tools Exposed
- `list_tables`: List all tables in a schema
- `list_columns`: List all columns for a table (with comments)
- `find_related_tables`: Show direct FK relationships for a table
- `describe_relationship`: Describe the relationship between two tables
- `generate_erd_mermaid`: Generate a Mermaid ERD diagram for a schema
- `generate_erd_json`: Generate a JSON graph of schema structure
- `fuzzy_column_match`: Fuzzy match a column by natural language phrase
- `sample_column_data`: Return sample data from a column

## Architecture
- `src/mcp-server.ts`: Main entry, registers all tools, starts server
- `src/config.ts`: Loads config from `.env`
- `src/db.ts`: PostgreSQL connection pool
- `src/tools/`: Tool modules (schema, erd, fuzzy, sample)

## Setup
1. **Clone the repo**
2. **Install dependencies**
   ```sh
   npm install
   ```
3. **Create a `.env` file** in the project root:
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

## Build & Run
- **Build:**
  ```sh
  npm run build
  ```
- **Run (HTTP):**
  ```sh
  npm start
  # MCP server on http://localhost:8080/mcp
  ```
- **Run (STDIO):**
  ```sh
  node dist/mcp-server.js --stdio
  ```
- **Dev mode (hot reload):**
  ```sh
  npm run dev
  ```

## Tool API (Example)
All tools are exposed via MCP protocol. For HTTP, POST to `/mcp` with a JSON-RPC 2.0 request.

### Example: List Tables
```sh
curl -X POST http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "callTool",
    "params": {
      "name": "list_tables",
      "arguments": { "schema": "public" }
    }
  }'
```

### Example Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "[\"users\",\"orders\"]" }
    ]
  }
}
```

## Testing
- Use `curl`, Postman, or the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- For STDIO, use an MCP-compatible client or pipe JSON-RPC requests to stdin

## Extending
- Add new tools in `src/tools/` and register them in `src/mcp-server.ts`
- Each tool module exports a `register(server: McpServer)` function

## License
MIT 