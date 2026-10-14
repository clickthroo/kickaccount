import type { NextRequest } from "next/server";
import { audit, requireUser } from "@/lib/auth";
import { csvResponse, pounds, toCsv } from "@/lib/csv";
import { liveValuation } from "@/lib/data/stock";
import { filterStock, parseStockFilters } from "@/lib/stock-filters";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const filters = parseStockFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { asOf, items } = await liveValuation();
  const rows = filterStock(items, filters);
  await audit(user.id, "stock_valuation.export", { rows: rows.length, filters });

  const csv = toCsv(
    [
      "listing_id", "stock_code", "title", "status", "quantity", "purchase_source", "purchase_gbp",
      "purchase_from", "inbound_shipping_gbp", "import_duty_gbp", "other_gbp", "unit_cost_gbp",
      "value_at_cost_gbp", "import_vat_gbp", "list_price_gbp", "below_cost", "vat_treatment",
      "acquired_on", "age_days",
    ],
    rows.map((i) => [
      i.listingId, i.stockCode, i.title, i.status, i.quantity, i.purchaseSource, pounds(i.purchasePence),
      i.purchaseFrom, pounds(i.shippingPence), pounds(i.dutyPence), pounds(i.otherPence), pounds(i.unitCostPence),
      pounds(i.valueAtCostPence), pounds(i.importVatPence), pounds(i.listPricePence), i.belowCost ? "yes" : "no",
      i.vatTreatment, i.acquiredOn, i.ageDays,
    ]),
  );
  return csvResponse(`stock-valuation-${asOf.toISOString().slice(0, 10)}.csv`, csv);
}
