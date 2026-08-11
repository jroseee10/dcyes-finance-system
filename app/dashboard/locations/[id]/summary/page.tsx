"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

type Location = {
  id: number;
  name: string;
};

type SummaryData = {
  month: string;

  expensesTransactions: number;
  expenses: number;

  liquidationTransactions: number;
  liquidation: number;

  telegraphicTransactions: number;
  telegraphic: number;

  depositTransactions: number;
  deposits: number;

  transactions: number;
  grandTotal: number;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MonthlySummaryPage() {
  const params = useParams();

  const rawId = params?.id;

  const locationId = Number(
    Array.isArray(rawId)
      ? rawId[0]
      : rawId
  );

  const [location, setLocation] =
    useState<Location | null>(null);

  const [summary, setSummary] =
    useState<SummaryData[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [exporting, setExporting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

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
  // GET MONTH INDEX
  // =====================================================

  function getMonthIndex(
    dateValue: string | null | undefined
  ) {
    if (!dateValue) {
      return -1;
    }

    const parts =
      dateValue.split("-");

    if (parts.length < 2) {
      return -1;
    }

    const month =
      Number(parts[1]);

    if (
      Number.isNaN(month) ||
      month < 1 ||
      month > 12
    ) {
      return -1;
    }

    return month - 1;
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    if (
      !locationId ||
      Number.isNaN(locationId)
    ) {
      setErrorMessage(
        "Invalid location ID."
      );

      setLoading(false);

      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // =================================================
      // LOCATION
      // =================================================

      const {
        data: locationData,
        error: locationError,
      } = await supabase
        .from("locations")
        .select(
          "id, name"
        )
        .eq(
          "id",
          locationId
        )
        .maybeSingle();

      if (locationError) {
        throw new Error(
          "Hindi makuha ang location: " +
            locationError.message
        );
      }

      if (!locationData) {
        throw new Error(
          "Location not found."
        );
      }

      setLocation(
        locationData
      );

      // =================================================
      // EXPENSES
      // =================================================

      const {
        data: expenseData,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .select(
          "id, expense_date, amount, location_id"
        )
        .eq(
          "location_id",
          locationId
        );

      if (expenseError) {
        throw new Error(
          "Hindi makuha ang expenses: " +
            expenseError.message
        );
      }

      const expenseRecords =
        expenseData ?? [];

      // =================================================
      // LIQUIDATION
      // =================================================

      const {
        data: liquidationData,
        error: liquidationError,
      } = await supabase
        .from("liquidations")
        .select(
          "id, liquidation_date, amount, location_id"
        )
        .eq(
          "location_id",
          locationId
        );

      const liquidationRecords =
        liquidationError
          ? []
          : liquidationData ?? [];

      // =================================================
      // TELEGRAPHIC TRANSFER
      // =================================================

      const {
        data: telegraphicData,
        error: telegraphicError,
      } = await supabase
        .from(
          "telegraphic_transfers"
        )
        .select(
          "id, transfer_date, amount, location_id"
        )
        .eq(
          "location_id",
          locationId
        );

      const telegraphicRecords =
        telegraphicError
          ? []
          : telegraphicData ?? [];

      // =================================================
      // DEPOSIT SLIPS
      // =================================================

      const {
        data: depositData,
        error: depositError,
      } = await supabase
        .from(
          "deposit_slips"
        )
        .select(
          "id, deposit_date, amount, location_id"
        )
        .eq(
          "location_id",
          locationId
        );

      const depositRecords =
        depositError
          ? []
          : depositData ?? [];

      // =================================================
      // CREATE MONTHLY SUMMARY
      // =================================================

      const monthlySummary: SummaryData[] =
        MONTHS.map(
          (
            month,
            monthIndex
          ) => {
            // =============================================
            // EXPENSES
            // =============================================

            const monthExpenses =
              expenseRecords.filter(
                (record) =>
                  getMonthIndex(
                    record.expense_date
                  ) ===
                  monthIndex
              );

            const expensesTotal =
              monthExpenses.reduce(
                (
                  sum,
                  record
                ) =>
                  sum +
                  Number(
                    record.amount ||
                      0
                  ),
                0
              );

            // =============================================
            // LIQUIDATION
            // =============================================

            const monthLiquidations =
              liquidationRecords.filter(
                (record) =>
                  getMonthIndex(
                    record.liquidation_date
                  ) ===
                  monthIndex
              );

            const liquidationTotal =
              monthLiquidations.reduce(
                (
                  sum,
                  record
                ) =>
                  sum +
                  Number(
                    record.amount ||
                      0
                  ),
                0
              );

            // =============================================
            // TELEGRAPHIC
            // =============================================

            const monthTelegraphic =
              telegraphicRecords.filter(
                (record) =>
                  getMonthIndex(
                    record.transfer_date
                  ) ===
                  monthIndex
              );

            const telegraphicTotal =
              monthTelegraphic.reduce(
                (
                  sum,
                  record
                ) =>
                  sum +
                  Number(
                    record.amount ||
                      0
                  ),
                0
              );

            // =============================================
            // DEPOSITS
            // =============================================

            const monthDeposits =
              depositRecords.filter(
                (record) =>
                  getMonthIndex(
                    record.deposit_date
                  ) ===
                  monthIndex
              );

            const depositsTotal =
              monthDeposits.reduce(
                (
                  sum,
                  record
                ) =>
                  sum +
                  Number(
                    record.amount ||
                      0
                  ),
                0
              );

            // =============================================
            // TRANSACTIONS
            // =============================================

            const transactions =
              monthExpenses.length +
              monthLiquidations.length +
              monthTelegraphic.length +
              monthDeposits.length;

            // =============================================
            // GRAND TOTAL
            // =============================================

            const grandTotal =
              expensesTotal +
              liquidationTotal +
              telegraphicTotal +
              depositsTotal;

            return {
              month,

              expensesTransactions:
                monthExpenses.length,

              expenses:
                expensesTotal,

              liquidationTransactions:
                monthLiquidations.length,

              liquidation:
                liquidationTotal,

              telegraphicTransactions:
                monthTelegraphic.length,

              telegraphic:
                telegraphicTotal,

              depositTransactions:
                monthDeposits.length,

              deposits:
                depositsTotal,

              transactions,

              grandTotal,
            };
          }
        );

      setSummary(
        monthlySummary
      );

      // =================================================
      // WARNINGS
      // =================================================

      const warnings: string[] =
        [];

      if (
        liquidationError
      ) {
        console.error(
          "Liquidation error:",
          liquidationError
        );

        warnings.push(
          "Liquidation data could not be loaded."
        );
      }

      if (
        telegraphicError
      ) {
        console.error(
          "Telegraphic error:",
          telegraphicError
        );

        warnings.push(
          "Telegraphic Transfer data could not be loaded."
        );
      }

      if (
        depositError
      ) {
        console.error(
          "Deposit error:",
          depositError
        );

        warnings.push(
          "Deposit Slip data could not be loaded."
        );
      }

      if (
        warnings.length > 0
      ) {
        setErrorMessage(
          warnings.join(" ")
        );
      }
    } catch (error) {
      console.error(
        "Summary error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "May error sa pag-load ng Monthly Summary."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD PAGE
  // =====================================================

  useEffect(() => {
    if (
      locationId &&
      !Number.isNaN(
        locationId
      )
    ) {
      loadData();
    }
  }, [locationId]);

  // =====================================================
  // TOTALS
  // =====================================================

  const yearTransactions =
    useMemo(() => {
      return summary.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.transactions,
        0
      );
    }, [summary]);

  const yearExpenses =
    useMemo(() => {
      return summary.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.expenses,
        0
      );
    }, [summary]);

  const yearLiquidation =
    useMemo(() => {
      return summary.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.liquidation,
        0
      );
    }, [summary]);

  const yearTelegraphic =
    useMemo(() => {
      return summary.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.telegraphic,
        0
      );
    }, [summary]);

  const yearDeposits =
    useMemo(() => {
      return summary.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.deposits,
        0
      );
    }, [summary]);

  const grandTotal =
    useMemo(() => {
      return summary.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.grandTotal,
        0
      );
    }, [summary]);

  // =====================================================
  // EXPORT TO EXCEL
  // =====================================================

  async function exportToExcel() {
    if (!location) {
      alert(
        "Location not found."
      );

      return;
    }

    if (
      summary.length === 0
    ) {
      alert(
        "Walang summary records na ie-export."
      );

      return;
    }

    setExporting(true);

    try {
      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "DCYES Finance System";

      workbook.lastModifiedBy =
        "DCYES Finance System";

      workbook.created =
        new Date();

      workbook.modified =
        new Date();

      const worksheet =
        workbook.addWorksheet(
          "Monthly Summary"
        );

      // =================================================
      // COLUMN WIDTHS
      // =================================================

      worksheet.columns = [
        {
          header: "Month",
          key: "month",
          width: 18,
        },
        {
          header:
            "Transactions",
          key:
            "transactions",
          width: 16,
        },
        {
          header:
            "Monthly Expenses",
          key: "expenses",
          width: 20,
        },
        {
          header:
            "Liquidation",
          key:
            "liquidation",
          width: 20,
        },
        {
          header:
            "Telegraphic Transfer",
          key:
            "telegraphic",
          width: 24,
        },
        {
          header:
            "Deposit Slips",
          key: "deposits",
          width: 20,
        },
        {
          header:
            "Grand Total",
          key:
            "grandTotal",
          width: 22,
        },
      ];

      // =================================================
      // TITLE
      // =================================================

      worksheet.mergeCells(
        "A1:G1"
      );

      const titleCell =
        worksheet.getCell(
          "A1"
        );

      titleCell.value =
        `${location.name.toUpperCase()} - MONTHLY SUMMARY`;

      titleCell.font = {
        name: "Calibri",
        size: 16,
        bold: true,
        color: {
          argb:
            "FFFFFFFF",
        },
      };

      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            "1F3B64",
        },
      };

      titleCell.alignment = {
        horizontal:
          "center",
        vertical:
          "middle",
      };

      worksheet.getRow(
        1
      ).height = 32;

      // =================================================
      // SUBTITLE
      // =================================================

      worksheet.mergeCells(
        "A2:G2"
      );

      const subtitle =
        worksheet.getCell(
          "A2"
        );

      subtitle.value =
        "DCYES FINANCE SYSTEM";

      subtitle.font = {
        name: "Calibri",
        size: 11,
        italic: true,
        color: {
          argb:
            "1F3B64",
        },
      };

      subtitle.alignment = {
        horizontal:
          "center",
        vertical:
          "middle",
      };

      worksheet.getRow(
        2
      ).height = 22;

      worksheet.getRow(
        3
      ).height = 8;

      // =================================================
      // HEADER
      // =================================================

      const headerRow =
        worksheet.getRow(
          4
        );

      headerRow.values = [
        "Month",
        "Transactions",
        "Monthly Expenses",
        "Liquidation",
        "Telegraphic Transfer",
        "Deposit Slips",
        "Grand Total",
      ];

      headerRow.height =
        36;

      headerRow.eachCell(
        (cell) => {
          cell.font = {
            name:
              "Calibri",
            size: 10,
            bold: true,
            color: {
              argb:
                "FFFFFFFF",
            },
          };

          cell.fill = {
            type:
              "pattern",
            pattern:
              "solid",
            fgColor: {
              argb:
                "1F3B64",
            },
          };

          cell.alignment =
            {
              horizontal:
                "center",
              vertical:
                "middle",
              wrapText:
                true,
            };

          cell.border = {
            top: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },
            bottom: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },
            left: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },
            right: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },
          };
        }
      );

      // =================================================
      // MONTHLY DATA
      // =================================================

      summary.forEach(
        (item) => {
          const row =
            worksheet.addRow(
              [
                item.month,
                item.transactions,
                item.expenses,
                item.liquidation,
                item.telegraphic,
                item.deposits,
                item.grandTotal,
              ]
            );

          row.height = 24;

          row.eachCell(
            (
              cell,
              columnNumber
            ) => {
              cell.font = {
                name:
                  "Calibri",
                size: 10,
              };

              cell.alignment =
                {
                  vertical:
                    "middle",

                  horizontal:
                    columnNumber ===
                    1
                      ? "left"
                      : columnNumber ===
                        2
                      ? "center"
                      : "right",
                };

              cell.border = {
                top: {
                  style:
                    "thin",
                  color: {
                    argb:
                      "B7B7B7",
                  },
                },

                bottom: {
                  style:
                    "thin",
                  color: {
                    argb:
                      "B7B7B7",
                  },
                },

                left: {
                  style:
                    "thin",
                  color: {
                    argb:
                      "B7B7B7",
                  },
                },

                right: {
                  style:
                    "thin",
                  color: {
                    argb:
                      "B7B7B7",
                  },
                },
              };
            }
          );

          for (
            let i = 3;
            i <= 7;
            i++
          ) {
            row.getCell(
              i
            ).numFmt =
              "₱#,##0.00";
          }
        }
      );

      // =================================================
      // GRAND TOTAL
      // =================================================

      const totalRow =
        worksheet.addRow([
          "GRAND TOTAL",
          yearTransactions,
          yearExpenses,
          yearLiquidation,
          yearTelegraphic,
          yearDeposits,
          grandTotal,
        ]);

      totalRow.height =
        32;

      totalRow.eachCell(
        (cell) => {
          cell.font = {
            name:
              "Calibri",
            size: 11,
            bold: true,
            color: {
              argb:
                "FFFFFFFF",
            },
          };

          cell.fill = {
            type:
              "pattern",
            pattern:
              "solid",
            fgColor: {
              argb:
                "1F3B64",
            },
          };

          cell.alignment =
            {
              horizontal:
                "center",
              vertical:
                "middle",
            };

          cell.border = {
            top: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },

            bottom: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },

            left: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },

            right: {
              style:
                "thin",
              color: {
                argb:
                  "FFFFFFFF",
              },
            },
          };
        }
      );

      for (
        let i = 3;
        i <= 7;
        i++
      ) {
        totalRow.getCell(
          i
        ).numFmt =
          "₱#,##0.00";
      }

      // =================================================
      // FILTER
      // =================================================

      worksheet.autoFilter =
        {
          from: "A4",
          to: "G4",
        };

      // =================================================
      // FREEZE
      // =================================================

      worksheet.views = [
        {
          state:
            "frozen",
          ySplit: 4,
        },
      ];

      // =================================================
      // PRINT
      // =================================================

      worksheet.pageSetup =
        {
          orientation:
            "landscape",

          paperSize: 9,

          fitToPage:
            true,

          fitToWidth: 1,

          fitToHeight: 1,
        };

      worksheet.pageSetup.printTitlesRow =
        "1:4";

      // =================================================
      // DOWNLOAD
      // =================================================

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob =
        new Blob(
          [buffer],
          {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }
        );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        `${location.name.replace(
          /[^a-z0-9]/gi,
          "_"
        )}_Monthly_Summary.xlsx`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      window.URL.revokeObjectURL(
        url
      );

      alert(
        "Monthly Summary successfully exported!"
      );
    } catch (error) {
      console.error(
        "Excel export error:",
        error
      );

      alert(
        "Hindi ma-export ang Monthly Summary."
      );
    } finally {
      setExporting(false);
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <div className="flex-1">

        <section className="p-8">

          {/* HEADER */}

          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>

              <h1 className="text-3xl font-bold text-slate-900">
                Monthly Summary
              </h1>

              <p className="text-gray-500 mt-2">

                {location
                  ? `${location.name} - Consolidated Financial Summary`
                  : "Consolidated Financial Summary"}

              </p>

            </div>

            <div className="flex gap-3">

              <button
                type="button"
                onClick={
                  loadData
                }
                disabled={
                  loading
                }
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-medium"
              >
                {loading
                  ? "Loading..."
                  : "↻ Refresh"}
              </button>

              <button
                type="button"
                onClick={
                  exportToExcel
                }
                disabled={
                  exporting ||
                  loading
                }
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-lg font-medium"
              >
                {exporting
                  ? "Exporting..."
                  : "📊 Export Excel"}
              </button>

            </div>

          </div>

          {/* WARNING */}

          {errorMessage && (

            <div className="mb-6 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl p-4">

              <p className="font-semibold">
                ⚠️ Notice
              </p>

              <p className="text-sm mt-1">
                {errorMessage}
              </p>

            </div>

          )}

          {/* =================================================
              MAIN SUMMARY CARDS
          ================================================= */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

            {/* TOTAL TRANSACTIONS */}

            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-sm text-gray-500">
                Total Transactions
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-2">
                {loading
                  ? "..."
                  : yearTransactions}
              </p>

            </div>

            {/* MONTHLY EXPENSES */}

            <div className="bg-white rounded-xl shadow p-6">

              <p className="text-sm text-gray-500">
                Monthly Expenses
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-2">
                {loading
                  ? "..."
                  : formatCurrency(
                      yearExpenses
                    )}
              </p>

            </div>

            {/* GRAND TOTAL */}

            <div className="bg-[#1F3B64] rounded-xl shadow p-6 text-white">

              <p className="text-sm text-white/80">
                Grand Total
              </p>

              <p className="text-3xl font-bold mt-2">
                {loading
                  ? "..."
                  : formatCurrency(
                      grandTotal
                    )}
              </p>

            </div>

          </div>

          {/* =================================================
              BREAKDOWN
          ================================================= */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

            {/* LIQUIDATION */}

            <div className="bg-white rounded-xl shadow p-5">

              <p className="text-sm text-gray-500">
                Liquidation
              </p>

              <p className="text-xl font-bold text-slate-900 mt-2">
                {loading
                  ? "..."
                  : formatCurrency(
                      yearLiquidation
                    )}
              </p>

            </div>

            {/* TELEGRAPHIC */}

            <div className="bg-white rounded-xl shadow p-5">

              <p className="text-sm text-gray-500">
                Telegraphic Transfer
              </p>

              <p className="text-xl font-bold text-slate-900 mt-2">
                {loading
                  ? "..."
                  : formatCurrency(
                      yearTelegraphic
                    )}
              </p>

            </div>

            {/* DEPOSIT */}

            <div className="bg-white rounded-xl shadow p-5">

              <p className="text-sm text-gray-500">
                Deposit Slips
              </p>

              <p className="text-xl font-bold text-slate-900 mt-2">
                {loading
                  ? "..."
                  : formatCurrency(
                      yearDeposits
                    )}
              </p>

            </div>

          </div>

          {/* =================================================
              MONTHLY SUMMARY TABLE
          ================================================= */}

          <div className="bg-white rounded-xl shadow overflow-hidden">

            <div className="p-6 border-b">

              <h2 className="text-xl font-bold text-slate-900">
                MONTHLY SUMMARY
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Consolidated records from Monthly Expenses, Liquidation,
                Telegraphic Transfer and Deposit Slips.
              </p>

            </div>

            {loading ? (

              <div className="p-10 text-center text-gray-500">
                Loading summary...
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[1200px]">

                  <thead>

                    <tr className="bg-[#1F3B64] text-white">

                      <th className="px-5 py-4 text-left text-sm font-semibold">
                        Month
                      </th>

                      <th className="px-5 py-4 text-center text-sm font-semibold">
                        Transactions
                      </th>

                      <th className="px-5 py-4 text-right text-sm font-semibold">
                        Monthly Expenses
                      </th>

                      <th className="px-5 py-4 text-right text-sm font-semibold">
                        Liquidation
                      </th>

                      <th className="px-5 py-4 text-right text-sm font-semibold">
                        Telegraphic
                      </th>

                      <th className="px-5 py-4 text-right text-sm font-semibold">
                        Deposits
                      </th>

                      <th className="px-5 py-4 text-right text-sm font-semibold">
                        Grand Total
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {summary.map(
                      (item) => (

                        <tr
                          key={
                            item.month
                          }
                          className="border-b hover:bg-slate-50 transition"
                        >

                          <td className="px-5 py-4 font-medium text-slate-800">
                            {item.month}
                          </td>

                          <td className="px-5 py-4 text-center text-gray-700">
                            {
                              item.transactions
                            }
                          </td>

                          <td className="px-5 py-4 text-right text-gray-700">
                            {formatCurrency(
                              item.expenses
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-gray-700">
                            {formatCurrency(
                              item.liquidation
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-gray-700">
                            {formatCurrency(
                              item.telegraphic
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-gray-700">
                            {formatCurrency(
                              item.deposits
                            )}
                          </td>

                          <td className="px-5 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(
                              item.grandTotal
                            )}
                          </td>

                        </tr>

                      )
                    )}

                    {/* GRAND TOTAL */}

                    <tr className="bg-[#1F3B64] text-white font-bold">

                      <td className="px-5 py-5">
                        GRAND TOTAL
                      </td>

                      <td className="px-5 py-5 text-center">
                        {yearTransactions}
                      </td>

                      <td className="px-5 py-5 text-right">
                        {formatCurrency(
                          yearExpenses
                        )}
                      </td>

                      <td className="px-5 py-5 text-right">
                        {formatCurrency(
                          yearLiquidation
                        )}
                      </td>

                      <td className="px-5 py-5 text-right">
                        {formatCurrency(
                          yearTelegraphic
                        )}
                      </td>

                      <td className="px-5 py-5 text-right">
                        {formatCurrency(
                          yearDeposits
                        )}
                      </td>

                      <td className="px-5 py-5 text-right">
                        {formatCurrency(
                          grandTotal
                        )}
                      </td>

                    </tr>

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