
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Location = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
};

export default function LocationMenuPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = Number(params.id);

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLocation() {
      if (!Number.isSafeInteger(locationId) || locationId <= 0) {
        router.replace("/dashboard/locations");
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("locations")
        .select("id, name, description, address")
        .eq("id", locationId)
        .maybeSingle();

      if (error || !data) {
        console.error("Load location error:", error);
        alert("Hindi makita ang location.");
        router.replace("/dashboard/locations");
        return;
      }

      setLocation(data as Location);
      setLoading(false);
    }

    void loadLocation();
  }, [locationId, router]);

  const modules = [
    {
      title: "Daily Records",
      description: "View daily transactions, payees, item details, addresses and supporting receipts.",
      path: "/dashboard/daily-records",
      icon: "📋",
      color: "blue",
    },
    {
      title: "Monthly Expenses",
      description: "Record and manage monthly expenses, purchased items, reimbursements and balances.",
      path: `/dashboard/locations/${locationId}/expenses`,
      icon: "💰",
      color: "blue",
    },
    {
      title: "Monthly Summary",
      description: "View monthly totals, transaction counts and overall expenses.",
      path: `/dashboard/locations/${locationId}/summary`,
      icon: "📊",
      color: "green",
    },
    {
      title: "Liquidation",
      description: "Manage liquidation transactions, receipts and amounts.",
      path: `/dashboard/locations/${locationId}/liquidation`,
      icon: "📄",
      color: "yellow",
    },
    {
      title: "Telegraphic Transfer",
      description: "Manage transfer applications, beneficiary information and payment status.",
      path: `/dashboard/locations/${locationId}/telegraphic`,
      icon: "💸",
      color: "purple",
    },
    {
      title: "Deposit Slips",
      description: "Record deposit slips, references, payment modes and amounts.",
      path: `/dashboard/locations/${locationId}/deposit-slips`,
      icon: "🏦",
      color: "cyan",
    },
    {
      title: "Receipt / Proof Gallery",
      description: "View uploaded receipts and supporting files.",
      path: `/dashboard/receipt-gallery?location=${locationId}`,
      icon: "🧾",
      color: "orange",
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="flex min-h-screen">
          <Sidebar />
          <section className="flex-1 p-8">
            <div className="rounded-xl bg-white p-10 text-center text-gray-500 shadow">
              Loading location...
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1 p-5 md:p-8">
          <button
            onClick={() => router.push("/dashboard/locations")}
            className="mb-6 text-sm font-medium text-gray-500 hover:text-blue-700"
          >
            ← Back to Locations
          </button>

          <div className="mb-8 rounded-xl bg-white p-6 shadow-sm md:p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Project Location
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              {location?.name}
            </h1>

            <p className="mt-2 text-gray-500">
              {location?.description || "Financial Management"}
            </p>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">
                Project Address
              </p>
              <p className="mt-1 whitespace-pre-wrap text-gray-600">
                {location?.address?.trim() || "No project address set."}
              </p>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">
              Choose a Section
            </h2>
            <p className="mt-1 text-gray-500">
              Select the financial module you want to open.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <button
                key={module.title}
                onClick={() => router.push(module.path)}
                className="group rounded-xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-3xl transition group-hover:scale-105">
                  {module.icon}
                </div>

                <h3 className="text-lg font-bold text-slate-900">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {module.description}
                </p>

                <div className="mt-5 font-medium text-blue-700">
                  Open →
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">
              {location?.name}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Financial records are organized by project location.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
