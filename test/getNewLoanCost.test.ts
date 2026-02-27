// ─────────────────────────────────────────────────────────────────────────────
// test/getNewLoanCost.test.ts — integration tests for the MCP tool handler
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleGetNewLoanCost } from "../src/tools/getNewLoanCost.js";

// Mock the SDK client so no real network calls are made.
vi.mock("../src/sdkClient.js", () => ({
  fetchLoanTerms: vi.fn(),
}));

import { fetchLoanTerms } from "../src/sdkClient.js";
const mockFetch = vi.mocked(fetchLoanTerms);

const SDK_RESULT = {
  source: "sdk" as const,
  terms: [
    { termMonths: 12, originationFeeBps: 300 },
    { termMonths: 24, originationFeeBps: 350 },
  ],
};

describe("handleGetNewLoanCost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns real SDK result with no amount", async () => {
    mockFetch.mockResolvedValue(SDK_RESULT);
    const r = await handleGetNewLoanCost({});

    expect(r.status).toBe("real");
    if (r.status !== "real") throw new Error("Expected real result");

    expect(r.originationFeeBps).toBe(300);
    expect(r.originationFeePercent).toBe("3%");
    expect(r.source).toBe("sdk");
    expect(r.feeCostUsd).toBeNull();
  });

  it("computes fee for $10k", async () => {
    mockFetch.mockResolvedValue(SDK_RESULT);
    const r = await handleGetNewLoanCost({ loanAmountUsd: 10_000 });

    expect(r.status).toBe("real");
    if (r.status !== "real") throw new Error("Expected real result");

    expect(r.feeCostUsd).toBe(300);
  });

  it("selects 24-month term", async () => {
    mockFetch.mockResolvedValue(SDK_RESULT);
    const r = await handleGetNewLoanCost({ termMonths: 24 });

    expect(r.status).toBe("real");
    if (r.status !== "real") throw new Error("Expected real result");

    expect(r.termMonths).toBe(24);
    expect(r.originationFeeBps).toBe(350);
  });

  it("returns minimal failed payload when SDK fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("fail"));
    const r = await handleGetNewLoanCost({ loanAmountUsd: 10_000 });

    expect(r).toEqual({
      status: "failed",
      source: "sdk",
      errorCode: "SDK_FETCH_FAILED",
      message: "fail",
    });

    expect(r).not.toHaveProperty("originationFeeBps");
    expect(r).not.toHaveProperty("feeCostUsd");
    expect(r).not.toHaveProperty("formula");
  });

  it("passes through typed SDK config error message", async () => {
    mockFetch.mockRejectedValue({
      code: "SDK_CONFIG_MISSING_ENV",
      message: "Missing required environment variable: BITCOIN_PROVIDER_URL.",
    });
    const r = await handleGetNewLoanCost({});

    expect(r).toEqual({
      status: "failed",
      source: "sdk",
      errorCode: "SDK_CONFIG_MISSING_ENV",
      message: "Missing required environment variable: BITCOIN_PROVIDER_URL.",
    });

    expect(r).not.toHaveProperty("originationFeeBps");
    expect(r).not.toHaveProperty("feeCostUsd");
    expect(r).not.toHaveProperty("formula");
  });

  it("uses fallback error message when thrown value has no message", async () => {
    mockFetch.mockRejectedValue("boom");
    const r = await handleGetNewLoanCost({});

    expect(r).toEqual({
      status: "failed",
      source: "sdk",
      errorCode: "SDK_FETCH_FAILED",
      message: "Failed to fetch loan terms from Diamond Hands SDK.",
    });
  });

  it("rejects negative amount", async () => {
    mockFetch.mockResolvedValue(SDK_RESULT);
    await expect(handleGetNewLoanCost({ loanAmountUsd: -1 })).rejects.toThrow();
  });

  it("success result has all required fields", async () => {
    mockFetch.mockResolvedValue(SDK_RESULT);
    const r = await handleGetNewLoanCost({ loanAmountUsd: 10_000 });

    expect(r.status).toBe("real");
    if (r.status !== "real") throw new Error("Expected real result");

    for (const key of [
      "status",
      "termMonths",
      "originationFeeBps",
      "originationFeePercent",
      "loanAmountUsd",
      "feeCostUsd",
      "source",
      "formula",
      "message",
    ]) {
      expect(r).toHaveProperty(key);
    }
  });
});
