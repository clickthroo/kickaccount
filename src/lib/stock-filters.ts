import type { ValuedItem } from "./stock-valuation";

export type StockFilters = {
  q: string;
  costed: "all" | "costed" | "uncosted";
  status: string;
  vat: string;
  belowCost: boolean;
};

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseStockFilters(params: Params): StockFilters {
  const costed = one(params.costed);
  return {
    q: one(params.q).trim(),
    costed: costed === "costed" || costed === "uncosted" ? costed : "all",
    status: one(params.status),
    vat: one(params.vat),
    belowCost: one(params.below) === "1",
  };
}

export function filterStock(items: ValuedItem[], f: StockFilters): ValuedItem[] {
  const q = f.q.toLowerCase();
  return items.filter(
    (i) =>
      (!q || i.title.toLowerCase().includes(q) || (i.stockCode ?? "").toLowerCase().includes(q)) &&
      (f.costed === "all" || (f.costed === "costed") === (i.unitCostPence !== null)) &&
      (!f.status || i.status === f.status) &&
      (!f.vat || i.vatTreatment === f.vat) &&
      (!f.belowCost || i.belowCost),
  );
}

export function filtersToQuery(f: StockFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.costed !== "all") p.set("costed", f.costed);
  if (f.status) p.set("status", f.status);
  if (f.vat) p.set("vat", f.vat);
  if (f.belowCost) p.set("below", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}
