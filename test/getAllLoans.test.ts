// ─────────────────────────────────────────────────────────────────────────────
// test/getAllLoans.test.ts — integration tests for get_all_loans handler
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleGetAllLoans } from "../src/tools/getAllLoans.js";

vi.mock("../src/sdkClient.js", () => ({
  fetchAllLoans: vi.fn(),
}));

import { fetchAllLoans } from "../src/sdkClient.js";
const mockFetchAllLoans = vi.mocked(fetchAllLoans);

const SDK_LOANS_RESULT = {
  source: "sdk" as const,
  page: 0,
  maxRows: 10,
  totalLoans: 2,
  loans: [
    { id: "loan-1", loan: { status: "ACTIVE" } },
    { id: "loan-2", loan: { status: "EXPIRED" } },
  ],
};

describe("handleGetAllLoans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns real SDK loans result for explicit paging", async () => {
    mockFetchAllLoans.mockResolvedValue(SDK_LOANS_RESULT);
    const r = await handleGetAllLoans({ page: 0, maxRows: 10 });

    expect(r.status).toBe("real");
    if (r.status !== "real") throw new Error("Expected real result");

    expect(r.source).toBe("sdk");
    expect(r.page).toBe(0);
    expect(r.maxRows).toBe(10);
    expect(r.totalLoans).toBe(2);
    expect(r.loans).toEqual(SDK_LOANS_RESULT.loans);
    expect(r.message).toContain("Found 2 loans on page 0");
  });

  it("uses default paging when input is empty", async () => {
    mockFetchAllLoans.mockResolvedValue(SDK_LOANS_RESULT);
    await handleGetAllLoans({});

    expect(mockFetchAllLoans).toHaveBeenCalledWith({ page: 0, maxRows: 10 });
  });

  it("rejects negative page", async () => {
    await expect(handleGetAllLoans({ page: -1 })).rejects.toThrow();
  });

  it("rejects maxRows above 50", async () => {
    await expect(handleGetAllLoans({ maxRows: 51 })).rejects.toThrow();
  });

  it("passes through typed SDK error payload", async () => {
    mockFetchAllLoans.mockRejectedValue({
      code: "SDK_NO_LOAN_DATA",
      message: "SDK returned no loan data.",
    });

    const r = await handleGetAllLoans({ page: 0, maxRows: 10 });

    expect(r).toEqual({
      status: "failed",
      source: "sdk",
      errorCode: "SDK_NO_LOAN_DATA",
      message: "SDK returned no loan data.",
    });

    expect(r).not.toHaveProperty("loans");
    expect(r).not.toHaveProperty("page");
    expect(r).not.toHaveProperty("maxRows");
    expect(r).not.toHaveProperty("totalLoans");
  });

  it("uses fallback message for unknown thrown value", async () => {
    mockFetchAllLoans.mockRejectedValue("boom");

    const r = await handleGetAllLoans({ page: 0, maxRows: 10 });

    expect(r).toEqual({
      status: "failed",
      source: "sdk",
      errorCode: "SDK_FETCH_FAILED",
      message: "Failed to fetch loans from Diamond Hands SDK.",
    });
  });
});
