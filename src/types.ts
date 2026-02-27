// ─────────────────────────────────────────────────────────────────────────────
// src/types.ts — shared TypeScript interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type LoanCostErrorCode =
  | "SDK_CONFIG_MISSING_ENV"
  | "SDK_CONFIG_INVALID_CHAIN_ID"
  | "SDK_INIT_FAILED"
  | "SDK_FETCH_FAILED"
  | "SDK_NO_LOAN_DATA"
  | "SDK_NO_VALID_TERMS";

/** Success payload: real data from the SDK. */
export interface LoanCostSuccess {
  status: "real";
  termMonths: number;
  originationFeeBps: number;
  originationFeePercent: string;
  loanAmountUsd: number | null;
  feeCostUsd: number | null;
  source: "sdk";
  formula: string;
  message: string;
}

/** Success payload: paginated loan list from the SDK. */
export interface GetAllLoansSuccess {
  status: "real";
  source: "sdk";
  page: number;
  maxRows: number;
  totalLoans: number;
  loans: unknown[];
  message: string;
}

/** Failed payload: minimal error shape when real SDK data is unavailable. */
export interface LoanCostError {
  status: "failed";
  source: "sdk";
  errorCode: LoanCostErrorCode;
  message: string;
}

/** The structured output returned by the get_new_loan_cost MCP tool. */
export type LoanCostResult = LoanCostSuccess | LoanCostError;

/** The structured output returned by the get_all_loans MCP tool. */
export type GetAllLoansResult = GetAllLoansSuccess | LoanCostError;
