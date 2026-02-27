// ─────────────────────────────────────────────────────────────────────────────
// test/feeService.test.ts — unit tests for pure business logic
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  bpsToPercent,
  computeFeeCostUsd,
  selectTerm,
  buildMessage,
  computeLoanCost,
  DEFAULT_TERM_MONTHS,
} from "../src/feeService.js";

const TERMS = [
  { termMonths: 6, originationFeeBps: 250 },
  { termMonths: 12, originationFeeBps: 275 },
  { termMonths: 24, originationFeeBps: 350 },
];

describe("bpsToPercent", () => {
  it("300 bps → 3", () => expect(bpsToPercent(300)).toBe(3));
  it("0 bps → 0", () => expect(bpsToPercent(0)).toBe(0));
  it("250 bps → 2.5", () => expect(bpsToPercent(250)).toBe(2.5));
  it("1 bps → 0.01", () => expect(bpsToPercent(1)).toBe(0.01));
});

describe("computeFeeCostUsd", () => {
  it("$10k at 3% → $300", () => expect(computeFeeCostUsd(10_000, 3)).toBe(300));
  it("$50k at 3% → $1500", () => expect(computeFeeCostUsd(50_000, 3)).toBe(1_500));
  it("$250k at 3% → $7500", () => expect(computeFeeCostUsd(250_000, 3)).toBe(7_500));
  it("rounds to 2 dp", () => expect(computeFeeCostUsd(333, 3)).toBe(9.99));
});

describe("selectTerm", () => {
  it("exact match 12", () => expect(selectTerm(TERMS, 12).termMonths).toBe(12));
  it("exact match 6", () => expect(selectTerm(TERMS, 6).termMonths).toBe(6));
  it("nearest below", () => expect(selectTerm(TERMS, 3).termMonths).toBe(6));
  it("nearest above", () => expect(selectTerm(TERMS, 30).termMonths).toBe(24));
  it("throws on empty terms", () => {
    expect(() => selectTerm([], 12)).toThrow("SDK returned no loan terms.");
  });
});

describe("buildMessage", () => {
  it("no amount", () =>
    expect(buildMessage(3, 300, null, null)).toBe("New loan cost is 3% (300 bps)."));
  it("with amount", () => expect(buildMessage(3, 300, 10_000, 300)).toContain("$300.00"));
});

describe("computeLoanCost", () => {
  it("returns sdk real result with no amount", () => {
    const r = computeLoanCost(TERMS, null, 12);
    expect(r.status).toBe("real");
    expect(r.source).toBe("sdk");
    expect(r.originationFeeBps).toBe(275);
    expect(r.feeCostUsd).toBeNull();
  });

  it("returns sdk real result with amount", () => {
    const r = computeLoanCost(TERMS, 10_000, 12);
    expect(r.status).toBe("real");
    expect(r.source).toBe("sdk");
    expect(r.feeCostUsd).toBe(275);
  });

  it("throws when terms are empty", () => {
    expect(() => computeLoanCost([], 10_000, 12)).toThrow("SDK returned no loan terms.");
  });

  it("does not synthesize 300 bps unless SDK provides it", () => {
    const r = computeLoanCost([{ termMonths: 12, originationFeeBps: 275 }], 10_000, 12);
    expect(r.originationFeeBps).toBe(275);
    expect(r.feeCostUsd).toBe(275);
  });
});

describe("constants", () => {
  it("default term = 12", () => expect(DEFAULT_TERM_MONTHS).toBe(12));
});
