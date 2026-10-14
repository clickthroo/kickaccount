"use client";
import { useActionState } from "react";
import { COMPONENT_LABELS } from "@/lib/labels";
import { addComponent } from "./actions";

export function AddComponentForm({ listingId, allowPurchase }: { listingId: string; allowPurchase: boolean }) {
  const [error, action, pending] = useActionState(addComponent, null);
  const kinds = Object.entries(COMPONENT_LABELS).filter(([k]) => allowPurchase || k !== "purchase");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="listingId" value={listingId} />
      <label>
        Cost type
        <select name="component" defaultValue={allowPurchase ? "purchase" : "inbound_shipping"} className="input mt-1">
          {kinds.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="w-28">
        Amount (£, per unit)
        <input name="amount" inputMode="decimal" required placeholder="0.00" className="input mt-1" />
      </label>
      <label className="min-w-48 flex-1">
        Note / reference
        <input name="note" placeholder="Invoice no., carrier, C79…" className="input mt-1" />
      </label>
      <button className="btn" disabled={pending}>
        {pending ? "Adding…" : "Add cost"}
      </button>
      {error && <p className="w-full text-warn">{error}</p>}
    </form>
  );
}
