import Link from "next/link";
import { hasRole, requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">
            KickAccount
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-muted">
            <Link href="/reports/stock-valuation" className="hover:text-foreground">
              Stock valuation
            </Link>
            <Link href="/reports/stock-valuation/snapshots" className="hover:text-foreground">
              Snapshots
            </Link>
            {hasRole(user, "owner") && (
              <Link href="/admin/users" className="hover:text-foreground">
                Users
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span>
              {user.email} · {user.role}
            </span>
            <form action="/auth/sign-out" method="post">
              <button className="hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
