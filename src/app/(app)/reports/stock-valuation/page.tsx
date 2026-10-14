import Link from "next/link";
import { hasRole, requireUser } from "@/lib/auth";
import { liveValuation } from "@/lib/data/stock";
import { VAT_LABELS, VAT_SHORT } from "@/lib/labels";
import { filterStock, filtersToQuery, parseStockFilters } from "@/lib/stock-filters";
import { AGE_BUCKETS, formatGbp, IN_STOCK_STATUSES, type VatTreatment } from "@/lib/stock-valuation";
import { SnapshotForm } from "./snapshot-form";

export default async function StockValuationPage({ searchParams }: PageProps<"/reports/stock-valuation">) {
  const user = await requireUser();
  const filters = parseStockFilters(await searchParams);
  const { asOf, items, totals } = await liveValuation();
  const shown = filterStock(items, filters);
  const costedPct = totals.units ? Math.round((totals.costedUnits / totals.units) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Stock valuation at cost</h1>
          <p className="text-sm text-muted">
            Kickio Direct stock on hand, live as of{" "}
            {asOf.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })}.
            Unit cost = purchase + inbound shipping + import duty + other costs. Import VAT is excluded (reclaimable).
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/reports/stock-valuation/export${filtersToQuery(filters)}`} className="btn btn-secondary">
            Export CSV
          </a>
          {hasRole(user, "accountant") && <SnapshotForm />}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Value at cost" value={formatGbp(totals.valueAtCostPence)} note={`${totals.costedUnits} costed units`} />
        <Stat label="Units in stock" value={String(totals.units)} note={`${totals.items} listings`} />
        <Stat
          label="Uncosted units"
          value={String(totals.uncostedUnits)}
          note={`${costedPct}% of units costed · list value ${formatGbp(totals.uncostedListValuePence)}`}
          warn={totals.uncostedUnits > 0}
        />
        <Stat
          label="Listed below cost"
          value={String(totals.belowCostItems)}
          note={`shortfall ${formatGbp(totals.belowCostShortfallPence)}`}
          warn={totals.belowCostItems > 0}
        />
      </section>

      {totals.uncostedUnits > 0 && (
        <p className="rounded-md bg-warn-bg p-3 text-sm text-warn">
          {totals.uncostedUnits} units have no purchase price in Kickio, so they are not in the value above. Open an
          item to add its purchase price, or{" "}
          <Link className="underline" href="/reports/stock-valuation?costed=uncosted">
            list the uncosted stock
          </Link>
          .
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Breakdown
          title="Cost make-up (costed units)"
          rows={[
            ["Purchase", formatGbp(totals.purchasePence)],
            ["Inbound shipping", formatGbp(totals.shippingPence)],
            ["Import duty", formatGbp(totals.dutyPence)],
            ["Other", formatGbp(totals.otherPence)],
            ["Total at cost", formatGbp(totals.valueAtCostPence)],
            ["Import VAT recorded (excluded)", formatGbp(totals.importVatPence)],
          ]}
        />
        <Breakdown
          title="Expected VAT treatment"
          rows={(Object.keys(VAT_LABELS) as VatTreatment[]).map((k) => [
            `${VAT_LABELS[k]} · ${totals.byVatTreatment[k].units} units`,
            formatGbp(totals.byVatTreatment[k].valueAtCostPence),
          ])}
        />
        <Breakdown
          title="Age (days since purchase)"
          rows={AGE_BUCKETS.map((b) => [
            `${b} · ${totals.byAge[b].units} units`,
            formatGbp(totals.byAge[b].valueAtCostPence),
          ])}
        />
      </section>

      <form className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="min-w-48 flex-1">
          Search
          <input name="q" defaultValue={filters.q} placeholder="Title or stock code" className="input mt-1" />
        </label>
        <label>
          Cost
          <select name="costed" defaultValue={filters.costed} className="input mt-1">
            <option value="all">All</option>
            <option value="costed">Costed</option>
            <option value="uncosted">Uncosted</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status} className="input mt-1">
            <option value="">All</option>
            {IN_STOCK_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          VAT
          <select name="vat" defaultValue={filters.vat} className="input mt-1">
            <option value="">All</option>
            {(Object.keys(VAT_SHORT) as VatTreatment[]).map((k) => (
              <option key={k} value={k}>
                {VAT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" name="below" value="1" defaultChecked={filters.belowCost} /> Below cost
        </label>
        <button className="btn">Filter</button>
        <Link href="/reports/stock-valuation" className="btn btn-secondary">
          Reset
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Purchase</th>
              <th className="px-3 py-2 text-right">Ship + duty + other</th>
              <th className="px-3 py-2 text-right">Unit cost</th>
              <th className="px-3 py-2 text-right">Value at cost</th>
              <th className="px-3 py-2 text-right">List price</th>
              <th className="px-3 py-2">VAT</th>
              <th className="px-3 py-2 text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.listingId} className="border-b border-border last:border-0">
                <td className="max-w-md px-3 py-2">
                  <Link href={`/stock/${i.listingId}`} className="hover:underline">
                    {i.title}
                  </Link>
                  <div className="text-xs text-muted">
                    {i.stockCode ?? "no stock code"}
                    {i.purchaseSource ? ` · ${i.purchaseSource}` : ""}
                    {i.purchaseFrom === "kickaccount" ? " · cost entered in KickAccount" : ""}
                  </div>
                </td>
                <td className="px-3 py-2">{i.status}</td>
                <td className="num px-3 py-2">{i.quantity}</td>
                <td className="num px-3 py-2">{formatGbp(i.purchasePence)}</td>
                <td className="num px-3 py-2">{formatGbp(i.shippingPence + i.dutyPence + i.otherPence)}</td>
                <td className="num px-3 py-2">{formatGbp(i.unitCostPence)}</td>
                <td className="num px-3 py-2 font-medium">{formatGbp(i.valueAtCostPence)}</td>
                <td className={`num px-3 py-2 ${i.belowCost ? "text-warn" : ""}`}>{formatGbp(i.listPricePence)}</td>
                <td className="px-3 py-2">{VAT_SHORT[i.vatTreatment]}</td>
                <td className="num px-3 py-2">{i.ageDays === null ? "—" : `${i.ageDays}d`}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted">
                  No stock matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Showing {shown.length} of {items.length} listings. In stock = Kickio Direct listings with status{" "}
        {IN_STOCK_STATUSES.join(", ")} and quantity above zero. VAT treatment is a guide from the purchase source and
        price: retailer purchases are standard-rated; second-hand items up to £500 fall under GAS, over £500 under the
        item-by-item margin scheme.
      </p>
    </div>
  );
}

function Stat({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="num">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
