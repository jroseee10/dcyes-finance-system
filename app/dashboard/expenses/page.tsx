"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type ExpenseItem = {
  id: number;
  description: string;
  qty: number;
  unit: string | null;
  price: number;
  amount: number;
};

type Expense = {
  id: number;
  expense_date: string;
  payee: string;
  category: string | null;
  branch: string | null;
  amount: number;
  vat: number;
  payment_method: string | null;
  reference_no: string | null;
  remarks: string | null;
  status: string;
  expense_items: ExpenseItem[];
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // =========================
  // LOAD EXPENSES
  // =========================

  async function loadExpenses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("expenses")
      .select(`
        id,
        expense_date,
        payee,
        category,
        branch,
        amount,
        vat,
        payment_method,
        reference_no,
        remarks,
        status,
        expense_items (
          id,
          description,
          qty,
          unit,
          price,
          amount
        )
      `)
      .order("expense_date", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading expenses:", error);

      alert(
        "Hindi makuha ang expenses: " +
          error.message
      );
    } else {
      setExpenses(
        (data || []) as Expense[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
  }, []);

  // =========================
  // SEARCH
  // =========================

  const filteredExpenses =
    expenses.filter((expense) => {
      const searchText =
        search.toLowerCase();

      const itemText =
        expense.expense_items
          ?.map(
            (item) =>
              item.description
          )
          .join(" ")
          .toLowerCase() || "";

      return (
        expense.payee
          ?.toLowerCase()
          .includes(searchText) ||

        itemText.includes(
          searchText
        ) ||

        expense.category
          ?.toLowerCase()
          .includes(searchText) ||

        expense.branch
          ?.toLowerCase()
          .includes(searchText) ||

        expense.reference_no
          ?.toLowerCase()
          .includes(searchText)
      );
    });

  // =========================
  // TOTAL
  // =========================

  const totalExpenses =
    filteredExpenses.reduce(
      (total, expense) =>
        total +
        Number(
          expense.amount || 0
        ),
      0
    );

  // =========================
  // PAGE
  // =========================

  return (
    <main className="min-h-screen bg-[#f3f6fb] flex">
      <Sidebar />

      <div className="flex-1">
        <section className="min-w-0 flex-1 p-5 md:p-8 xl:p-10">

          {/* HEADER */}

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">

            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                Monthly Expenses
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Manage and monitor all company expenses
              </p>
            </div>

            <button
              onClick={loadExpenses}
              className="bg-[#142b4a] hover:bg-[#1d3b60] text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors"
            >
              ↻ Refresh
            </button>

          </div>

          {/* SUMMARY */}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 mb-8">

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">

              <p className="text-sm font-medium text-slate-500">
                Total Records
              </p>

              <p className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-3 tabular-nums">
                {expenses.length}
              </p>

            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">

              <p className="text-sm font-medium text-slate-500">
                Total Expenses
              </p>

              <p className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-3 tabular-nums">
                ₱
                {totalExpenses.toLocaleString(
                  "en-PH",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </p>

            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">

              <p className="text-sm font-medium text-slate-500">
                Showing
              </p>

              <p className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-3 tabular-nums">
                {filteredExpenses.length}
              </p>

            </div>

          </div>

          {/* SEARCH */}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6 mb-6">

            <input
              type="text"
              placeholder="🔍 Search payee, product, category, branch, reference..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full min-h-14 border border-slate-300 rounded-lg px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#142b4a] focus:ring-2 focus:ring-[#142b4a]/15"
            />

          </div>

          {/* TABLE */}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="px-5 md:px-6 py-5 border-b border-slate-200">

              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Expense Records
              </h2>

            </div>

            {loading ? (

              <div className="p-12 text-center text-sm text-slate-500">
                Loading expenses...
              </div>

            ) : filteredExpenses.length ===
              0 ? (

              <div className="p-12 text-center text-sm text-slate-500">
                No expense records found.
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-slate-100">

                    <tr>

                      <th className="text-left px-5 py-4 text-sm font-semibold text-slate-600">
                        Date
                      </th>

                      <th className="text-left px-5 py-4 text-sm font-semibold text-slate-600">
                        Payee
                      </th>

                      <th className="text-left px-5 py-4 text-sm font-semibold text-slate-600">
                        Products
                      </th>

                      <th className="text-left px-5 py-4 text-sm font-semibold text-slate-600">
                        Category
                      </th>

                      <th className="text-left px-5 py-4 text-sm font-semibold text-slate-600">
                        Branch
                      </th>

                      <th className="text-right px-5 py-4 text-sm font-semibold text-slate-600">
                        Amount
                      </th>

                      <th className="text-center px-5 py-4 text-sm font-semibold text-slate-600">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredExpenses.map(
                      (expense) => (

                        <tr
                          key={
                            expense.id
                          }
                          className="border-t border-slate-100 hover:bg-slate-50/80 align-top transition-colors"
                        >

                          {/* DATE */}

                          <td className="px-5 py-5 whitespace-nowrap text-sm text-slate-700">

                            {new Date(
                              expense.expense_date +
                                "T00:00:00"
                            ).toLocaleDateString(
                              "en-PH",
                              {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                              }
                            )}

                          </td>

                          {/* PAYEE */}

                          <td className="px-5 py-5 font-medium text-sm text-slate-800">

                            {expense.payee}

                          </td>

                          {/* PRODUCTS */}

                          <td className="p-4">

                            {expense
                              .expense_items
                              ?.length > 0 ? (

                              <div className="space-y-2">

                                {expense.expense_items.map(
                                  (item) => (

                                    <div
                                      key={
                                        item.id
                                      }
                                      className="border-b border-slate-100 last:border-b-0 pb-2 last:pb-0"
                                    >

                                      <div className="font-medium">
                                        {
                                          item.description
                                        }
                                      </div>

                                      <div className="text-sm text-slate-500">

                                        {Number(
                                          item.qty
                                        )}{" "}

                                        {item.unit ||
                                          "unit"}{" "}

                                        × ₱
                                        {Number(
                                          item.price
                                        ).toLocaleString(
                                          "en-PH",
                                          {
                                            minimumFractionDigits: 2,
                                          }
                                        )}

                                      </div>

                                    </div>

                                  )
                                )}

                              </div>

                            ) : (

                              <span className="text-gray-400">
                                No items
                              </span>

                            )}

                          </td>

                          {/* CATEGORY */}

                          <td className="p-4">

                            {expense.category ||
                              "-"}

                          </td>

                          {/* BRANCH */}

                          <td className="p-4">

                            {expense.branch ||
                              "-"}

                          </td>

                          {/* AMOUNT */}

                          <td className="px-5 py-5 text-right font-semibold text-sm text-slate-900 whitespace-nowrap tabular-nums">

                            ₱
                            {Number(
                              expense.amount ||
                                0
                            ).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-5 text-center">

                            <span
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                                expense.status ===
                                "Paid"
                                  ? "bg-green-100 text-green-700"
                                  : expense.status ===
                                    "Reimbursed"
                                  ? "bg-blue-100 text-blue-700"
                                  : expense.status ===
                                    "Refunded"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {
                                expense.status
                              }
                            </span>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </section>
      </div>
    </main>
  );
}