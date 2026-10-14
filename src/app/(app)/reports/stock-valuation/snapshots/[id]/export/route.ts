import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { audit, requireUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { getSnapshot } from "@/lib/data/stock";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_request: NextRequest, ctx: RouteContext<"/reports/stock-valuation/snapshots/[id]/export">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) notFound();
  const data = await getSnapshot(id);
  if (!data) notFound();
  await audit(user.id, "stock_valuation.snapshot_export", { snapshotId: id });

  const csv = toCsv(
    [
      "listing_id", "stock_code", "title", "status", "quantity", "purchase_gbp", "inbound_shipping_gbp",
      "import_duty_gbp", "other_gbp", "unit_cost_gbp", "value_at_cost_gbp", "list_price_gbp", "vat_treatment",
      "acquired_on",
    ],
    data.lines.map((l) => [
      l.listing_id, l.stock_code, l.title, l.status, l.quantity, l.purchase_gbp, l.shipping_gbp, l.duty_gbp,
      l.other_gbp, l.unit_cost_gbp, l.value_at_cost_gbp, l.list_price_gbp, l.vat_treatment,
      l.acquired_on ? l.acquired_on.toISOString().slice(0, 10) : null,
    ]),
  );
  const date = data.snapshot.taken_at.toISOString().slice(0, 10);
  return csvResponse(`stock-snapshot-${date}-${id.slice(0, 8)}.csv`, csv);
}
