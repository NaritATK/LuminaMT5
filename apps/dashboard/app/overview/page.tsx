import { dashboardApi } from "../../lib/api/client";

export default async function OverviewPage() {
  const { data, meta } = await dashboardApi.getOverview();

  return (
    <section className="panel">
      <h2>Overview</h2>
      <p>Runtime summary from API.</p>
      {meta.source === "fallback" ? (
        <p className="notice warning">Showing fallback data ({meta.error ?? "api_unavailable"}).</p>
      ) : (
        <p className="notice ok">Live data loaded {meta.endpoint ? `from ${meta.endpoint}` : "from API"}.</p>
      )}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
