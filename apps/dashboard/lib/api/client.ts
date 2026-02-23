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

const useStubData = process.env.NEXT_PUBLIC_USE_STUB_DATA !== "false";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (useStubData) return fallback;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) return fallback;

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { "content-type": "application/json" },
      cache: "no-store"
    });

    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export const dashboardApi = {
  getOverview: () =>
    fetchJson<OverviewSummary>("/dashboard/overview", {
      uptime: "0d 00:00:00",
      activeAccounts: 0,
      openPositions: 0
    }),

  getRisk: () =>
    fetchJson<RiskSummary>("/dashboard/risk", {
      maxDrawdownPct: 0,
      marginUsagePct: 0,
      alerts: []
    }),

  getCommandsAudit: () =>
    fetchJson<CommandAuditItem[]>("/dashboard/commands-audit", [
      {
        id: "stub-1",
        actor: "system",
        command: "NOOP",
        status: "accepted",
        timestamp: new Date(0).toISOString()
      }
    ])
};
