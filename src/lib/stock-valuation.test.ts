import { describe, expect, it } from "vitest";
import {
  type CostComponentRow,
  type KickioStockRow,
  totalsFor,
  toPence,
  valueStock,
  vatTreatmentFor,
} from "./stock-valuation";

const asOf = new Date("2026-10-14T12:00:00Z");

function row(overrides: Partial<KickioStockRow> = {}): KickioStockRow {
  return {
    listing_id: "l1",
    title: "Shirt",
    team: null,
    season: null,
    player_name: null,
    size: "L",
    condition: "good",
    status: "active",
    stock_quantity: 1,
    price_cents: 5000,
    currency: "GBP",
    created_at: "2026-06-01T00:00:00Z",
    deleted_at: null,
    cost_price_gbp: "20.00",
    purchase_date: "2026-10-01",
    purchase_source: "ebay",
    stock_code: "KD-1",
    checked_in_at: null,
    location: null,
    ...overrides,
  };
}

describe("toPence", () => {
  it("avoids float drift on numeric strings", () => {
    expect(toPence("19.99")).toBe(1999);
    expect(toPence("0.10")).toBe(10);
    expect(toPence(null)).toBeNull();
    expect(toPence("abc")).toBeNull();
  });
});

describe("valueStock", () => {
  it("adds shipping, duty and other costs to the unit cost but not import VAT", () => {
    const components: CostComponentRow[] = [
      { listing_id: "l1", component: "inbound_shipping", amount_gbp: "3.50" },
      { listing_id: "l1", component: "import_duty", amount_gbp: "2.40" },
      { listing_id: "l1", component: "other", amount_gbp: "1.00" },
      { listing_id: "l1", component: "import_vat", amount_gbp: "5.00" },
    ];
    const [item] = valueStock([row()], components, asOf);
    expect(item.unitCostPence).toBe(2000 + 350 + 240 + 100);
    expect(item.valueAtCostPence).toBe(2690);
    expect(item.importVatPence).toBe(500);
  });

  it("multiplies unit cost by quantity", () => {
    const [item] = valueStock([row({ stock_quantity: 3 })], [], asOf);
    expect(item.valueAtCostPence).toBe(6000);
  });

  it("excludes sold, removed, deleted and zero-quantity listings", () => {
    const items = valueStock(
      [
        row({ listing_id: "a", status: "sold" }),
        row({ listing_id: "b", status: "removed" }),
        row({ listing_id: "c", deleted_at: "2026-10-01T00:00:00Z" }),
        row({ listing_id: "d", stock_quantity: 0 }),
        row({ listing_id: "e", status: "draft" }),
        row({ listing_id: "f", status: "reserved" }),
      ],
      [],
      asOf,
    );
    expect(items.map((i) => i.listingId)).toEqual(["e", "f"]);
  });

  it("leaves items uncosted when no purchase price exists anywhere", () => {
    const [item] = valueStock(
      [row({ cost_price_gbp: null })],
      [{ listing_id: "l1", component: "inbound_shipping", amount_gbp: "3.00" }],
      asOf,
    );
    expect(item.unitCostPence).toBeNull();
    expect(item.valueAtCostPence).toBeNull();
    expect(item.vatTreatment).toBe("unknown");
  });

  it("uses a KickAccount purchase price only when Kickio has none", () => {
    const comps: CostComponentRow[] = [{ listing_id: "l1", component: "purchase", amount_gbp: "15" }];
    const [fromKickio] = valueStock([row()], comps, asOf);
    expect(fromKickio.purchasePence).toBe(2000);
    expect(fromKickio.purchaseFrom).toBe("kickio");

    const [fromLedger] = valueStock([row({ cost_price_gbp: null })], comps, asOf);
    expect(fromLedger.purchasePence).toBe(1500);
    expect(fromLedger.purchaseFrom).toBe("kickaccount");
  });

  it("flags items listed below cost", () => {
    const [item] = valueStock([row({ price_cents: 1500 })], [], asOf);
    expect(item.belowCost).toBe(true);
  });

  it("ages stock from purchase date, then check-in, then listing creation", () => {
    const [a] = valueStock([row({ purchase_date: "2026-10-01" })], [], asOf);
    expect(a.ageDays).toBe(13);
    expect(a.ageBucket).toBe("0-30");
    const [b] = valueStock(
      [row({ purchase_date: null, checked_in_at: null, created_at: "2025-01-01T00:00:00Z" })],
      [],
      asOf,
    );
    expect(b.ageBucket).toBe("365+");
  });
});

describe("vatTreatmentFor", () => {
  it("puts second-hand items up to £500 in GAS and dearer ones in the margin scheme", () => {
    expect(vatTreatmentFor(50000, "ebay")).toBe("gas");
    expect(vatTreatmentFor(50001, "vinted")).toBe("margin");
  });
  it("treats retailer purchases as standard-rated", () => {
    expect(vatTreatmentFor(60000, "retailer")).toBe("standard");
  });
});

describe("totalsFor", () => {
  it("splits costed and uncosted stock", () => {
    const items = valueStock(
      [
        row({ listing_id: "a", stock_quantity: 2 }),
        row({ listing_id: "b", cost_price_gbp: null, price_cents: 4000 }),
      ],
      [{ listing_id: "a", component: "inbound_shipping", amount_gbp: "1" }],
      asOf,
    );
    const t = totalsFor(items);
    expect(t.units).toBe(3);
    expect(t.costedUnits).toBe(2);
    expect(t.uncostedUnits).toBe(1);
    expect(t.valueAtCostPence).toBe(4200);
    expect(t.purchasePence).toBe(4000);
    expect(t.shippingPence).toBe(200);
    expect(t.uncostedListValuePence).toBe(4000);
    expect(t.byVatTreatment.gas.units).toBe(2);
    expect(t.byVatTreatment.unknown.units).toBe(1);
  });
});
