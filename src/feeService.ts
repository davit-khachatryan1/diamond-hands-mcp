// ─────────────────────────────────────────────────────────────────────────────
// src/feeService.ts — pure business logic for loan cost calculation (no I/O)
// ─────────────────────────────────────────────────────────────────────────────

import type { LoanTermData } from "./sdkClient.js";
import type { LoanCostSuccess } from "./types.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default loan term when the caller doesn't specify one. */
export const DEFAULT_TERM_MONTHS = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick the best matching term: exact → nearest. */
export function selectTerm(terms: LoanTermData[], requestedMonths: number): LoanTermData {
  if (terms.length === 0) {
    throw new Error("SDK returned no loan terms.");
  }
  const exact = terms.find((t) => t.termMonths === requestedMonths);
  if (exact) return exact;
  return terms.reduce((best, cur) =>
    Math.abs(cur.termMonths - requestedMonths) < Math.abs(best.termMonths - requestedMonths) ? cur : best
  );
}

/** 300 bps → 3 (display percent, not a fraction). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** Fee in USD, rounded to 2 decimals. */
export function computeFeeCostUsd(amount: number, feePercent: number): number {
  return Math.round(amount * (feePercent / 100) * 100) / 100;
}

/** Build the Cursor chat message. */
export function buildMessage(
  feePercent: number, feeBps: number,
  loanAmountUsd: number | null, feeCostUsd: number | null
): string {
  const base = `New loan cost is ${feePercent.toFixed(0)}% (${feeBps} bps).`;
  if (loanAmountUsd !== null && feeCostUsd !== null) {
    return `${base} For $${loanAmountUsd.toLocaleString("en-US")}, fee is $${feeCostUsd.toFixed(2)}.`;
  }
  return base;
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeLoanCost(
  terms: LoanTermData[],
  loanAmountUsd?: number | null,
  requestedTermMonths: number = DEFAULT_TERM_MONTHS
): LoanCostSuccess {
  const term = selectTerm(terms, requestedTermMonths);

  const { termMonths, originationFeeBps } = term;
  const pct = bpsToPercent(originationFeeBps);
  const amt = loanAmountUsd != null && loanAmountUsd > 0 ? loanAmountUsd : null;
  const fee = amt !== null ? computeFeeCostUsd(amt, pct) : null;
  const message = buildMessage(pct, originationFeeBps, amt, fee);

  return {
    status: "real",
    termMonths,
    originationFeeBps,
    originationFeePercent: `${pct}%`,
    loanAmountUsd: amt,
    feeCostUsd: fee,
    source: "sdk",
    formula: amt !== null
      ? `feeCostUsd = ${amt} × (${pct}% / 100) = ${fee}`
      : `feeCostUsd = loanAmountUsd × (${pct}% / 100)`,
    message,
  };
}
