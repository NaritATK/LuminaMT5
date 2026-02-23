"use client";

export default function OverviewError({ error }: { error: Error }) {
  return (
    <section className="panel">
      <h2>Overview</h2>
      <p className="notice warning">Failed to load overview data.</p>
      <pre>{error.message}</pre>
    </section>
  );
}
