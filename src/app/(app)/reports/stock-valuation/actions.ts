"use server";
import { redirect } from "next/navigation";
import { audit, requireUser } from "@/lib/auth";
import { createSnapshot } from "@/lib/data/stock";

export async function takeSnapshot(_prev: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser("accountant");
  const label = String(form.get("label") ?? "").trim().slice(0, 120);
  if (!label) return "Give the snapshot a label, e.g. \"Month end Oct 2026\".";
  const snap = await createSnapshot(label, user.id);
  await audit(user.id, "stock_valuation.snapshot", { snapshotId: snap.id, label, items: snap.items });
  redirect(`/reports/stock-valuation/snapshots/${snap.id}`);
}
