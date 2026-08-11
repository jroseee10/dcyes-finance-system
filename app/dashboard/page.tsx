"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Summary = {
  total: number;
  count: number;
};

type Location = {
  id: number;
  name: string;
};

type LocationSummary = {
  id: number | string;
  name: string;

  expenses: number;
  expenseCount: number;

  liquidation: number;
  liquidationCount: number;

  telegraphic: number;
  telegraphicCount: number;

  deposits: number;
  depositCount: number;

  totalTransactions: number;
  grandTotal: number;
};

type Transaction = {
  id: number;
  date: string | null;
  type: string;
  description: string;
  amount: number;

  locationId: number | null;
  locationName: string;
};

export default function DashboardPage() {
  // =====================================================
  // MAIN TOTALS
  // =====================================================

  const [expenses, setExpenses] =
    useState<Summary>({
      total: 0,
      count: 0,
    });

  const [liquidation, setLiquidation] =
    useState<Summary>({
      total: 0,
      count: 0,
    });

  const [telegraphic, setTelegraphic] =
    useState<Summary>({
      total: 0,
      count: 0,
    });

  const [deposits, setDeposits] =
    useState<Summary>({
      total: 0,
      count: 0,
    });

  const [pending, setPending] =
    useState(0);

  // =====================================================
  // LOCATIONS
  // =====================================================

  const [
    locationSummaries,
    setLocationSummaries,
  ] = useState<LocationSummary[]>([]);

  // =====================================================
  // RECENT TRANSACTIONS
  // =====================================================

  const [
    recentTransactions,
    setRecentTransactions,
  ] = useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      // =================================================
      // LOAD LOCATIONS + FINANCIAL RECORDS
      // =================================================

      const [
        locationsResult,
        expensesResult,
        liquidationResult,
        telegraphicResult,
        depositsResult,
      ] = await Promise.all([
        supabase
          .from("locations")
          .select("id, name")
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("expenses")
          .select(
            "id, expense_date, amount, location_id"
          )
          .order("expense_date", {
            ascending: false,
          }),

        supabase
          .from("liquidations")
          .select(
            "id, liquidation_date, amount, location_id"
          )
          .order("liquidation_date", {
            ascending: false,
          }),

        supabase
          .from("telegraphic_transfers")
          .select(
            "id, transfer_date, amount, location_id"
          )
          .order("transfer_date", {
            ascending: false,
          }),

        supabase
          .from("deposit_slips")
          .select(
            "id, deposit_date, amount, location_id"
          )
          .order("deposit_date", {
            ascending: false,
          }),
      ]);

      // =================================================
      // ERRORS
      // =================================================

      const errors: string[] = [];

      if (locationsResult.error) {
        console.error(
          "Locations error:",
          locationsResult.error
        );

        errors.push(
          "Locations could not be loaded."
        );
      }

      if (expensesResult.error) {
        console.error(
          "Expenses error:",
          expensesResult.error
        );

        errors.push(
          "Monthly Expenses could not be loaded."
        );
      }

      if (liquidationResult.error) {
        console.error(
          "Liquidation error:",
          liquidationResult.error
        );

        errors.push(
          "Liquidation could not be loaded."
        );
      }

      if (telegraphicResult.error) {
        console.error(
          "Telegraphic error:",
          telegraphicResult.error
        );

        errors.push(
          "Telegraphic Transfer could not be loaded."
        );
      }

      if (depositsResult.error) {
        console.error(
          "Deposit error:",
          depositsResult.error
        );

        errors.push(
          "Deposit Slips could not be loaded."
        );
      }

      if (errors.length > 0) {
        setErrorMessage(
          errors.join(" ")
        );
      }

      // =================================================
      // DATA
      // =================================================

      const locations =
        (locationsResult.data ||
          []) as Location[];

      const expenseData =
        expensesResult.data || [];

      const liquidationData =
        liquidationResult.data || [];

      const telegraphicData =
        telegraphicResult.data || [];

      const depositData =
        depositsResult.data || [];

      // =================================================
      // OVERALL TOTALS
      // =================================================

      const expenseTotal =
        expenseData.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount || 0
            ),
          0
        );

      const liquidationTotal =
        liquidationData.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount || 0
            ),
          0
        );

      const telegraphicTotal =
        telegraphicData.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount || 0
            ),
          0
        );

      const depositTotal =
        depositData.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount || 0
            ),
          0
        );

      setExpenses({
        total: expenseTotal,
        count: expenseData.length,
      });

      setLiquidation({
        total: liquidationTotal,
        count:
          liquidationData.length,
      });

      setTelegraphic({
        total: telegraphicTotal,
        count:
          telegraphicData.length,
      });

      setDeposits({
        total: depositTotal,
        count: depositData.length,
      });

      // =================================================
      // LOCATION NAME MAP
      // =================================================

      const locationNameMap =
        new Map<number, string>();

      locations.forEach(
        (location) => {
          locationNameMap.set(
            location.id,
            location.name
          );
        }
      );

      function getLocationName(
        locationId:
          | number
          | null
      ) {
        if (
          locationId === null ||
          locationId === undefined
        ) {
          return "Unassigned";
        }

        return (
          locationNameMap.get(
            Number(locationId)
          ) || "Unknown Location"
        );
      }

      // =================================================
      // LOCATION SUMMARY
      // =================================================

      const summaries: LocationSummary[] =
        locations.map(
          (location) => {
            const locationExpenses =
              expenseData.filter(
                (item) =>
                  Number(
                    item.location_id
                  ) === location.id
              );

            const locationLiquidations =
              liquidationData.filter(
                (item) =>
                  Number(
                    item.location_id
                  ) === location.id
              );

            const locationTelegraphic =
              telegraphicData.filter(
                (item) =>
                  Number(
                    item.location_id
                  ) === location.id
              );

            const locationDeposits =
              depositData.filter(
                (item) =>
                  Number(
                    item.location_id
                  ) === location.id
              );

            const expensesTotal =
              locationExpenses.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.amount ||
                      0
                  ),
                0
              );

            const liquidationTotal =
              locationLiquidations.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.amount ||
                      0
                  ),
                0
              );

            const telegraphicTotal =
              locationTelegraphic.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.amount ||
                      0
                  ),
                0
              );

            const depositsTotal =
              locationDeposits.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.amount ||
                      0
                  ),
                0
              );

            return {
              id: location.id,

              name:
                location.name,

              expenses:
                expensesTotal,

              expenseCount:
                locationExpenses.length,

              liquidation:
                liquidationTotal,

              liquidationCount:
                locationLiquidations.length,

              telegraphic:
                telegraphicTotal,

              telegraphicCount:
                locationTelegraphic.length,

              deposits:
                depositsTotal,

              depositCount:
                locationDeposits.length,

              totalTransactions:
                locationExpenses.length +
                locationLiquidations.length +
                locationTelegraphic.length +
                locationDeposits.length,

              grandTotal:
                expensesTotal +
                liquidationTotal +
                telegraphicTotal +
                depositsTotal,
            };
          }
        );

      // =================================================
      // DETECT UNASSIGNED RECORDS
      // =================================================

      const unassignedExpenses =
        expenseData.filter(
          (item) =>
            item.location_id ===
              null ||
            item.location_id ===
              undefined
        );

      const unassignedLiquidations =
        liquidationData.filter(
          (item) =>
            item.location_id ===
              null ||
            item.location_id ===
              undefined
        );

      const unassignedTelegraphic =
        telegraphicData.filter(
          (item) =>
            item.location_id ===
              null ||
            item.location_id ===
              undefined
        );

      const unassignedDeposits =
        depositData.filter(
          (item) =>
            item.location_id ===
              null ||
            item.location_id ===
              undefined
        );

      const unassignedCount =
        unassignedExpenses.length +
        unassignedLiquidations.length +
        unassignedTelegraphic.length +
        unassignedDeposits.length;

      if (unassignedCount > 0) {
        const unassignedExpenseTotal =
          unassignedExpenses.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          );

        const unassignedLiquidationTotal =
          unassignedLiquidations.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          );

        const unassignedTelegraphicTotal =
          unassignedTelegraphic.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          );

        const unassignedDepositTotal =
          unassignedDeposits.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          );

        summaries.push({
          id: "unassigned",

          name:
            "⚠️ Unassigned Records",

          expenses:
            unassignedExpenseTotal,

          expenseCount:
            unassignedExpenses.length,

          liquidation:
            unassignedLiquidationTotal,

          liquidationCount:
            unassignedLiquidations.length,

          telegraphic:
            unassignedTelegraphicTotal,

          telegraphicCount:
            unassignedTelegraphic.length,

          deposits:
            unassignedDepositTotal,

          depositCount:
            unassignedDeposits.length,

          totalTransactions:
            unassignedCount,

          grandTotal:
            unassignedExpenseTotal +
            unassignedLiquidationTotal +
            unassignedTelegraphicTotal +
            unassignedDepositTotal,
        });
      }

      setLocationSummaries(
        summaries
      );

      // =================================================
      // PENDING
      // =================================================

      const [
        expenseStatusResult,
        liquidationStatusResult,
        telegraphicStatusResult,
        depositStatusResult,
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select("status"),

        supabase
          .from("liquidations")
          .select("status"),

        supabase
          .from(
            "telegraphic_transfers"
          )
          .select("status"),

        supabase
          .from("deposit_slips")
          .select("status"),
      ]);

      const pendingExpenses =
        (
          expenseStatusResult.data ||
          []
        ).filter(
          (item) =>
            String(
              item.status || ""
            )
              .toLowerCase()
              .trim() ===
            "pending"
        ).length;

      const pendingLiquidations =
        (
          liquidationStatusResult.data ||
          []
        ).filter(
          (item) =>
            String(
              item.status || ""
            )
              .toLowerCase()
              .trim() ===
            "pending"
        ).length;

      const pendingTelegraphic =
        (
          telegraphicStatusResult.data ||
          []
        ).filter(
          (item) =>
            String(
              item.status || ""
            )
              .toLowerCase()
              .trim() ===
            "pending"
        ).length;

      const pendingDeposits =
        (
          depositStatusResult.data ||
          []
        ).filter(
          (item) =>
            String(
              item.status || ""
            )
              .toLowerCase()
              .trim() ===
            "pending"
        ).length;

      setPending(
        pendingExpenses +
          pendingLiquidations +
          pendingTelegraphic +
          pendingDeposits
      );

      // =================================================
      // RECENT TRANSACTIONS
      // =================================================

      const transactions: Transaction[] =
        [];

      expenseData.forEach(
        (item) => {
          transactions.push({
            id: item.id,

            date:
              item.expense_date,

            type:
              "Monthly Expense",

            description:
              "Monthly Expense",

            amount: Number(
              item.amount || 0
            ),

            locationId:
              item.location_id,

            locationName:
              getLocationName(
                item.location_id
              ),
          });
        }
      );

      liquidationData.forEach(
        (item) => {
          transactions.push({
            id: item.id,

            date:
              item.liquidation_date,

            type:
              "Liquidation",

            description:
              "Liquidation",

            amount: Number(
              item.amount || 0
            ),

            locationId:
              item.location_id,

            locationName:
              getLocationName(
                item.location_id
              ),
          });
        }
      );

      telegraphicData.forEach(
        (item) => {
          transactions.push({
            id: item.id,

            date:
              item.transfer_date,

            type:
              "Telegraphic Transfer",

            description:
              "Telegraphic Transfer",

            amount: Number(
              item.amount || 0
            ),

            locationId:
              item.location_id,

            locationName:
              getLocationName(
                item.location_id
              ),
          });
        }
      );

      depositData.forEach(
        (item) => {
          transactions.push({
            id: item.id,

            date:
              item.deposit_date,

            type:
              "Deposit Slip",

            description:
              "Deposit Slip",

            amount: Number(
              item.amount || 0
            ),

            locationId:
              item.location_id,

            locationName:
              getLocationName(
                item.location_id
              ),
          });
        }
      );

      // =================================================
      // SORT RECENT FIRST
      // =================================================

      transactions.sort(
        (a, b) => {
          const dateA =
            a.date
              ? new Date(
                  `${a.date}T00:00:00`
                ).getTime()
              : 0;

          const dateB =
            b.date
              ? new Date(
                  `${b.date}T00:00:00`
                ).getTime()
              : 0;

          return (
            dateB - dateA
          );
        }
      );

      setRecentTransactions(
        transactions.slice(
          0,
          8
        )
      );
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );

      setErrorMessage(
        "May error habang nilo-load ang Dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // =====================================================
  // FORMAT CURRENCY
  // =====================================================

  function formatCurrency(
    value: number
  ) {
    return new Intl.NumberFormat(
      "en-PH",
      {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(value);
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "-";
    }

    const parts =
      date.split("-");

    if (
      parts.length !== 3
    ) {
      return date;
    }

    const year =
      Number(parts[0]);

    const month =
      Number(parts[1]);

    const day =
      Number(parts[2]);

    return new Date(
      year,
      month - 1,
      day
    ).toLocaleDateString(
      "en-PH",
      {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // GRAND TOTALS
  // =====================================================

  const grandTotal =
    expenses.total +
    liquidation.total +
    telegraphic.total +
    deposits.total;

  const totalTransactions =
    expenses.count +
    liquidation.count +
    telegraphic.count +
    deposits.count;

  // =====================================================
  // TYPE STYLE
  // =====================================================

  function getTypeClass(
    type: string
  ) {
    if (
      type ===
      "Monthly Expense"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      type ===
      "Liquidation"
    ) {
      return "bg-purple-100 text-purple-700";
    }

    if (
      type ===
      "Telegraphic Transfer"
    ) {
      return "bg-orange-100 text-orange-700";
    }

    return "bg-green-100 text-green-700";
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50 flex">

      <Sidebar />

      <section className="flex-1 min-w-0 p-6 md:p-8 lg:p-10">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

          <div>

            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Dashboard
            </h1>

            <p className="text-gray-500 mt-2">
              Overall financial overview across all locations
            </p>

          </div>

          <button
            type="button"
            onClick={
              loadDashboard
            }
            disabled={
              loading
            }
            className="w-fit bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium transition disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "↻ Refresh"}
          </button>

        </div>

        {/* ERROR */}

        {errorMessage && (

          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            ⚠️ {errorMessage}
          </div>

        )}

        {/* =================================================
            OVERALL COMPANY SUMMARY
        ================================================= */}

        <div className="mb-3">

          <h2 className="text-xl font-bold text-slate-900">
            Overall Company Summary
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Combined totals from all locations
          </p>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* EXPENSES */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Monthly Expenses
            </p>

            <p className="text-2xl font-bold text-slate-900 mt-2">
              {loading
                ? "..."
                : formatCurrency(
                    expenses.total
                  )}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              {expenses.count} transaction
              {expenses.count !== 1
                ? "s"
                : ""}
            </p>

          </div>

          {/* LIQUIDATION */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Liquidation
            </p>

            <p className="text-2xl font-bold text-slate-900 mt-2">
              {loading
                ? "..."
                : formatCurrency(
                    liquidation.total
                  )}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              {liquidation.count} transaction
              {liquidation.count !== 1
                ? "s"
                : ""}
            </p>

          </div>

          {/* TELEGRAPHIC */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Telegraphic Transfer
            </p>

            <p className="text-2xl font-bold text-slate-900 mt-2">
              {loading
                ? "..."
                : formatCurrency(
                    telegraphic.total
                  )}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              {telegraphic.count} transaction
              {telegraphic.count !== 1
                ? "s"
                : ""}
            </p>

          </div>

          {/* DEPOSITS */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Deposit Slips
            </p>

            <p className="text-2xl font-bold text-slate-900 mt-2">
              {loading
                ? "..."
                : formatCurrency(
                    deposits.total
                  )}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              {deposits.count} transaction
              {deposits.count !== 1
                ? "s"
                : ""}
            </p>

          </div>

          {/* TOTAL TRANSACTIONS */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <p className="text-sm text-gray-500">
              Total Transactions
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {loading
                ? "..."
                : totalTransactions}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              Across all locations
            </p>

          </div>

          {/* GRAND TOTAL */}

          <div className="bg-slate-900 rounded-2xl shadow-sm p-6 text-white">

            <p className="text-sm text-slate-300">
              Overall Grand Total
            </p>

            <p className="text-3xl font-bold mt-2">
              {loading
                ? "..."
                : formatCurrency(
                    grandTotal
                  )}
            </p>

            <p className="text-xs text-slate-400 mt-2">
              Combined financial records
            </p>

          </div>

        </div>

        {/* =================================================
            LOCATION OVERVIEW
        ================================================= */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mt-8 overflow-hidden">

          <div className="px-6 py-5 border-b border-slate-200">

            <h2 className="text-xl font-bold text-slate-900">
              📍 Location Overview
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Financial totals and transactions for each location
            </p>

          </div>

          {loading ? (

            <div className="p-10 text-center text-gray-500">
              Loading locations...
            </div>

          ) : locationSummaries.length ===
            0 ? (

            <div className="p-10 text-center text-gray-500">
              No locations found.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1100px]">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      Location
                    </th>

                    <th className="text-right px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Expenses
                    </th>

                    <th className="text-right px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Liquidation
                    </th>

                    <th className="text-right px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Telegraphic
                    </th>

                    <th className="text-right px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Deposits
                    </th>

                    <th className="text-center px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Transactions
                    </th>

                    <th className="text-right px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      Grand Total
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {locationSummaries.map(
                    (location) => (

                      <tr
                        key={
                          location.id
                        }
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >

                        <td className="px-6 py-5">

                          <p className="font-semibold text-slate-900">
                            {location.name}
                          </p>

                        </td>

                        <td className="px-5 py-5 text-right">
                          {formatCurrency(
                            location.expenses
                          )}
                        </td>

                        <td className="px-5 py-5 text-right">
                          {formatCurrency(
                            location.liquidation
                          )}
                        </td>

                        <td className="px-5 py-5 text-right">
                          {formatCurrency(
                            location.telegraphic
                          )}
                        </td>

                        <td className="px-5 py-5 text-right">
                          {formatCurrency(
                            location.deposits
                          )}
                        </td>

                        <td className="px-5 py-5 text-center font-semibold">
                          {
                            location.totalTransactions
                          }
                        </td>

                        <td className="px-6 py-5 text-right font-bold text-slate-900">
                          {formatCurrency(
                            location.grandTotal
                          )}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* =================================================
            BOTTOM AREA
        ================================================= */}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">

          {/* RECENT TRANSACTIONS */}

          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="px-6 py-5 border-b">

              <h2 className="text-xl font-bold text-slate-900">
                Recent Transactions
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Latest financial transactions across all locations
              </p>

            </div>

            {loading ? (

              <div className="p-10 text-center text-gray-500">
                Loading transactions...
              </div>

            ) : recentTransactions.length ===
              0 ? (

              <div className="p-10 text-center text-gray-500">
                No transactions found.
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[850px]">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="text-left px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                        Date
                      </th>

                      <th className="text-left px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                        Location
                      </th>

                      <th className="text-left px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                        Type
                      </th>

                      <th className="text-left px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                        Description
                      </th>

                      <th className="text-right px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                        Amount
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {recentTransactions.map(
                      (
                        transaction,
                        index
                      ) => (

                        <tr
                          key={`${transaction.type}-${transaction.id}-${index}`}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >

                          <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(
                              transaction.date
                            )}
                          </td>

                          <td className="px-5 py-4">

                            <span
                              className={
                                transaction.locationName ===
                                "Unassigned"
                                  ? "inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"
                                  : "inline-flex px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                              }
                            >
                              {
                                transaction.locationName
                              }
                            </span>

                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">

                            <span
                              className={
                                "inline-flex px-3 py-1 rounded-full text-xs font-semibold " +
                                getTypeClass(
                                  transaction.type
                                )
                              }
                            >
                              {
                                transaction.type
                              }
                            </span>

                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {
                              transaction.description
                            }
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(
                              transaction.amount
                            )}
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

          {/* QUICK SUMMARY */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

            <h2 className="text-xl font-bold text-slate-900">
              Quick Summary
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Overall financial statistics
            </p>

            <div className="mt-6 space-y-4">

              <div className="rounded-xl bg-slate-50 p-5">

                <p className="text-sm text-gray-500">
                  Locations
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {loading
                    ? "..."
                    : locationSummaries.filter(
                        (item) =>
                          item.id !==
                          "unassigned"
                      ).length}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-5">

                <p className="text-sm text-gray-500">
                  Total Transactions
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {loading
                    ? "..."
                    : totalTransactions}
                </p>

              </div>

              <div className="rounded-xl bg-slate-900 p-5 text-white">

                <p className="text-sm text-slate-300">
                  Overall Grand Total
                </p>

                <p className="text-2xl font-bold mt-2">
                  {loading
                    ? "..."
                    : formatCurrency(
                        grandTotal
                      )}
                </p>

              </div>

              <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-5">

                <p className="text-sm text-yellow-700">
                  Pending
                </p>

                <p className="text-3xl font-bold text-yellow-900 mt-2">
                  {loading
                    ? "..."
                    : pending}
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}