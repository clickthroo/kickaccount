import type { VatTreatment } from "./stock-valuation";

export const VAT_LABELS: Record<VatTreatment, string> = {
  gas: "Global Accounting Scheme",
  margin: "Margin scheme (item > £500)",
  standard: "Standard-rated purchase",
  unknown: "Unknown (no cost)",
};

export const VAT_SHORT: Record<VatTreatment, string> = {
  gas: "GAS",
  margin: "Margin",
  standard: "Standard",
  unknown: "—",
};

export const COMPONENT_LABELS = {
  purchase: "Purchase price",
  inbound_shipping: "Inbound shipping",
  import_duty: "Import duty",
  import_vat: "Import VAT (not in cost)",
  other: "Other cost",
} as const;
