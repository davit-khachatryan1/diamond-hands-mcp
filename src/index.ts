// ─────────────────────────────────────────────────────────────────────────────
// src/index.ts — MCP server entry point (stdio transport)
//
// Cursor launches this as a subprocess, communicates over stdin/stdout.
// ─────────────────────────────────────────────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { handleGetNewLoanCost, GetNewLoanCostSchema } from "./tools/getNewLoanCost.js";
import { handleGetAllLoans, GetAllLoansSchema } from "./tools/getAllLoans.js";

// Create the MCP server — name must match the key in .cursor/mcp.json.
const server = new McpServer({
  name: "diamond-hands-mcp",
  version: "2.0.0",
});

// Register the tool. Cursor's AI reads the description to decide when to call it.
server.tool(
  "get_new_loan_cost",
  "Get the origination fee (cost) for a new Diamond Hands loan. " +
    "Returns real fee data from the live Diamond Hands SDK. " +
    "If live data cannot be fetched, returns a minimal structured failure payload. " +
    "Optionally computes the fee in USD for a given loan amount.",
  GetNewLoanCostSchema.shape,
  async (args) => {
    const result = await handleGetNewLoanCost(args);
    return {
      content: [
        { type: "text", text: result.message },
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  }
);

server.tool(
  "get_all_loans",
  "Get paginated Diamond Hands loans from the live SDK using page/maxRows. " +
    "Returns full loan objects from sdk.getLoansAll on success, " +
    "or a minimal structured failure payload on error.",
  GetAllLoansSchema.shape,
  async (args) => {
    const result = await handleGetAllLoans(args);
    return {
      content: [
        { type: "text", text: result.message },
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  }
);

// Connect via stdio and start listening.
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("[diamond-hands-mcp] MCP server v2.0 running on stdio.");
});
