import { dashboardApi } from "../../lib/api/client";

export default async function CommandsAuditPage() {
  const audit = await dashboardApi.getCommandsAudit();

  return (
    <section className="panel">
      <h2>Commands Audit</h2>
      <p>Recent command execution placeholder.</p>
      <pre>{JSON.stringify(audit, null, 2)}</pre>
    </section>
  );
}
