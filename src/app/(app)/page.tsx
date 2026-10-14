import Link from "next/link";
import { requireUser } from "@/lib/auth";

const REPORTS = [
  {
    title: "Stock valuation at cost",
    href: "/reports/stock-valuation",
    body: "Kickio Direct stock on hand, valued at landed cost (purchase + shipping + duty). Live, with month-end snapshots.",
  },
  { title: "Sales & gross profit", body: "Per-item margin: sale price less landed cost, fees and outbound shipping." },
  { title: "VAT: margin scheme & GAS", body: "Margin scheme items over £500, Global Accounting Scheme totals, standard-rated sales." },
  { title: "Duties & import VAT", body: "Duty and import VAT charged, absorbed or passed on, by destination country." },
  { title: "IOSS & international", body: "EU sales up to €150 by member state for the monthly IOSS return; zero-rated exports." },
  { title: "Profit & loss", body: "Built from the reports above." },
];

export default async function Dashboard() {
  await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) =>
          r.href ? (
            <Link key={r.title} href={r.href} className="card block p-4 hover:border-accent">
              <h2 className="font-medium">{r.title}</h2>
              <p className="mt-1 text-sm text-muted">{r.body}</p>
            </Link>
          ) : (
            <div key={r.title} className="card p-4 opacity-60">
              <h2 className="font-medium">
                {r.title} <span className="ml-1 text-xs font-normal text-muted">coming next</span>
              </h2>
              <p className="mt-1 text-sm text-muted">{r.body}</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
