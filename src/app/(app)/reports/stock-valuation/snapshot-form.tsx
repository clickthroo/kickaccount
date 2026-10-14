"use client";
import { useActionState, useState } from "react";
import { takeSnapshot } from "./actions";

export function SnapshotForm() {
  const [open, setOpen] = useState(false);
  const [error, action, pending] = useActionState(takeSnapshot, null);
  const defaultLabel = `Stock at ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Take snapshot
      </button>
    );
  return (
    <form action={action} className="flex items-start gap-2">
      <div>
        <input name="label" defaultValue={defaultLabel} className="input w-56" aria-label="Snapshot label" />
        {error && <p className="mt-1 text-xs text-warn">{error}</p>}
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
