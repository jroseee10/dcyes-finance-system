
"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Item = {
  id: number;
  description: string;
  amount: number | string;
  item_order: number;
};

type RecordRow = {
  id: number;
  transaction_no: string;
  record_date: string;
  payee: string;
  employee_name: string | null;
  receipt_no: string | null;
  remarks: string | null;
  location_id: number;
  destination: string;
  locations: { name: string } | null;
  daily_record_items: Item[];
};

type Period = "daily" | "weekly" | "monthly";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);

const localDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const recordTotal = (record: RecordRow) =>
  (record.daily_record_items || []).reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

function dateRange(period: Period, date: string) {
  const selected = new Date(`${date.slice(0, 10)}T00:00:00`);
  let start = new Date(selected);
  let end = new Date(selected);

  if (period === "weekly") {
    const offset = (selected.getDay() + 6) % 7;

    start.setDate(selected.getDate() - offset);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  }

  if (period === "monthly") {
    start = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      1
    );

    end = new Date(
      selected.getFullYear(),
      selected.getMonth() + 1,
      0
    );
  }

  const format = (value: Date) =>
    `${value.getFullYear()}-${String(
      value.getMonth() + 1
    ).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

  return {
    start: format(start),
    end: format(end),
  };
}

function reportLabel(period: Period) {
  if (period === "daily") return "Daily Report";
  if (period === "weekly") return "Weekly Report";
  return "Monthly Report";
}

function destinationLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function DailyPeriodReport({
  period,
}: {
  period: Period;
}) {
  const [date, setDate] = useState(localDate);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");

  const range = useMemo(
    () => dateRange(period, date),
    [period, date]
  );

  useEffect(() => {
    let alive = true;

    async function loadReport() {
      setLoading(true);
      setError("");

      try {
        const { data, error: queryError } = await supabase
          .from("daily_records")
          .select(`
            id,
            transaction_no,
            record_date,
            payee,
            employee_name,
            receipt_no,
            remarks,
            location_id,
            destination,
            locations ( name ),
            daily_record_items (
              id,
              description,
              amount,
              item_order
            )
          `)
          .gte("record_date", range.start)
          .lte("record_date", range.end)
          .order("record_date", { ascending: true })
          .order("id", { ascending: true });

        if (queryError) throw queryError;

        if (alive) {
          setRows((data || []) as unknown as RecordRow[]);
        }
      } catch (err) {
        console.error("Report loading error:", err);

        if (alive) {
          setRows([]);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load report. Check your database connection and permissions."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadReport();

    return () => {
      alive = false;
    };
  }, [range.start, range.end]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + recordTotal(row), 0),
    [rows]
  );

  const daily = useMemo(() => {
    const result = new Map<
      string,
      { count: number; total: number }
    >();

    for (const row of rows) {
      const current = result.get(row.record_date) || {
        count: 0,
        total: 0,
      };

      current.count += 1;
      current.total += recordTotal(row);

      result.set(row.record_date, current);
    }

    return result;
  }, [rows]);

  const exportExcel = async () => {
    if (loading || rows.length === 0 || exporting) return;

    setExporting(true);
    setExportError("");

    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "DCYES";
      workbook.subject = `${reportLabel(period)} financial summary`;
      workbook.title = `${reportLabel(period)} - ${range.start} to ${range.end}`;
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("DCYES Report", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      sheet.columns = [
        { key: "date", width: 14 },
        { key: "transaction", width: 22 },
        { key: "payee", width: 24 },
        { key: "employee", width: 22 },
        { key: "location", width: 22 },
        { key: "destination", width: 24 },
        { key: "items", width: 12 },
        { key: "amount", width: 20 },
        { key: "receipt", width: 18 },
        { key: "remarks", width: 30 },
      ];

      sheet.mergeCells("A1:J1");
      sheet.getCell("A1").value = "DCYES";
      sheet.getCell("A1").font = {
        name: "Aptos Display",
        size: 20,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      sheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      sheet.getCell("A1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      sheet.getRow(1).height = 34;

      sheet.mergeCells("A2:J2");
      sheet.getCell("A2").value =
        `FINANCE MANAGEMENT SYSTEM • ${reportLabel(period).toUpperCase()}`;
      sheet.getCell("A2").font = {
        size: 12,
        bold: true,
        color: { argb: "FF1E3A8A" },
      };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      sheet.mergeCells("A3:J3");
      sheet.getCell("A3").value =
        `Reporting period: ${range.start} to ${range.end}`;
      sheet.getCell("A3").font = {
        italic: true,
        color: { argb: "FF475569" },
      };
      sheet.getCell("A3").alignment = { horizontal: "center" };

      sheet.mergeCells("A4:J4");
      sheet.getCell("A4").value =
        `Generated: ${new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
        })}`;
      sheet.getCell("A4").font = {
        size: 9,
        color: { argb: "FF64748B" },
      };
      sheet.getCell("A4").alignment = { horizontal: "center" };

      const headers = [
        "Date",
        "Transaction No.",
        "Payee",
        "Employee Name",
        "Project Location",
        "Destination",
        "Item Count",
        "Total Amount (PHP)",
        "Receipt No.",
        "Remarks",
      ];

      const header = sheet.addRow(headers);
      header.height = 28;

      header.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1D4ED8" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cell.border = {
          top: {
            style: "thin",
            color: { argb: "FFCBD5E1" },
          },
          bottom: {
            style: "medium",
            color: { argb: "FF0F172A" },
          },
        };
      });

      rows.forEach((record, index) => {
        const row = sheet.addRow([
          record.record_date,
          record.transaction_no,
          record.payee,
          record.employee_name || "",
          record.locations?.name || "",
          destinationLabel(record.destination || ""),
          record.daily_record_items?.length || 0,
          recordTotal(record),
          record.receipt_no || "",
          record.remarks || "",
        ]);

        row.height = 22;

        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: index % 2 ? "FFF1F5F9" : "FFFFFFFF",
            },
          };
          cell.border = {
            bottom: {
              style: "hair",
              color: { argb: "FFCBD5E1" },
            },
          };
          cell.alignment = {
            vertical: "middle",
            wrapText: true,
          };
        });

        row.getCell(8).numFmt =
          '"₱"#,##0.00;[Red]-"₱"#,##0.00';
      });

      const totalRow = sheet.addRow([
        "",
        "",
        "",
        "",
        "",
        "",
        "GRAND TOTAL",
        total,
        "",
        "",
      ]);

      totalRow.height = 30;

      totalRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          size: 12,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F172A" },
        };
        cell.border = {
          top: {
            style: "medium",
            color: { argb: "FF0F172A" },
          },
        };
        cell.alignment = { vertical: "middle" };
      });

      totalRow.getCell(8).numFmt =
        '"₱"#,##0.00;[Red]-"₱"#,##0.00';

      sheet.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: Math.max(5, sheet.rowCount - 1), column: 10 },
      };

      sheet.getColumn(8).alignment = {
        horizontal: "right",
        vertical: "middle",
      };

      const buffer = await workbook.xlsx.writeBuffer();

      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        `DCYES-${period}-report-${range.start}-to-${range.end}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Excel export error:", err);

      setExportError(
        err instanceof Error
          ? `Excel export failed: ${err.message}`
          : "Excel export failed. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <section className="min-w-0 flex-1 p-5 md:p-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {reportLabel(period)}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Totals are calculated from saved Daily Records and their
              item amounts. Reports do not create duplicate records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={loading || rows.length === 0 || exporting}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? "Preparing Excel..." : "Export Excel (.xlsx)"}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <label className="text-sm font-semibold text-slate-700">
            {period === "monthly"
              ? "Select month"
              : period === "weekly"
                ? "Choose any date in the week"
                : "Select date"}

            <input
              className="mt-2 block rounded-lg border border-slate-300 px-3 py-2 font-normal"
              type={period === "monthly" ? "month" : "date"}
              value={period === "monthly" ? date.slice(0, 7) : date}
              max={localDate()}
              onChange={(event) => {
                const value = event.target.value;

                if (value) {
                  setDate(
                    period === "monthly" ? `${value}-01` : value
                  );
                }
              }}
            />
          </label>

          <div className="text-sm text-slate-500">
            Period:{" "}
            <strong className="text-slate-800">{range.start}</strong>
            {" to "}
            <strong className="text-slate-800">{range.end}</strong>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Could not load report:</strong> {error}
          </div>
        )}

        {exportError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {exportError}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Overall Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? "Loading..." : money(total)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Saved Transactions</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? "..." : rows.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Days With Records</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? "..." : daily.size}
            </p>
          </div>
        </div>

        {period !== "daily" && (
          <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <h2 className="font-bold text-slate-900">Daily Totals</h2>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-right">Transactions</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {[...daily.entries()].map(([day, value]) => (
                  <tr key={day} className="border-t border-slate-200">
                    <td className="px-5 py-3">{day}</td>
                    <td className="px-5 py-3 text-right">
                      {value.count}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {money(value.total)}
                    </td>
                  </tr>
                ))}

                {!loading && daily.size === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-8 text-center text-slate-500"
                    >
                      No records for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-bold text-slate-900">
              Transaction Details
            </h2>
          </div>

          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Date",
                  "Transaction No.",
                  "Payee",
                  "Employee",
                  "Location",
                  "Destination",
                  "Item Count",
                  "Total Amount",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-10 text-center text-slate-500"
                  >
                    Loading transaction records...
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((record) => (
                    <tr
                      key={record.id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        {record.record_date}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {record.transaction_no}
                      </td>

                      <td className="px-4 py-3">{record.payee}</td>

                      <td className="px-4 py-3">
                        {record.employee_name || "—"}
                      </td>

                      <td className="px-4 py-3">
                        {record.locations?.name || "—"}
                      </td>

                      <td className="px-4 py-3 capitalize">
                        {destinationLabel(record.destination || "")}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {record.daily_record_items?.length || 0}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {money(recordTotal(record))}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-10 text-center text-slate-500"
                      >
                        No saved Daily Records found for this period.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>

            {!loading && rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 text-right font-bold text-slate-900"
                  >
                    GRAND TOTAL
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-900">
                    {money(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </main>
  );
}
