import { dashboardApi } from "../../lib/api/client";

export default async function RiskPage() {
  const { data, meta } = await dashboardApi.getRisk();

  return (
    <section className="panel">
      <h2>Risk</h2>
      <p>Current risk posture from API.</p>
      {meta.source === "fallback" ? (
        <p className="notice warning">Showing fallback risk data ({meta.error ?? "api_unavailable"}).</p>
      ) : (
        <p className="notice ok">Live risk data loaded {meta.endpoint ? `from ${meta.endpoint}` : "from API"}.</p>
      )}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
