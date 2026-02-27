// ─────────────────────────────────────────────────────────────────────────────
// src/tools/getAllLoans.ts — MCP tool: get_all_loans
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import { fetchAllLoans } from "../sdkClient.js";
import type { GetAllLoansResult, LoanCostErrorCode } from "../types.js";

export const GetAllLoansSchema = z.object({
  page: z.number().int().min(0).default(0)
    .describe("0-based page index (default: 0)"),
  maxRows: z.number().int().min(1).max(50).default(10)
    .describe("Page size, min 1, max 50 (default: 10)"),
});

export type GetAllLoansInput = z.infer<typeof GetAllLoansSchema>;

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
  return "Failed to fetch loans from Diamond Hands SDK.";
}

export async function handleGetAllLoans(rawInput: unknown): Promise<GetAllLoansResult> {
  const input = GetAllLoansSchema.parse(rawInput ?? {});

  try {
    const result = await fetchAllLoans({
      page: input.page,
      maxRows: input.maxRows,
    });

    return {
      status: "real",
      source: "sdk",
      page: result.page,
      maxRows: result.maxRows,
      totalLoans: result.totalLoans,
      loans: result.loans,
      message: `Found ${result.loans.length} loans on page ${result.page} (maxRows ${result.maxRows}, totalLoans ${result.totalLoans}).`,
    };
  } catch (error) {
    const errorCode = getErrorCode(error);
    console.error("[get_all_loans] SDK fetch failed:", errorCode);
    return {
      status: "failed",
      source: "sdk",
      errorCode,
      message: extractErrorMessage(error),
    };
  }
}
