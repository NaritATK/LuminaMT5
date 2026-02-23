import { dashboardApi } from "../../lib/api/client";

export default async function OverviewPage() {
  const summary = await dashboardApi.getOverview();

  return (
    <section className="panel">
      <h2>Overview</h2>
      <p>Status: placeholder data from API client stub.</p>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
    </section>
  );
}
