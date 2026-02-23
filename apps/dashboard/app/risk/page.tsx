import { dashboardApi } from "../../lib/api/client";

export default async function RiskPage() {
  const risk = await dashboardApi.getRisk();

  return (
    <section className="panel">
      <h2>Risk</h2>
      <p>Risk monitor placeholder.</p>
      <pre>{JSON.stringify(risk, null, 2)}</pre>
    </section>
  );
}
