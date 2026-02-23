import { dashboardApi } from "../../lib/api/client";

export default async function CommandsAuditPage() {
  const { data, meta } = await dashboardApi.getCommandsAudit();

  return (
    <section className="panel">
      <h2>Commands Audit</h2>
      <p>Recent command execution records from API.</p>
      {meta.source === "fallback" ? (
        <p className="notice warning">Showing fallback audit data ({meta.error ?? "api_unavailable"}).</p>
      ) : (
        <p className="notice ok">Live audit data loaded {meta.endpoint ? `from ${meta.endpoint}` : "from API"}.</p>
      )}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
