// Stock valuation at cost for Kickio's own stock.
//
// Pure functions only: the inputs are rows from Kickio's read views and from
// KickAccount's landed-cost ledger, so this file is easy to test and reuse in
// snapshots, CSV exports and later reports.
//
// Money is handled in pence (integers) and only formatted at the edges.

export const IN_STOCK_STATUSES = ["draft", "active", "pending", "reserved"] as const;

// HMRC: the Global Accounting Scheme cannot be used for an individual item
// bought for more than £500; those go through the item-by-item margin scheme.
export const GAS_ITEM_LIMIT_PENCE = 500_00;

// Purchase sources where Kickio buys new goods on a VAT invoice. Everything
// else (eBay, Vinted, private sellers) is treated as second-hand, bought
// without VAT, and so eligible for the margin schemes.
export const STANDARD_VAT_SOURCES = new Set(["retailer"]);

export type CostComponentKind =
  | "purchase"
  | "inbound_shipping"
  | "import_duty"
  | "import_vat"
  | "other";

export type KickioStockRow = {
  listing_id: string;
  title: string;
  team: string | null;
  season: string | null;
  player_name: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  stock_quantity: number | null;
  price_cents: number | null;
  currency: string | null;
  created_at: Date | string;
  deleted_at: Date | string | null;
  cost_price_gbp: string | number | null;
  purchase_date: Date | string | null;
  purchase_source: string | null;
  stock_code: string | null;
  checked_in_at: Date | string | null;
  location: string | null;
};

export type CostComponentRow = {
  listing_id: string;
  component: CostComponentKind;
  amount_gbp: string | number;
};

export type VatTreatment = "standard" | "gas" | "margin" | "unknown";

export type AgeBucket = "0-30" | "31-90" | "91-180" | "181-365" | "365+" | "unknown";
export const AGE_BUCKETS: AgeBucket[] = ["0-30", "31-90", "91-180", "181-365", "365+", "unknown"];

export type ValuedItem = {
  listingId: string;
  stockCode: string | null;
  title: string;
  status: string;
  location: string | null;
  quantity: number;
  purchasePence: number | null;
  purchaseFrom: "kickio" | "kickaccount" | null;
  purchaseSource: string | null;
  shippingPence: number;
  dutyPence: number;
  otherPence: number;
  importVatPence: number;
  unitCostPence: number | null;
  valueAtCostPence: number | null;
  listPricePence: number | null;
  belowCost: boolean;
  acquiredOn: string | null;
  ageDays: number | null;
  ageBucket: AgeBucket;
  vatTreatment: VatTreatment;
};

export type ValuationTotals = {
  items: number;
  units: number;
  costedItems: number;
  costedUnits: number;
  uncostedItems: number;
  uncostedUnits: number;
  valueAtCostPence: number;
  purchasePence: number;
  shippingPence: number;
  dutyPence: number;
  otherPence: number;
  importVatPence: number;
  uncostedListValuePence: number;
  belowCostItems: number;
  belowCostShortfallPence: number;
  byStatus: Record<string, { units: number; valueAtCostPence: number }>;
  byAge: Record<AgeBucket, { units: number; valueAtCostPence: number }>;
  byVatTreatment: Record<VatTreatment, { units: number; valueAtCostPence: number }>;
};

export function toPence(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function isInStock(row: KickioStockRow): boolean {
  return (
    row.deleted_at === null &&
    (IN_STOCK_STATUSES as readonly string[]).includes(row.status) &&
    (row.stock_quantity ?? 0) > 0
  );
}

export function vatTreatmentFor(purchasePence: number | null, source: string | null): VatTreatment {
  if (source && STANDARD_VAT_SOURCES.has(source.toLowerCase())) return "standard";
  if (purchasePence === null) return "unknown";
  return purchasePence > GAS_ITEM_LIMIT_PENCE ? "margin" : "gas";
}

export function ageBucketFor(days: number | null): AgeBucket {
  if (days === null) return "unknown";
  if (days <= 30) return "0-30";
  if (days <= 90) return "31-90";
  if (days <= 180) return "91-180";
  if (days <= 365) return "181-365";
  return "365+";
}

export function valueItem(
  row: KickioStockRow,
  components: CostComponentRow[],
  asOf: Date,
): ValuedItem {
  const sums: Record<CostComponentKind, number> = {
    purchase: 0,
    inbound_shipping: 0,
    import_duty: 0,
    import_vat: 0,
    other: 0,
  };
  let hasKickaccountPurchase = false;
  for (const c of components) {
    sums[c.component] += toPence(c.amount_gbp) ?? 0;
    if (c.component === "purchase") hasKickaccountPurchase = true;
  }

  // Kickio's own cost record wins; KickAccount only fills the gap for stock
  // bought before Kickio recorded costs.
  const kickioPurchase = toPence(row.cost_price_gbp);
  const purchasePence = kickioPurchase ?? (hasKickaccountPurchase ? sums.purchase : null);
  const purchaseFrom = kickioPurchase !== null ? "kickio" : hasKickaccountPurchase ? "kickaccount" : null;

  const quantity = Math.max(0, row.stock_quantity ?? 0);
  const unitCostPence =
    purchasePence === null
      ? null
      : purchasePence + sums.inbound_shipping + sums.import_duty + sums.other;
  const valueAtCostPence = unitCostPence === null ? null : unitCostPence * quantity;

  const listPricePence =
    row.price_cents !== null && (row.currency ?? "GBP").toUpperCase() === "GBP" && row.price_cents > 0
      ? row.price_cents
      : null;

  const acquiredOn =
    toIsoDate(row.purchase_date) ?? toIsoDate(row.checked_in_at) ?? toIsoDate(row.created_at);
  const ageDays =
    acquiredOn === null
      ? null
      : Math.max(0, Math.floor((asOf.getTime() - Date.parse(acquiredOn)) / 86_400_000));

  return {
    listingId: row.listing_id,
    stockCode: row.stock_code,
    title: row.title,
    status: row.status,
    location: row.location,
    quantity,
    purchasePence,
    purchaseFrom,
    purchaseSource: row.purchase_source,
    shippingPence: sums.inbound_shipping,
    dutyPence: sums.import_duty,
    otherPence: sums.other,
    importVatPence: sums.import_vat,
    unitCostPence,
    valueAtCostPence,
    listPricePence,
    belowCost: unitCostPence !== null && listPricePence !== null && listPricePence < unitCostPence,
    acquiredOn,
    ageDays,
    ageBucket: ageBucketFor(ageDays),
    vatTreatment: vatTreatmentFor(purchasePence, row.purchase_source),
  };
}

export function valueStock(
  rows: KickioStockRow[],
  components: CostComponentRow[],
  asOf: Date = new Date(),
): ValuedItem[] {
  const byListing = new Map<string, CostComponentRow[]>();
  for (const c of components) {
    const list = byListing.get(c.listing_id);
    if (list) list.push(c);
    else byListing.set(c.listing_id, [c]);
  }
  return rows
    .filter(isInStock)
    .map((row) => valueItem(row, byListing.get(row.listing_id) ?? [], asOf));
}

export function totalsFor(items: ValuedItem[]): ValuationTotals {
  const bucket = () => ({ units: 0, valueAtCostPence: 0 });
  const totals: ValuationTotals = {
    items: 0,
    units: 0,
    costedItems: 0,
    costedUnits: 0,
    uncostedItems: 0,
    uncostedUnits: 0,
    valueAtCostPence: 0,
    purchasePence: 0,
    shippingPence: 0,
    dutyPence: 0,
    otherPence: 0,
    importVatPence: 0,
    uncostedListValuePence: 0,
    belowCostItems: 0,
    belowCostShortfallPence: 0,
    byStatus: {},
    byAge: Object.fromEntries(AGE_BUCKETS.map((b) => [b, bucket()])) as ValuationTotals["byAge"],
    byVatTreatment: {
      standard: bucket(),
      gas: bucket(),
      margin: bucket(),
      unknown: bucket(),
    },
  };

  for (const item of items) {
    const value = item.valueAtCostPence ?? 0;
    totals.items += 1;
    totals.units += item.quantity;
    totals.importVatPence += item.importVatPence * item.quantity;

    if (item.unitCostPence === null) {
      totals.uncostedItems += 1;
      totals.uncostedUnits += item.quantity;
      totals.uncostedListValuePence += (item.listPricePence ?? 0) * item.quantity;
    } else {
      totals.costedItems += 1;
      totals.costedUnits += item.quantity;
      totals.valueAtCostPence += value;
      totals.purchasePence += (item.purchasePence ?? 0) * item.quantity;
      totals.shippingPence += item.shippingPence * item.quantity;
      totals.dutyPence += item.dutyPence * item.quantity;
      totals.otherPence += item.otherPence * item.quantity;
    }

    if (item.belowCost && item.unitCostPence !== null && item.listPricePence !== null) {
      totals.belowCostItems += 1;
      totals.belowCostShortfallPence += (item.unitCostPence - item.listPricePence) * item.quantity;
    }

    const status = (totals.byStatus[item.status] ??= bucket());
    status.units += item.quantity;
    status.valueAtCostPence += value;
    totals.byAge[item.ageBucket].units += item.quantity;
    totals.byAge[item.ageBucket].valueAtCostPence += value;
    totals.byVatTreatment[item.vatTreatment].units += item.quantity;
    totals.byVatTreatment[item.vatTreatment].valueAtCostPence += value;
  }
  return totals;
}

export function formatGbp(pence: number | null): string {
  if (pence === null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}
