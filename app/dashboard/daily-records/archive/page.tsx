"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ArchivedRecord = {
  id: number;
  transaction_no: string;
  record_date: string;
  payee: string;
  employee_name: string | null;
  receipt_no: string | null;
  location_id: number;
  destination: string;
  locations: { name: string } | { name: string }[] | null;
  daily_record_items: {
    id: number;
    description: string;
    amount: number;
    item_order: number | null;
  }[];
};

type Profile = {
  position: string;
  status: string;
};

export default function ArchivedDailyRecordsPage() {
  const [records, setRecords] = useState<ArchivedRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin =
    profile?.position?.toLowerCase() === "admin" &&
    profile?.status?.toLowerCase() === "active";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user?.email) {
        throw new Error("Please sign in to view archived records.");
      }

      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("position, status")
        .eq("email", authData.user.email)
        .maybeSingle();

      if (profileError) throw profileError;

      setProfile(userProfile);

      const { data, error: recordsError } = await supabase
        .from("daily_records")
        .select(
          "id, transaction_no, record_date, payee, employee_name, receipt_no, location_id, destination, locations(name), daily_record_items(id, description, amount, item_order)"
        )
        .eq("is_archived", true)
        .order("record_date", { ascending: false })
        .order("id", { ascending: false });

      if (recordsError) throw recordsError;

      setRecords((data ?? []) as unknown as ArchivedRecord[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load archived records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function restoreRecord(record: ArchivedRecord) {
    if (!isAdmin) {
      setError("Only active administrators can restore records.");
      return;
    }

    const confirmed = window.confirm(
      `Restore Daily Record ${record.transaction_no} for ${record.payee}?\n\nThe record will return to the active Daily Records list.`
    );

    if (!confirmed) return;

    setBusyId(record.id);
    setError("");
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch("/api/admin/daily-records", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: record.id,
          action: "restore",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to restore the record.");
      }

      setMessage(`Restored ${record.transaction_no} successfully.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore the record.");
    } finally {
      setBusyId(null);
    }
  }

  const filteredRecords = records.filter((record) => {
    const location = Array.isArray(record.locations)
      ? record.locations[0]?.name ?? ""
      : record.locations?.name ?? "";

    const text = [
      record.transaction_no,
      record.payee,
      record.employee_name ?? "",
      record.receipt_no ?? "",
      record.destination,
      location,
      record.record_date,
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase().trim());
  });

  const money = (value: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Archived Records
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              View archived Daily Records and restore them when needed.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/dashboard/daily-records"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back to Daily Records
            </a>
            <a
              href="/dashboard"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Dashboard
            </a>
          </div>
        </header>

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isAdmin && profile && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Read-only access. Only active administrators can restore records.
          </div>
        )}

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <label
            htmlFor="archive-search"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Search archived records
          </label>
          <input
            id="archive-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Transaction no., payee, employee, receipt, location..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <p className="mt-2 text-sm text-slate-500">
            {filteredRecords.length} archived record(s)
          </p>
        </section>

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <p className="p-6 text-sm text-slate-600">Loading archived records...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">
              {records.length === 0
                ? "No archived records found."
                : "No records match your search."}
            </p>
          ) : (
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Transaction No.</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payee</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Project Location</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const location = Array.isArray(record.locations)
                    ? record.locations[0]?.name ?? "—"
                    : record.locations?.name ?? "—";

                  const total = (record.daily_record_items ?? []).reduce(
                    (sum, item) => sum + Number(item.amount || 0),
                    0
                  );

                  return (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {record.transaction_no}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {record.record_date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{record.payee}</div>
                        {record.employee_name && (
                          <div className="text-xs text-slate-500">
                            {record.employee_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {record.destination.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3">{location}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {money(total)}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <button
                            type="button"
                            disabled={busyId === record.id}
                            onClick={() => void restoreRecord(record)}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyId === record.id ? "Restoring..." : "Restore"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Read only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
