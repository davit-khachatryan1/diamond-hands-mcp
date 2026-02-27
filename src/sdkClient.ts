// ─────────────────────────────────────────────────────────────────────────────
// src/sdkClient.ts — Diamond Hands SDK initialisation and loan data fetcher
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from "ethers";
import { createRequire } from "node:module";
import type { LoanCostErrorCode } from "./types.js";

const cjsRequire = createRequire(import.meta.url);

interface SdkEnv {
  ethRpcUrl: string;
  privateKey: string;
  subgraphUrl: string;
  graphApiKey: string;
  chainId: number;
  serviceEndpoint: string;
  bitcoinProviderUrl: string;
  bitcoinProviderName: string;
  bitcoinProviderNetwork: "regtest" | "testnet" | "mainnet";
}

/** Normalised loan term — the minimum we need for fee calculations. */
export interface LoanTermData {
  termMonths: number;
  originationFeeBps: number;
}

export interface FetchResult {
  terms: LoanTermData[];
  source: "sdk";
}

export interface GetAllLoansPaging {
  page: number;
  maxRows: number;
}

export interface GetAllLoansFetchResult {
  loans: unknown[];
  page: number;
  maxRows: number;
  totalLoans: number;
  source: "sdk";
}

export class SdkClientError extends Error {
  readonly code: LoanCostErrorCode;

  constructor(code: LoanCostErrorCode, message: string) {
    super(message);
    this.name = "SdkClientError";
    this.code = code;
  }
}

// We store the SDK instance so we only initialise once across all tool calls.
let sdkInstance: any = null;

function requireEnv(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new SdkClientError(
      "SDK_CONFIG_MISSING_ENV",
      `Missing required environment variable: ${name}.`
    );
  }
  return value;
}

function parseChainId(rawChainId: string): number {
  const chainId = Number(rawChainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new SdkClientError(
      "SDK_CONFIG_INVALID_CHAIN_ID",
      "CHAIN_ID must be a positive integer."
    );
  }
  return chainId;
}

function resolveChainName(chainId: number): string {
  if (chainId === 1) return "mainnet";
  if (chainId === 11155111) return "sepolia";
  throw new SdkClientError(
    "SDK_CONFIG_INVALID_CHAIN_ID",
    "CHAIN_ID must be 1 (mainnet) or 11155111 (sepolia)."
  );
}

function normalizeBitcoinProviderUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const base = trimmed.replace(/\/+$/, "");
  if (base.endsWith("/api/esplora")) {
    return base;
  }
  return `${base}/api/esplora`;
}

function parseBitcoinProviderNetwork(rawNetwork: string | undefined): "regtest" | "testnet" | "mainnet" {
  if (!rawNetwork) return "regtest";
  const normalized = rawNetwork.trim().toLowerCase();
  if (normalized === "regtest" || normalized === "testnet" || normalized === "mainnet") {
    return normalized;
  }
  throw new SdkClientError(
    "SDK_CONFIG_INVALID_CHAIN_ID",
    "BITCOIN_PROVIDER_NETWORK must be one of: regtest, testnet, mainnet."
  );
}

function getSdkEnv(): SdkEnv {
  const bitcoinProviderUrlRaw = requireEnv("BITCOIN_PROVIDER_URL");
  return {
    ethRpcUrl: requireEnv("ETH_RPC_URL"),
    privateKey: requireEnv("PRIVATE_KEY"),
    subgraphUrl: requireEnv("SUBGRAPH_URL"),
    graphApiKey: requireEnv("GRAPH_API_KEY"),
    chainId: parseChainId(requireEnv("CHAIN_ID")),
    serviceEndpoint: requireEnv("SERVICE_ENDPOINT"),
    bitcoinProviderUrl: normalizeBitcoinProviderUrl(bitcoinProviderUrlRaw),
    bitcoinProviderName: process.env["BITCOIN_PROVIDER_NAME"]?.trim() || "Diamond Hands",
    bitcoinProviderNetwork: parseBitcoinProviderNetwork(process.env["BITCOIN_PROVIDER_NETWORK"]),
  };
}

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
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
  return fallbackMessage;
}

function toSdkClientError(
  error: unknown,
  fallbackMessage: string = "Failed to fetch loan terms from Diamond Hands SDK."
): SdkClientError {
  if (error instanceof SdkClientError) {
    return error;
  }
  return new SdkClientError(
    "SDK_FETCH_FAILED",
    extractErrorMessage(error, fallbackMessage)
  );
}

function toNonNegativeInteger(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return null;
  }
  return n;
}

function toPositiveInteger(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
}

/**
 * Reset cached SDK instance.
 * Exported only for deterministic tests.
 */
export function __resetSdkForTests(): void {
  sdkInstance = null;
}

/**
 * Initialise the Diamond Hands SDK using env vars.
 *
 * @returns The initialised SDK instance.
 */
async function initSdk(): Promise<any> {
  if (sdkInstance) return sdkInstance;

  const env = getSdkEnv();

  let provider: ethers.JsonRpcProvider;
  let signer: ethers.Wallet;
  try {
    provider = new ethers.JsonRpcProvider(env.ethRpcUrl);
    signer = new ethers.Wallet(env.privateKey, provider);
  } catch (error) {
    const causeMessage = extractErrorMessage(error, "unknown error");
    throw new SdkClientError(
      "SDK_INIT_FAILED",
      `Failed to initialize SDK provider or signer: ${causeMessage}`
    );
  }

  try {
    const dhSdk = cjsRequire("@gvnrdao/dh-sdk");

    const config = {
      mode: "service" as const,
      litNetwork: "datil" as const,
      chainId: env.chainId,
      chain: resolveChainName(env.chainId),
      serviceEndpoint: env.serviceEndpoint,
      provider,
      ethRpcUrl: env.ethRpcUrl,
      contractSigner: signer,
      signer,
      debug: false,
      skipGasEstimation: true,
      subgraphs: {
        diamondHandsUrl: env.subgraphUrl,
      },
      graphApiKey: env.graphApiKey,
      bitcoinProviders: [
        {
          url: env.bitcoinProviderUrl,
          network: env.bitcoinProviderNetwork,
          name: env.bitcoinProviderName,
        },
      ],
      bitcoinRpcUrl: env.bitcoinProviderUrl,
      validators: {
        loanCreation: 1,
        minting: 4,
        payment: 1,
        extension: 4,
      },
      validatorVersion: 1,
    };

    if (typeof dhSdk.DiamondHandsSDK === "function") {
      sdkInstance = new dhSdk.DiamondHandsSDK(config);
    } else if (typeof dhSdk.createSDK === "function") {
      sdkInstance = await dhSdk.createSDK(config);
    } else if (typeof dhSdk.default === "function") {
      sdkInstance = new dhSdk.default(config);
    } else if (typeof dhSdk.init === "function") {
      sdkInstance = await dhSdk.init(config);
    } else {
      throw new SdkClientError(
        "SDK_INIT_FAILED",
        "Failed to initialize Diamond Hands SDK."
      );
    }

    if (typeof sdkInstance.initialize === "function") {
      await sdkInstance.initialize();
    } else if (typeof sdkInstance.init === "function") {
      await sdkInstance.init();
    }

    console.error("[sdkClient] Diamond Hands SDK initialised successfully.");
    return sdkInstance;
  } catch (error) {
    if (error instanceof SdkClientError) {
      throw error;
    }
    throw new SdkClientError(
      "SDK_INIT_FAILED",
      extractErrorMessage(error, "Failed to initialize Diamond Hands SDK.")
    );
  }
}

/**
 * Fetch loan terms using the Diamond Hands SDK.
 *
 * @returns FetchResult with normalised terms and source = "sdk".
 */
export async function fetchLoanTermsViaSdk(): Promise<FetchResult> {
  try {
    const sdk = await initSdk();

    let rawTerms: any[] | null = null;

    if (typeof sdk.getLoans === "function") {
      try {
        const loans = await sdk.getLoans();
        rawTerms = Array.isArray(loans) ? loans : null;
      } catch {
        // Try next known SDK access pattern.
      }
    }

    if (!rawTerms && typeof sdk.getLoanTerms === "function") {
      try {
        rawTerms = await sdk.getLoanTerms();
      } catch {
        // Try next known SDK access pattern.
      }
    }

    if (!rawTerms && typeof sdk.getLoanConfigs === "function") {
      try {
        rawTerms = await sdk.getLoanConfigs();
      } catch {
        // Try next known SDK access pattern.
      }
    }

    if (!rawTerms && typeof sdk.query === "function") {
      try {
        const result = await sdk.query(`{ loans(first: 20) { id originationFeeBps termMonths months mintFeeBps } }`);
        rawTerms = result?.loans ?? result?.data?.loans ?? null;
      } catch {
        // Try next known SDK access pattern.
      }
    }

    if (!rawTerms && typeof sdk.getSubgraphClient === "function") {
      try {
        const subgraphClient = sdk.getSubgraphClient();
        if (typeof subgraphClient.query === "function") {
          const result = await subgraphClient.query(
            `{ loans(first: 20) { id originationFeeBps termMonths months mintFeeBps } }`
          );
          rawTerms = result?.loans ?? result?.data?.loans ?? null;
        }
      } catch {
        // Try next known SDK access pattern.
      }
    }

    if (!rawTerms && typeof sdk.getContractManager === "function") {
      try {
        const cm = sdk.getContractManager();
        if (typeof cm.getLoanTerms === "function") {
          rawTerms = await cm.getLoanTerms();
        }
      } catch {
        // No more patterns left.
      }
    }

    if (!rawTerms || rawTerms.length === 0) {
      throw new SdkClientError("SDK_NO_LOAN_DATA", "SDK returned no loan data.");
    }

    const terms: LoanTermData[] = rawTerms
      .map((raw: any) => {
        const termMonths =
          Number(raw.termMonths) || Number(raw.months) || Number(raw.term) || 0;
        const originationFeeBps =
          Number(raw.originationFeeBps) ||
          Number(raw.mintFeeBps) ||
          Number(raw.feeBps) ||
          Number(raw.originationFee) ||
          0;
        return { termMonths, originationFeeBps };
      })
      .filter((t) => t.termMonths > 0 && t.originationFeeBps >= 0);

    if (terms.length === 0) {
      throw new SdkClientError(
        "SDK_NO_VALID_TERMS",
        "SDK returned loan data but no valid terms after normalisation."
      );
    }

    return { terms, source: "sdk" };
  } catch (error) {
    throw toSdkClientError(error);
  }
}

/**
 * Fetch loan terms from SDK only.
 */
export async function fetchLoanTerms(): Promise<FetchResult> {
  try {
    return await fetchLoanTermsViaSdk();
  } catch (error) {
    throw toSdkClientError(error);
  }
}

/**
 * Fetch paginated loans using sdk.getLoansAll({ page, maxRows }).
 */
export async function fetchAllLoansViaSdk(paging: GetAllLoansPaging): Promise<GetAllLoansFetchResult> {
  try {
    const sdk = await initSdk();
    if (typeof sdk.getLoansAll !== "function") {
      throw new SdkClientError(
        "SDK_FETCH_FAILED",
        "Diamond Hands SDK does not support getLoansAll."
      );
    }

    const rawResult = await sdk.getLoansAll({
      page: paging.page,
      maxRows: paging.maxRows,
    });

    const resultObject = (typeof rawResult === "object" && rawResult !== null)
      ? (rawResult as Record<string, unknown>)
      : {};

    const loans = Array.isArray(resultObject["loans"]) ? resultObject["loans"] : [];
    const page = toNonNegativeInteger(resultObject["page"]) ?? paging.page;
    const maxRows = toPositiveInteger(resultObject["maxRows"]) ?? paging.maxRows;
    const totalLoans = toNonNegativeInteger(resultObject["totalLoans"]) ?? loans.length;

    if (loans.length === 0) {
      throw new SdkClientError("SDK_NO_LOAN_DATA", "SDK returned no loan data.");
    }

    return {
      loans,
      page,
      maxRows,
      totalLoans,
      source: "sdk",
    };
  } catch (error) {
    throw toSdkClientError(error, "Failed to fetch loans from Diamond Hands SDK.");
  }
}

/**
 * Fetch paginated loans from SDK only.
 */
export async function fetchAllLoans(paging: GetAllLoansPaging): Promise<GetAllLoansFetchResult> {
  try {
    return await fetchAllLoansViaSdk(paging);
  } catch (error) {
    throw toSdkClientError(error, "Failed to fetch loans from Diamond Hands SDK.");
  }
}
