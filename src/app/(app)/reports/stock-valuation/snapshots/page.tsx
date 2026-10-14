import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSnapshots } from "@/lib/data/stock";
import { formatGbp } from "@/lib/stock-valuation";

export default async function SnapshotsPage() {
  await requireUser();
  const snapshots = await listSnapshots();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Stock valuation snapshots</h1>
        <p className="text-sm text-muted">
          Frozen copies of the valuation (e.g. at each month end). They can&apos;t be edited or deleted.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Taken</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2 text-right">Units</th>
              <th className="px-3 py-2 text-right">Uncosted</th>
              <th className="px-3 py-2 text-right">Value at cost</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/reports/stock-valuation/snapshots/${s.id}`} className="hover:underline">
                    {s.label}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {s.taken_at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })}
                </td>
                <td className="px-3 py-2">{s.taken_by_email ?? "—"}</td>
                <td className="num px-3 py-2">{s.totals.units}</td>
                <td className="num px-3 py-2">{s.totals.uncostedUnits}</td>
                <td className="num px-3 py-2 font-medium">{formatGbp(s.totals.valueAtCostPence)}</td>
              </tr>
            ))}
            {snapshots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No snapshots yet. Take one from the stock valuation report.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
