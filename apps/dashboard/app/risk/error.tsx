"use client";

export default function RiskError({ error }: { error: Error }) {
  return (
    <section className="panel">
      <h2>Risk</h2>
      <p className="notice warning">Failed to load risk data.</p>
      <pre>{error.message}</pre>
    </section>
  );
}
