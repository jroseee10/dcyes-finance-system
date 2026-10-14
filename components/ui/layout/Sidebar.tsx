import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white p-6">

      <h1 className="text-2xl font-bold mb-10">
        DCYES
      </h1>

      <nav className="space-y-3">

        <Link href="/dashboard" className="block p-3 rounded-lg hover:bg-slate-700">
          🏠 Dashboard
        </Link>

        <Link href="/dashboard/expenses" className="block p-3 rounded-lg hover:bg-slate-700">
          💰 Monthly Expenses
        </Link>

        <Link href="/dashboard/liquidation" className="block p-3 rounded-lg hover:bg-slate-700">
          📄 Liquidation
        </Link>

        <Link href="/dashboard/telegraphic-transfer" className="block p-3 rounded-lg hover:bg-slate-700">
          🏦 Telegraphic Transfer
        </Link>

        <Link href="/dashboard/deposit-slips" className="block p-3 rounded-lg hover:bg-slate-700">
          🧾 Deposit Slips
        </Link>

        <Link href="/dashboard/reports" className="block p-3 rounded-lg hover:bg-slate-700">
          📈 Reports
        </Link>

        <Link href="/dashboard/users" className="block p-3 rounded-lg hover:bg-slate-700">
          👥 Users
        </Link>

        <Link href="/dashboard/settings" className="block p-3 rounded-lg hover:bg-slate-700">
          ⚙️ Settings
        </Link>

      </nav>

    </aside>
  );
}