"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Location = {
  id: number;
  name: string;
  description: string | null;
};

export default function LocationMenuPage() {
  const params = useParams();
  const router = useRouter();

  const locationId = Number(params.id);

  const [location, setLocation] =
    useState<Location | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadLocation() {
      if (!locationId) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("locations")
        .select("id, name, description")
        .eq("id", locationId)
        .single();

      if (error || !data) {
        console.error(error);

        alert(
          "Hindi makita ang location."
        );

        router.push(
          "/dashboard/locations"
        );

        return;
      }

      setLocation(data);

      setLoading(false);
    }

    loadLocation();
  }, [locationId, router]);

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="flex min-h-screen">

          <Sidebar />

          <section className="flex-1 p-8">

            <div className="bg-white rounded-xl shadow p-10 text-center">

              <p className="text-gray-500">
                Loading location...
              </p>

            </div>

          </section>

        </div>
      </main>
    );
  }

  // =========================
  // PAGE
  // =========================

  return (
    <main className="min-h-screen bg-slate-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <section className="flex-1 p-8">

          {/* =========================
              BACK
          ========================= */}

          <button
            onClick={() =>
              router.push(
                "/dashboard/locations"
              )
            }
            className="text-gray-500 hover:text-black mb-6"
          >
            ← Back to Locations
          </button>

          {/* =========================
              HEADER
          ========================= */}

          <div className="mb-8">

            <p className="text-sm text-gray-500">
              Location
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              📍 {location?.name}
            </h1>

            <p className="text-gray-500 mt-2">
              {location?.description ||
                "Financial Management"}
            </p>

          </div>

          {/* =========================
              SECTION TITLE
          ========================= */}

          <div className="mb-5">

            <h2 className="text-xl font-bold text-slate-900">
              Choose a Section
            </h2>

            <p className="text-gray-500 mt-1">
              Select the financial module you want
              to open.
            </p>

          </div>

          {/* =========================
              MODULES
          ========================= */}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            {/* =========================
                MONTHLY EXPENSES
            ========================= */}

            <button
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/expenses`
                )
              }
              className="bg-white rounded-xl shadow p-6 text-left hover:shadow-lg hover:-translate-y-1 transition group"
            >

              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition">
                💰
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Monthly Expenses
              </h3>

              <p className="text-gray-500 mt-2">
                Record and manage monthly expenses,
                purchased items, reimbursements,
                refunds and balances.
              </p>

              <div className="mt-5 text-blue-600 font-medium">
                Open →
              </div>

            </button>

            {/* =========================
                MONTHLY SUMMARY
            ========================= */}

            <button
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/summary`
                )
              }
              className="bg-white rounded-xl shadow p-6 text-left hover:shadow-lg hover:-translate-y-1 transition group"
            >

              <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition">
                📊
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Monthly Summary
              </h3>

              <p className="text-gray-500 mt-2">
                View monthly totals, number of
                transactions and overall expenses.
              </p>

              <div className="mt-5 text-green-600 font-medium">
                Open →
              </div>

            </button>

            {/* =========================
                LIQUIDATION
            ========================= */}

            <button
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/liquidation`
                )
              }
              className="bg-white rounded-xl shadow p-6 text-left hover:shadow-lg hover:-translate-y-1 transition group"
            >

              <div className="w-14 h-14 rounded-xl bg-yellow-100 flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition">
                📄
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Liquidation
              </h3>

              <p className="text-gray-500 mt-2">
                Record liquidation transactions,
                receipts, tax type and amounts.
              </p>

              <div className="mt-5 text-yellow-600 font-medium">
                Open →
              </div>

            </button>

            {/* =========================
                TELEGRAPHIC TRANSFER
            ========================= */}

            <button
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/telegraphic`
                )
              }
              className="bg-white rounded-xl shadow p-6 text-left hover:shadow-lg hover:-translate-y-1 transition group"
            >

              <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition">
                💸
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Telegraphic Transfer
              </h3>

              <p className="text-gray-500 mt-2">
                Manage TT applications, beneficiary
                information, bank details, charges
                and payment status.
              </p>

              <div className="mt-5 text-purple-600 font-medium">
                Open →
              </div>

            </button>

            {/* =========================
                DEPOSIT SLIPS
            ========================= */}

            <button
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/deposit-slips`
                )
              }
              className="bg-white rounded-xl shadow p-6 text-left hover:shadow-lg hover:-translate-y-1 transition group"
            >

              <div className="w-14 h-14 rounded-xl bg-cyan-100 flex items-center justify-center text-3xl mb-5 group-hover:scale-105 transition">
                🏦
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Deposit Slips
              </h3>

              <p className="text-gray-500 mt-2">
                Record deposit slips, OR numbers,
                references, payment mode and amounts.
              </p>

              <div className="mt-5 text-cyan-600 font-medium">
                Open →
              </div>

            </button>

          </div>

          {/* =========================
              QUICK INFO
          ========================= */}

          <div className="mt-8 bg-white rounded-xl shadow p-6">

            <h2 className="text-lg font-bold text-slate-900">
              📍 {location?.name}
            </h2>

            <p className="text-gray-500 mt-2">
              All financial records under this
              location are managed separately.
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}