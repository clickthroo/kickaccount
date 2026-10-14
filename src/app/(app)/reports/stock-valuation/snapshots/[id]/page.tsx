import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSnapshot } from "@/lib/data/stock";
import { formatGbp, toPence } from "@/lib/stock-valuation";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function SnapshotPage({ params }: PageProps<"/reports/stock-valuation/snapshots/[id]">) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getSnapshot(id);
  if (!data) notFound();
  const { snapshot, lines } = data;
  const t = snapshot.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{snapshot.label}</h1>
          <p className="text-sm text-muted">
            Taken{" "}
            {snapshot.taken_at.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" })}{" "}
            by {snapshot.taken_by_email ?? "unknown"}.
          </p>
        </div>
        <a href={`/reports/stock-valuation/snapshots/${id}/export`} className="btn btn-secondary">
          Export CSV
        </a>
      </div>
      <dl className="card grid gap-3 p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Value at cost</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatGbp(t.valueAtCostPence)}</dd>
        </div>
        <div>
          <dt className="text-muted">Units</dt>
          <dd className="text-xl font-semibold tabular-nums">{t.units}</dd>
        </div>
        <div>
          <dt className="text-muted">Uncosted units</dt>
          <dd className="text-xl font-semibold tabular-nums">{t.uncostedUnits}</dd>
        </div>
        <div>
          <dt className="text-muted">Shipping + duty in cost</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatGbp(t.shippingPence + t.dutyPence)}</dd>
        </div>
      </dl>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit cost</th>
              <th className="px-3 py-2 text-right">Value at cost</th>
              <th className="px-3 py-2">VAT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.listing_id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  {l.title}
                  <div className="text-xs text-muted">{l.stock_code ?? "no stock code"}</div>
                </td>
                <td className="px-3 py-2">{l.status}</td>
                <td className="num px-3 py-2">{l.quantity}</td>
                <td className="num px-3 py-2">{formatGbp(toPence(l.unit_cost_gbp))}</td>
                <td className="num px-3 py-2">{formatGbp(toPence(l.value_at_cost_gbp))}</td>
                <td className="px-3 py-2">{l.vat_treatment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
