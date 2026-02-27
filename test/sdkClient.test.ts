// ─────────────────────────────────────────────────────────────────────────────
// test/sdkClient.test.ts — SDK config validation tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fetchLoanTerms, fetchAllLoans, __resetSdkForTests, SdkClientError } from "../src/sdkClient.js";

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv(): void {
  process.env.ETH_RPC_URL = "https://sepolia.infura.io/v3/test";
  process.env.PRIVATE_KEY = "0x" + "1".repeat(64);
  process.env.SUBGRAPH_URL = "https://api.studio.thegraph.com/query/65258/diamond-hands/v0.6.23";
  process.env.GRAPH_API_KEY = "test-api-key";
  process.env.CHAIN_ID = "11155111";
  process.env.SERVICE_ENDPOINT = "https://diamond-hands-lit-ops-server-0d655e7f3988.herokuapp.com";
  process.env.BITCOIN_PROVIDER_URL = "https://dh-btc-faucet-jw-bb7756976029.herokuapp.com";
  process.env.BITCOIN_PROVIDER_NAME = "Diamond Hands";
  process.env.BITCOIN_PROVIDER_NETWORK = "regtest";
}

describe("sdkClient config validation", () => {
  beforeEach(() => {
    __resetSdkForTests();
    setRequiredEnv();
  });

  afterEach(() => {
    __resetSdkForTests();
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns deterministic code when required env var is missing", async () => {
    delete process.env.ETH_RPC_URL;

    await expect(fetchLoanTerms()).rejects.toMatchObject({
      code: "SDK_CONFIG_MISSING_ENV",
    });
  });

  it("returns deterministic code when BITCOIN_PROVIDER_URL is missing", async () => {
    delete process.env.BITCOIN_PROVIDER_URL;

    await expect(fetchLoanTerms()).rejects.toMatchObject({
      code: "SDK_CONFIG_MISSING_ENV",
    });
  });

  it("returns deterministic code for fetchAllLoans when BITCOIN_PROVIDER_URL is missing", async () => {
    delete process.env.BITCOIN_PROVIDER_URL;

    await expect(fetchAllLoans({ page: 0, maxRows: 10 })).rejects.toMatchObject({
      code: "SDK_CONFIG_MISSING_ENV",
    });
  });

  it("returns deterministic code when CHAIN_ID is invalid", async () => {
    process.env.CHAIN_ID = "not-a-number";

    await expect(fetchLoanTerms()).rejects.toMatchObject({
      code: "SDK_CONFIG_INVALID_CHAIN_ID",
    });
  });

  it("returns deterministic code for fetchAllLoans when CHAIN_ID is invalid", async () => {
    process.env.CHAIN_ID = "not-a-number";

    await expect(fetchAllLoans({ page: 0, maxRows: 10 })).rejects.toMatchObject({
      code: "SDK_CONFIG_INVALID_CHAIN_ID",
    });
  });

  it("preserves detailed init message when private key is invalid", async () => {
    process.env.PRIVATE_KEY = "not-a-private-key";

    try {
      await fetchAllLoans({ page: 0, maxRows: 10 });
      throw new Error("Expected fetchAllLoans to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SdkClientError);
      const sdkError = error as SdkClientError;
      expect(sdkError.code).toBe("SDK_INIT_FAILED");
      expect(sdkError.message).toContain("Failed to initialize SDK provider or signer:");
      expect(sdkError.message).not.toBe("Failed to initialize Diamond Hands SDK.");
    }
  });

  it("returns deterministic code when BITCOIN_PROVIDER_NETWORK is invalid", async () => {
    process.env.BITCOIN_PROVIDER_NETWORK = "invalid-network";

    await expect(fetchLoanTerms()).rejects.toMatchObject({
      code: "SDK_CONFIG_INVALID_CHAIN_ID",
    });
  });

  it("accepts faucet base URL form and proceeds past config validation", async () => {
    process.env.BITCOIN_PROVIDER_URL = "https://dh-btc-faucet-jw-bb7756976029.herokuapp.com";

    await expect(fetchLoanTerms()).rejects.not.toMatchObject({
      code: "SDK_CONFIG_MISSING_ENV",
    });
  });

  it("throws SdkClientError for config issues", async () => {
    delete process.env.SERVICE_ENDPOINT;

    try {
      await fetchLoanTerms();
      throw new Error("Expected fetchLoanTerms to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SdkClientError);
    }
  });
});
