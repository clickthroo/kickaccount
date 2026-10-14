import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requireUser } from "@/lib/auth";
import { stockItemDetail } from "@/lib/data/stock";
import { COMPONENT_LABELS, VAT_LABELS } from "@/lib/labels";
import { formatGbp, toPence } from "@/lib/stock-valuation";
import { voidComponent } from "./actions";
import { AddComponentForm } from "./add-component-form";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function StockItemPage({ params }: PageProps<"/stock/[listingId]">) {
  const user = await requireUser();
  const { listingId } = await params;
  if (!UUID.test(listingId)) notFound();
  const detail = await stockItemDetail(listingId);
  if (!detail) notFound();
  const { row, valued, inStock, components } = detail;
  const canEdit = hasRole(user, "accountant");
  const allowPurchase = row.cost_price_gbp === null && valued.purchaseFrom !== "kickaccount";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports/stock-valuation" className="text-sm text-muted hover:underline">
          ← Stock valuation
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{row.title}</h1>
        <p className="text-sm text-muted">
          {row.stock_code ?? "No stock code"} · {row.status} · qty {row.stock_quantity ?? 0}
          {inStock ? "" : " · not counted as stock"}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <dl className="card space-y-1 p-4 text-sm">
          <h2 className="mb-2 font-medium">Unit cost</h2>
          <Row k={`Purchase${valued.purchaseFrom === "kickaccount" ? " (entered in KickAccount)" : " (Kickio)"}`} v={formatGbp(valued.purchasePence)} />
          <Row k="Inbound shipping" v={formatGbp(valued.shippingPence)} />
          <Row k="Import duty" v={formatGbp(valued.dutyPence)} />
          <Row k="Other" v={formatGbp(valued.otherPence)} />
          <Row k="Unit cost" v={formatGbp(valued.unitCostPence)} strong />
          <Row k="Value at cost" v={formatGbp(valued.valueAtCostPence)} strong />
          <Row k="Import VAT recorded (excluded from cost)" v={formatGbp(valued.importVatPence)} />
        </dl>
        <dl className="card space-y-1 p-4 text-sm">
          <h2 className="mb-2 font-medium">From Kickio</h2>
          <Row k="Purchase source" v={row.purchase_source ?? "—"} />
          <Row k="Purchase date" v={valued.acquiredOn ?? "—"} />
          <Row k="Checked in" v={row.checked_in_at ? new Date(row.checked_in_at).toLocaleDateString("en-GB") : "—"} />
          <Row k="Location" v={row.location ?? "—"} />
          <Row k="List price" v={formatGbp(valued.listPricePence)} />
          <Row k="Expected VAT treatment" v={VAT_LABELS[valued.vatTreatment]} />
          {valued.belowCost && <p className="pt-2 text-warn">Listed below cost.</p>}
        </dl>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">Cost ledger</h2>
        <p className="mb-3 text-sm text-muted">
          Per-unit costs recorded in KickAccount. Entries can&apos;t be edited; void a wrong entry and add it again.
        </p>
        {canEdit && <AddComponentForm listingId={listingId} allowPurchase={allowPurchase} />}
        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3 text-right">Amount</th>
              <th className="py-2 pr-3">Note</th>
              <th className="py-2 pr-3">Added</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr key={c.id} className={`border-b border-border last:border-0 ${c.voided_at ? "text-muted line-through" : ""}`}>
                <td className="py-2 pr-3">{COMPONENT_LABELS[c.component]}</td>
                <td className="num py-2 pr-3">{formatGbp(toPence(c.amount_gbp))}</td>
                <td className="py-2 pr-3">{c.note ?? ""}</td>
                <td className="py-2 pr-3">
                  {c.created_at.toLocaleDateString("en-GB")} · {c.created_by_email ?? "—"}
                </td>
                <td className="py-2 text-right no-underline">
                  {c.voided_at ? (
                    <span className="text-xs">void: {c.void_reason}</span>
                  ) : (
                    canEdit && (
                      <form action={voidComponent} className="flex justify-end gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="reason" placeholder="Reason" className="input w-32 py-1 text-xs" />
                        <button className="btn btn-secondary py-1 text-xs">Void</button>
                      </form>
                    )
                  )}
                </td>
              </tr>
            ))}
            {components.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  No costs recorded in KickAccount yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}
