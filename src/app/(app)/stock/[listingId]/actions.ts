"use server";
import { revalidatePath } from "next/cache";
import { audit, requireUser } from "@/lib/auth";
import { addCostComponent, listingExists, stockItemDetail, voidCostComponent } from "@/lib/data/stock";
import type { CostComponentKind } from "@/lib/stock-valuation";

const KINDS: CostComponentKind[] = ["purchase", "inbound_shipping", "import_duty", "import_vat", "other"];
const UUID = /^[0-9a-f-]{36}$/i;

export async function addComponent(_prev: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser("accountant");
  const listingId = String(form.get("listingId") ?? "");
  const component = String(form.get("component") ?? "") as CostComponentKind;
  const amount = String(form.get("amount") ?? "").trim().replace(/^£/, "");
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;

  if (!UUID.test(listingId) || !(await listingExists(listingId))) return "Unknown listing.";
  if (!KINDS.includes(component)) return "Choose a cost type.";
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount)) return "Enter an amount in pounds, e.g. 4.50.";
  if (component === "purchase") {
    const detail = await stockItemDetail(listingId);
    if (!detail) return "Unknown listing.";
    if (detail.row.cost_price_gbp !== null) return "Kickio already records a purchase price for this item.";
    if (detail.valued.purchaseFrom === "kickaccount") return "A purchase price is already entered; void it first.";
  }

  const id = await addCostComponent({ listingId, component, amountGbp: amount, note, userId: user.id });
  await audit(user.id, "stock_cost.add", { id, listingId, component, amount, note });
  revalidatePath(`/stock/${listingId}`);
  return null;
}

export async function voidComponent(form: FormData) {
  const user = await requireUser("accountant");
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || "Entered in error";
  if (!UUID.test(id)) return;
  const listingId = await voidCostComponent(id, user.id, reason);
  if (listingId) {
    await audit(user.id, "stock_cost.void", { id, listingId, reason });
    revalidatePath(`/stock/${listingId}`);
  }
}
