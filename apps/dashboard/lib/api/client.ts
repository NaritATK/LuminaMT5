export type OverviewSummary = {
  uptime: string;
  activeAccounts: number;
  openPositions: number;
};

export type RiskSummary = {
  maxDrawdownPct: number;
  marginUsagePct: number;
  alerts: string[];
};

export type CommandAuditItem = {
  id: string;
  actor: string;
  command: string;
  status: "accepted" | "rejected" | "executed";
  timestamp: string;
};

type ApiMeta = {
  source: "api" | "fallback";
  endpoint?: string;
  error?: string;
};

export type ApiResult<T> = {
  data: T;
  meta: ApiMeta;
};

const useStubData = process.env.NEXT_PUBLIC_USE_STUB_DATA !== "false";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const apiPrefix = process.env.NEXT_PUBLIC_DASHBOARD_API_PREFIX ?? "/v1";
const apiTimeoutMs = Number(process.env.NEXT_PUBLIC_DASHBOARD_API_TIMEOUT_MS ?? "5000");

function withPrefix(path: string): string {
  return `${apiPrefix}${path}`.replace(/\/{2,}/g, "/");
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

async function fetchJson<T>(paths: string[], fallback: T): Promise<ApiResult<T>> {
  if (useStubData) {
    return {
      data: fallback,
      meta: {
        source: "fallback",
        error: "stub_data_enabled"
      }
    };
  }

  if (!apiBaseUrl) {
    return {
      data: fallback,
      meta: {
        source: "fallback",
        error: "missing_api_base_url"
      }
    };
  }

  const errors: string[] = [];

  for (const path of paths) {
    const endpoint = `${apiBaseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), apiTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        headers: { "content-type": "application/json" },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        errors.push(`${path}: http_${response.status}`);
        continue;
      }

      const payload = (await response.json()) as unknown;
      return {
        data: unwrapPayload<T>(payload),
        meta: {
          source: "api",
          endpoint: path
        }
      };
    } catch (error) {
      errors.push(`${path}: ${normalizeError(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    data: fallback,
    meta: {
      source: "fallback",
      error: errors.join("; ") || "all_endpoints_failed"
    }
  };
}

export const dashboardApi = {
  getOverview: () =>
    fetchJson<OverviewSummary>([withPrefix("/dashboard/overview"), "/dashboard/overview"], {
        uptime: "0d 00:00:00",
        activeAccounts: 0,
        openPositions: 0
      }
    ),

  getRisk: () =>
    fetchJson<RiskSummary>([withPrefix("/dashboard/risk"), "/dashboard/risk"], {
      maxDrawdownPct: 0,
      marginUsagePct: 0,
      alerts: []
    }),

  getCommandsAudit: () =>
    fetchJson<CommandAuditItem[]>(
      [withPrefix("/dashboard/commands-audit"), "/dashboard/commands-audit"],
      [
        {
          id: "stub-1",
          actor: "system",
          command: "NOOP",
          status: "accepted",
          timestamp: new Date(0).toISOString()
        }
      ]
    )
};
