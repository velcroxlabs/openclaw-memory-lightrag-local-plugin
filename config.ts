export type CaptureMode = "all" | "everything";

export type LightragConfig = {
  baseUrl: string;
  apiKey: string;
  autoIngest: boolean;
  autoRecall: boolean;
  maxRecallResults: number;
  captureMode: CaptureMode;
  minCaptureLength: number;
  debug: boolean;
};

const ALLOWED_KEYS = [
  "baseUrl",
  "apiKey",
  "autoIngest",
  "autoRecall",
  "maxRecallResults",
  "captureMode",
  "minCaptureLength",
  "debug",
];

function assertAllowedKeys(value: Record<string, unknown>): void {
  const unknown = Object.keys(value).filter((k) => !ALLOWED_KEYS.includes(k));
  if (unknown.length > 0) {
    throw new Error(`memory-lightrag-local config has unknown keys: ${unknown.join(", ")}`);
  }
}

function ensureNoTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function parseConfig(raw: unknown): LightragConfig {
  const cfg =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (Object.keys(cfg).length > 0) assertAllowedKeys(cfg);

  const baseUrl = typeof cfg.baseUrl === "string" ? ensureNoTrailingSlash(cfg.baseUrl.trim()) : "";
  const apiKey = typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "";

  if (!baseUrl || !apiKey) {
    throw new Error("memory-lightrag-local: baseUrl and apiKey are required");
  }

  const maxRecallResults = Number(cfg.maxRecallResults ?? 8);
  const minCaptureLength = Number(cfg.minCaptureLength ?? 10);

  return {
    baseUrl,
    apiKey,
    autoIngest: cfg.autoIngest === false ? false : true,
    autoRecall: cfg.autoRecall === false ? false : true,
    maxRecallResults: Number.isFinite(maxRecallResults)
      ? Math.max(1, Math.min(20, Math.floor(maxRecallResults)))
      : 8,
    captureMode: cfg.captureMode === "everything" ? "everything" : "all",
    minCaptureLength: Number.isFinite(minCaptureLength) ? Math.max(1, Math.floor(minCaptureLength)) : 10,
    debug: cfg.debug === true,
  };
}

export const lightragConfigSchema = { parse: parseConfig };
