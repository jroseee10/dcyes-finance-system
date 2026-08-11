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
    <main className="min-h-screen bg-slate-100 flex">
      <Sidebar />

      <div className="flex-1">
        <section className="flex-1 p-8">

          {/* HEADER */}

          <div className="flex items-center justify-between mb-8">

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Monthly Expenses
              </h1>

              <p className="text-gray-500 mt-2">
                Manage and monitor all company expenses
              </p>
            </div>

            <button
              onClick={loadExpenses}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-lg"
            >
              ↻ Refresh
            </button>

          </div>

          {/* SUMMARY */}

          <div className="grid grid-cols-3 gap-6 mb-8">

            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-gray-500 text-sm">
                Total Records
              </p>

              <p className="text-3xl font-bold mt-2">
                {expenses.length}
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-gray-500 text-sm">
                Total Expenses
              </p>

              <p className="text-3xl font-bold mt-2">
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

            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-gray-500 text-sm">
                Showing
              </p>

              <p className="text-3xl font-bold mt-2">
                {filteredExpenses.length}
              </p>

            </div>

          </div>

          {/* SEARCH */}

          <div className="bg-white rounded-xl shadow p-5 mb-6">

            <input
              type="text"
              placeholder="🔍 Search payee, product, category, branch, reference..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
            />

          </div>

          {/* TABLE */}

          <div className="bg-white rounded-xl shadow overflow-hidden">

            <div className="px-6 py-5 border-b">

              <h2 className="text-xl font-bold">
                Expense Records
              </h2>

            </div>

            {loading ? (

              <div className="p-10 text-center text-gray-500">
                Loading expenses...
              </div>

            ) : filteredExpenses.length ===
              0 ? (

              <div className="p-10 text-center text-gray-500">
                No expense records found.
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="text-left p-4 text-sm font-semibold">
                        Date
                      </th>

                      <th className="text-left p-4 text-sm font-semibold">
                        Payee
                      </th>

                      <th className="text-left p-4 text-sm font-semibold">
                        Products
                      </th>

                      <th className="text-left p-4 text-sm font-semibold">
                        Category
                      </th>

                      <th className="text-left p-4 text-sm font-semibold">
                        Branch
                      </th>

                      <th className="text-right p-4 text-sm font-semibold">
                        Amount
                      </th>

                      <th className="text-center p-4 text-sm font-semibold">
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
                          className="border-t hover:bg-slate-50 align-top"
                        >

                          {/* DATE */}

                          <td className="p-4 whitespace-nowrap">

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

                          <td className="p-4 font-medium">

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
                                      className="border-b last:border-b-0 pb-1 last:pb-0"
                                    >

                                      <div className="font-medium">
                                        {
                                          item.description
                                        }
                                      </div>

                                      <div className="text-xs text-gray-500">

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

                          <td className="p-4 text-right font-semibold whitespace-nowrap">

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

                          <td className="p-4 text-center">

                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm ${
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