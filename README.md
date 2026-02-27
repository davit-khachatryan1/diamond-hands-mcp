# diamond-hands-mcp — MCP Server v2

MCP server for Cursor AI that returns Diamond Hands loan origination cost using the `@gvnrdao/dh-sdk`.

- **Uses the Diamond Hands SDK** to query real loan data from the subgraph
- **SDK-only mode** — returns real data or a minimal structured failure payload
- **SDK Result-aware integration** — MCP unwraps SDK `{ success, value/error }` responses
- **Env vars via mcp.json** — all runtime config is required and passed securely

---

## Project structure

```
diamond-hands-mcp/
├── src/
│   ├── index.ts                 ← MCP server entry point (stdio)
│   ├── types.ts                 ← shared TypeScript interfaces
│   ├── sdkClient.ts             ← SDK init + loan data fetcher
│   ├── feeService.ts            ← pure business logic (no I/O)
│   └── tools/
│       ├── getNewLoanCost.ts    ← MCP tool definition + handler
│       └── getAllLoans.ts       ← MCP tool definition + handler
├── test/
│   ├── feeService.test.ts       ← unit tests
│   ├── getNewLoanCost.test.ts   ← integration tests (mocked SDK)
│   └── getAllLoans.test.ts      ← integration tests (mocked SDK)
├── dist/                        ← compiled output (after npm run build)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

```bash
cd diamond-hands-mcp
npm install
npm run build
npm test
```

---

## Cursor MCP config

Paste this into `.cursor/mcp.json` in your Cursor project, filling in your values.
If you previously used the old name `diamond-hands-loan-cost`, update it to `diamond-hands-mcp` and fix the path:

```json
{
  "mcpServers": {
    "diamond-hands-mcp": {
      "command": "node",
      "args": ["/Users/davitkhachatryan/Desktop/Projects/diamond-hands-mcp/dist/index.js"],
      "env": {
        "SUBGRAPH_URL": "https://api.studio.thegraph.com/query/65258/diamond-hands/v0.6.23",
        "GRAPH_API_KEY": "your_graph_api_key",
        "ETH_RPC_URL": "https://sepolia.infura.io/v3/YOUR_KEY",
        "PRIVATE_KEY": "0xYOUR_PRIVATE_KEY",
        "CHAIN_ID": "11155111",
        "SERVICE_ENDPOINT": "https://diamond-hands-lit-ops-server-0d655e7f3988.herokuapp.com",
        "BITCOIN_PROVIDER_URL": "https://dh-btc-faucet-jw-bb7756976029.herokuapp.com",
        "BITCOIN_PROVIDER_NAME": "Diamond Hands",
        "BITCOIN_PROVIDER_NETWORK": "regtest"
      }
    }
  }
}
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ETH_RPC_URL` | Yes | Sepolia RPC endpoint (Infura, Alchemy, etc.) |
| `PRIVATE_KEY` | Yes | Wallet private key — SDK needs a signer |
| `GRAPH_API_KEY` | Yes | The Graph API key for subgraph access |
| `SUBGRAPH_URL` | Yes | Diamond Hands subgraph URL |
| `CHAIN_ID` | Yes | Supported values: `1` (mainnet) or `11155111` (sepolia) |
| `SERVICE_ENDPOINT` | Yes | Diamond Hands service endpoint |
| `BITCOIN_PROVIDER_URL` | Yes | Bitcoin provider base URL or `/api/esplora` URL |
| `BITCOIN_PROVIDER_NAME` | No | Provider display name (defaults to `Diamond Hands`) |
| `BITCOIN_PROVIDER_NETWORK` | No | `regtest`, `testnet`, or `mainnet` (defaults to `regtest`) |

After saving, fully quit and reopen Cursor. Check **Settings → Tools & MCP** for the green dot.

---

## Use in Cursor chat

Switch to **Agent mode** and try:

- *"What is the cost of a new Diamond Hands loan?"*
- *"What is the fee for a $10,000 loan?"*
- *"Give me the loan cost for $50,000."*
- *"What would I pay in origination fees on a $250,000 loan?"*
- *"Get all loans page 0 with 10 rows."*
- *"Show loans page 1 maxRows 20."*

---

## Response format

### `get_new_loan_cost`

Success (`status: "real"`):

```json
{
  "status": "real",
  "source": "sdk",
  "termMonths": 12,
  "originationFeeBps": 300,
  "originationFeePercent": "3%",
  "loanAmountUsd": 10000,
  "feeCostUsd": 300,
  "formula": "feeCostUsd = 10000 × (3% / 100) = 300",
  "message": "New loan cost is 3% (300 bps). For $10,000, fee is $300.00."
}
```

Failure (`status: "failed"`):

```json
{
  "status": "failed",
  "source": "sdk",
  "errorCode": "SDK_FETCH_FAILED",
  "message": "Failed to get terms with fees: execution reverted"
}
```

---

### `get_all_loans`

Input:

```json
{
  "page": 0,
  "maxRows": 10
}
```

- `page` default: `0` (0-based index)
- `maxRows` default: `10`, max allowed: `50`
- One page per call. To fetch all loans, request subsequent pages (`0`, `1`, `2`, ...).

Success (`status: "real"`):

```json
{
  "status": "real",
  "source": "sdk",
  "page": 0,
  "maxRows": 10,
  "totalLoans": 2,
  "loans": [
    { "id": "loan-1" },
    { "id": "loan-2" }
  ],
  "message": "Found 2 loans on page 0 (maxRows 10, totalLoans 2)."
}
```

Failure (`status: "failed"`):

```json
{
  "status": "failed",
  "source": "sdk",
  "errorCode": "SDK_FETCH_FAILED",
  "message": "Failed to query loans"
}
```

---

## Data flow

```
User asks in Cursor chat
  → Cursor calls get_new_loan_cost or get_all_loans tool
    → sdkClient fetches live data from Diamond Hands SDK
      → MCP unwraps SDK Result envelopes (`{ success, value/error }`)
    → feeService computes fee result (for get_new_loan_cost)
    → if SDK fails, tool returns minimal failed payload:
      { status: "failed", source: "sdk", errorCode, message }
  → Response returned to chat
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `status: "failed"` | Check required MCP env values and SDK connectivity |
| `Cannot find module @gvnrdao/dh-sdk` | Run `npm install` |
| Server not visible in Cursor | Fully quit and reopen Cursor |
| Tool never called | Switch to Agent mode in chat |
