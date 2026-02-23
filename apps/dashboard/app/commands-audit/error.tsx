"use client";

export default function CommandsAuditError({ error }: { error: Error }) {
  return (
    <section className="panel">
      <h2>Commands Audit</h2>
      <p className="notice warning">Failed to load commands audit data.</p>
      <pre>{error.message}</pre>
    </section>
  );
}
