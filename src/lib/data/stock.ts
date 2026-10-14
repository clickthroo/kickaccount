import "server-only";
import { accounts, kickio } from "../db";
import {
  type CostComponentKind,
  type CostComponentRow,
  IN_STOCK_STATUSES,
  type KickioStockRow,
  totalsFor,
  type ValuedItem,
  valueItem,
  valueStock,
} from "../stock-valuation";

export async function loadStockRows(): Promise<KickioStockRow[]> {
  return kickio()<KickioStockRow[]>`
    select listing_id, title, team, season, player_name, size, condition, status,
           stock_quantity, price_cents, currency, created_at, deleted_at,
           cost_price_gbp, purchase_date, purchase_source, stock_code, checked_in_at, location
    from kickaccount.house_stock_items
    where deleted_at is null
      and status in ${kickio()(IN_STOCK_STATUSES as unknown as string[])}
      and coalesce(stock_quantity, 0) > 0
    order by created_at
  `;
}

export async function loadActiveComponents(listingIds?: string[]): Promise<CostComponentRow[]> {
  const sql = accounts();
  if (listingIds) {
    if (listingIds.length === 0) return [];
    return sql<CostComponentRow[]>`
      select listing_id, component, amount_gbp from accounting.stock_cost_components
      where voided_at is null and listing_id in ${sql(listingIds)}
    `;
  }
  return sql<CostComponentRow[]>`
    select listing_id, component, amount_gbp from accounting.stock_cost_components
    where voided_at is null
  `;
}

// The live valuation: Kickio's stock right now, valued with KickAccount's
// current landed-cost ledger.
export async function liveValuation(asOf = new Date()) {
  const [rows, components] = await Promise.all([loadStockRows(), loadActiveComponents()]);
  const items = valueStock(rows, components, asOf);
  return { asOf, items, totals: totalsFor(items) };
}

export type StockItemDetail = {
  row: KickioStockRow;
  valued: ValuedItem;
  inStock: boolean;
  components: {
    id: string;
    component: CostComponentKind;
    amount_gbp: string;
    note: string | null;
    created_at: Date;
    created_by_email: string | null;
    voided_at: Date | null;
    void_reason: string | null;
  }[];
};

export async function stockItemDetail(listingId: string): Promise<StockItemDetail | null> {
  const [rows, components] = await Promise.all([
    kickio()<(KickioStockRow & { removed_reason: string | null })[]>`
      select listing_id, title, team, season, player_name, size, condition, status,
             stock_quantity, price_cents, currency, created_at, deleted_at, removed_reason,
             cost_price_gbp, purchase_date, purchase_source, stock_code, checked_in_at, location
      from kickaccount.house_stock_items where listing_id = ${listingId}
    `,
    accounts()<StockItemDetail["components"]>`
      select c.id, c.component, c.amount_gbp::text as amount_gbp, c.note, c.created_at,
             u.email as created_by_email, c.voided_at, c.void_reason
      from accounting.stock_cost_components c
      left join accounting.app_users u on u.user_id = c.created_by
      where c.listing_id = ${listingId}
      order by c.created_at
    `,
  ]);
  if (rows.length === 0) return null;
  const row = rows[0];
  const active = components
    .filter((c) => c.voided_at === null)
    .map((c) => ({ listing_id: listingId, component: c.component, amount_gbp: c.amount_gbp }));
  const inStock =
    row.deleted_at === null &&
    (IN_STOCK_STATUSES as readonly string[]).includes(row.status) &&
    (row.stock_quantity ?? 0) > 0;
  return { row, valued: valueItem(row, active, new Date()), inStock, components };
}

export async function addCostComponent(input: {
  listingId: string;
  component: CostComponentKind;
  amountGbp: string;
  note: string | null;
  userId: string;
}) {
  const [row] = await accounts()<{ id: string }[]>`
    insert into accounting.stock_cost_components (listing_id, component, amount_gbp, note, created_by)
    values (${input.listingId}, ${input.component}, ${input.amountGbp}, ${input.note}, ${input.userId})
    returning id
  `;
  return row.id;
}

export async function voidCostComponent(id: string, userId: string, reason: string) {
  const rows = await accounts()<{ listing_id: string }[]>`
    update accounting.stock_cost_components
    set voided_at = now(), voided_by = ${userId}, void_reason = ${reason}
    where id = ${id} and voided_at is null
    returning listing_id
  `;
  return rows[0]?.listing_id ?? null;
}

export async function listingExists(listingId: string): Promise<boolean> {
  const rows = await kickio()`
    select 1 from kickaccount.house_stock_items where listing_id = ${listingId}
  `;
  return rows.length > 0;
}

export async function createSnapshot(label: string, userId: string) {
  const { items, totals } = await liveValuation();
  const sql = accounts();
  return sql.begin(async (tx) => {
    const [snap] = await tx<{ id: string }[]>`
      insert into accounting.stock_valuation_snapshots (taken_by, label, totals)
      values (${userId}, ${label}, ${tx.json(totals as never)})
      returning id
    `;
    const lines = items.map((i) => ({
      snapshot_id: snap.id,
      listing_id: i.listingId,
      stock_code: i.stockCode,
      title: i.title,
      status: i.status,
      quantity: i.quantity,
      purchase_gbp: penceToDecimal(i.purchasePence),
      shipping_gbp: penceToDecimal(i.shippingPence),
      duty_gbp: penceToDecimal(i.dutyPence),
      other_gbp: penceToDecimal(i.otherPence),
      unit_cost_gbp: penceToDecimal(i.unitCostPence),
      value_at_cost_gbp: penceToDecimal(i.valueAtCostPence),
      list_price_gbp: penceToDecimal(i.listPricePence),
      vat_treatment: i.vatTreatment,
      acquired_on: i.acquiredOn,
    }));
    for (let i = 0; i < lines.length; i += 500) {
      await tx`insert into accounting.stock_valuation_snapshot_lines ${tx(lines.slice(i, i + 500))}`;
    }
    return { id: snap.id, items: items.length };
  });
}

export type SnapshotSummary = {
  id: string;
  label: string;
  taken_at: Date;
  taken_by_email: string | null;
  totals: ReturnType<typeof totalsFor>;
};

export async function listSnapshots(): Promise<SnapshotSummary[]> {
  return accounts()<SnapshotSummary[]>`
    select s.id, s.label, s.taken_at, u.email as taken_by_email, s.totals
    from accounting.stock_valuation_snapshots s
    left join accounting.app_users u on u.user_id = s.taken_by
    order by s.taken_at desc
  `;
}

export type SnapshotLine = {
  listing_id: string;
  stock_code: string | null;
  title: string;
  status: string;
  quantity: number;
  purchase_gbp: string | null;
  shipping_gbp: string;
  duty_gbp: string;
  other_gbp: string;
  unit_cost_gbp: string | null;
  value_at_cost_gbp: string | null;
  list_price_gbp: string | null;
  vat_treatment: string;
  acquired_on: Date | null;
};

export async function getSnapshot(id: string) {
  const sql = accounts();
  const [snap] = await sql<SnapshotSummary[]>`
    select s.id, s.label, s.taken_at, u.email as taken_by_email, s.totals
    from accounting.stock_valuation_snapshots s
    left join accounting.app_users u on u.user_id = s.taken_by
    where s.id = ${id}
  `;
  if (!snap) return null;
  const lines = await sql<SnapshotLine[]>`
    select listing_id, stock_code, title, status, quantity, purchase_gbp::text, shipping_gbp::text,
           duty_gbp::text, other_gbp::text, unit_cost_gbp::text, value_at_cost_gbp::text,
           list_price_gbp::text, vat_treatment, acquired_on
    from accounting.stock_valuation_snapshot_lines
    where snapshot_id = ${id}
    order by title
  `;
  return { snapshot: snap, lines };
}

function penceToDecimal(pence: number | null): string | null {
  return pence === null ? null : (pence / 100).toFixed(2);
}
