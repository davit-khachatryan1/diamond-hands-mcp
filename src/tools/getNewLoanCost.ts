// ─────────────────────────────────────────────────────────────────────────────
// src/tools/getNewLoanCost.ts — MCP tool: get_new_loan_cost
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import { fetchLoanTerms } from "../sdkClient.js";
import { computeLoanCost, DEFAULT_TERM_MONTHS } from "../feeService.js";
import type { LoanCostErrorCode, LoanCostResult } from "../types.js";

// ── Input schema (Zod → auto JSON Schema for MCP) ────────────────────────────

export const GetNewLoanCostSchema = z.object({
  loanAmountUsd: z.number().positive().optional()
    .describe("Loan principal in USD (e.g. 10000 for a $10,000 loan)"),
  termMonths: z.number().int().positive().optional()
    .describe("Loan term in months (default: 12)"),
});

export type GetNewLoanCostInput = z.infer<typeof GetNewLoanCostSchema>;

function getErrorCode(error: unknown): LoanCostErrorCode {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code as LoanCostErrorCode;
    if ([
      "SDK_CONFIG_MISSING_ENV",
      "SDK_CONFIG_INVALID_CHAIN_ID",
      "SDK_INIT_FAILED",
      "SDK_FETCH_FAILED",
      "SDK_NO_LOAN_DATA",
      "SDK_NO_VALID_TERMS",
    ].includes(code)) {
      return code;
    }
  }
  return "SDK_FETCH_FAILED";
}

function extractErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    if (message.length > 0) {
      return message;
    }
  }
  return "Failed to fetch loan terms from Diamond Hands SDK.";
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleGetNewLoanCost(rawInput: unknown): Promise<LoanCostResult> {
  const input = GetNewLoanCostSchema.parse(rawInput);
  const termMonths = input.termMonths ?? DEFAULT_TERM_MONTHS;
  const loanAmountUsd = input.loanAmountUsd ?? null;

  // SDK-only mode: return real data on success, minimal error payload on failure.
  try {
    const { terms } = await fetchLoanTerms();
    return computeLoanCost(terms, loanAmountUsd, termMonths);
  } catch (error) {
    const errorCode = getErrorCode(error);
    console.error("[get_new_loan_cost] SDK fetch failed:", errorCode);
    return {
      status: "failed",
      source: "sdk",
      errorCode,
      message: extractErrorMessage(error),
    };
  }
}
