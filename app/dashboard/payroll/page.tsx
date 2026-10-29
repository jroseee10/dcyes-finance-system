"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

type Location = { id: number; name: string; address?: string | null };
type PayrollRow = {
  employee_no: number;
  employee_name: string;
  designation: string;
  daily_rate: number;
  days_worked: number;
  total_pay: number;
  overtime_hours: number;
  overtime_total: number;
  net_amount: number;
};
type Batch = {
  id: string;
  pay_date: string;
  week_start: string;
  week_end: string;
  location_id: number;
  location_name: string;
  prepared_by: string | null;
  notes: string | null;
  created_at: string;
  payroll_records: PayrollRow[];
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blankRow = (no: number): PayrollRow => ({
  employee_no: no, employee_name: "", designation: "", daily_rate: 0,
  days_worked: 0, total_pay: 0, overtime_hours: 0, overtime_total: 0, net_amount: 0,
});
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value || 0);
const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PH") : "”";
const calculate = (row: PayrollRow): PayrollRow => {
  const totalPay = Math.round(Number(row.daily_rate || 0) * Number(row.days_worked || 0) * 100) / 100;
  const overtimeTotal = Math.round((Number(row.daily_rate || 0) / 8) * Number(row.overtime_hours || 0) * 100) / 100;
  return { ...row, total_pay: totalPay, overtime_total: overtimeTotal, net_amount: Math.round((totalPay + overtimeTotal) * 100) / 100 };
};

export default function PayrollPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allTimeBatches, setAllTimeBatches] = useState<Batch[]>([]);
  const [payDate, setPayDate] = useState(today());
  const [weekStart, setWeekStart] = useState(today());
  const [weekEnd, setWeekEnd] = useState(today());
  const [locationId, setLocationId] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<PayrollRow[]>([blankRow(1), blankRow(2), blankRow(3)]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filterLocation, setFilterLocation] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error("Your session expired. Please log in again.");
    return data.session.access_token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/payroll?month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load payroll.");
      setLocations(result.locations || []);
      setBatches(result.batches || []);
      const allResponse = await fetch("/api/admin/payroll", {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const allResult = await allResponse.json();
      if (!allResponse.ok) throw new Error(allResult.error || "Unable to load all-time payroll totals.");
      setAllTimeBatches(allResult.batches || []);
      if (!locationId && result.locations?.length) setLocationId(String(result.locations[0].id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load payroll.");
    } finally {
      setLoading(false);
    }
  }, [getToken, month, locationId]);

  useEffect(() => { void load(); }, [load]);

  const updateRow = (index: number, field: keyof PayrollRow, value: string) => {
    setRows(current => current.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: field === "employee_name" || field === "designation" ? value : Number(value || 0) };
      return calculate(next);
    }));
  };
  const addRow = () => setRows(current => [...current, blankRow(current.length + 1)]);
  const removeRow = (index: number) => setRows(current => current.filter((_, i) => i !== index).map((row, i) => ({ ...row, employee_no: i + 1 })));

  const visibleBatches = useMemo(() => batches.filter(batch => filterLocation === "all" || String(batch.location_id) === filterLocation), [batches, filterLocation]);
  const monthTotal = useMemo(() => visibleBatches.reduce((sum, batch) => sum + (batch.payroll_records || []).reduce((s, row) => s + Number(row.net_amount || 0), 0), 0), [visibleBatches]);
  const monthEmployees = useMemo(() => visibleBatches.reduce((sum, batch) => sum + (batch.payroll_records || []).length, 0), [visibleBatches]);
  const locationTotals = useMemo(() => {
    const totals = new Map<number, {
      name: string;
      batches: number;
      employees: number;
      total: number;
    }>();

    for (const batch of visibleBatches) {
      const current = totals.get(batch.location_id) || {
        name: batch.location_name,
        batches: 0,
        employees: 0,
        total: 0,
      };

      current.batches += 1;
      current.employees += (batch.payroll_records || []).length;
      current.total += (batch.payroll_records || []).reduce(
        (sum, row) => sum + Number(row.net_amount || 0),
        0,
      );
      totals.set(batch.location_id, current);
    }

    return Array.from(totals.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [visibleBatches]);

  async function savePayroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const ready = rows.filter(row => row.employee_name.trim());
    if (!ready.length) { setError("Enter at least one employee name before saving."); return; }
    if (!locationId) { setError("Select a location."); return; }
    setSaving(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/admin/payroll", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          pay_date: payDate, week_start: weekStart, week_end: weekEnd,
          location_id: Number(locationId), prepared_by: preparedBy, notes,
          records: ready.map((row, i) => ({ ...calculate(row), employee_no: i + 1 })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save payroll.");
      setMessage("Payroll batch saved successfully.");
      setRows([blankRow(1), blankRow(2), blankRow(3)]);
      setNotes("");
      setMonth(payDate.slice(0, 7));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save payroll.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayroll(batch: Batch) {
    const confirmed = window.confirm(
      `Delete the entire payroll batch for ${batch.location_name}, pay date ${dateLabel(batch.pay_date)}? This may permanently remove financial records. Continue only if you are sure.`,
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeletingId(batch.id);

    try {
      const token = await getToken();
      const response = await fetch(
        `/api/admin/payroll?id=${encodeURIComponent(batch.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to delete payroll.");
      }

      setMessage("Payroll batch deleted successfully.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete payroll.");
    } finally {
      setDeletingId(null);
    }
  }
 
  async function exportWeekly(batch: Batch) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "DCYES Finance Management System";
    workbook.subject = "Weekly Payroll Report";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Weekly Payroll", {
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      },
    });

    const navy = "FF17365D";
    const blue = "FF24476B";
    const lightBlue = "FFD9E7F5";
    const lightGray = "FFF3F6FA";
    const white = "FFFFFFFF";
    const borderColor = "FFD6DEE8";

    sheet.columns = [
      { width: 7 },
      { width: 28 },
      { width: 20 },
      { width: 16 },
      { width: 13 },
      { width: 17 },
      { width: 17 },
      { width: 20 },
      { width: 18 },
      { width: 22 },
    ];

    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value = "DCYES FINANCE MANAGEMENT SYSTEM";
    sheet.getCell("A1").font = {
      name: "Arial",
      size: 17,
      bold: true,
      color: { argb: white },
    };
    sheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: navy },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(1).height = 34;

    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").value = "WEEKLY PAYROLL REGISTER";
    sheet.getCell("A2").font = {
      name: "Arial",
      size: 14,
      bold: true,
      color: { argb: navy },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(2).height = 27;

    sheet.mergeCells("A3:J3");
    sheet.getCell("A3").value =
      `Location: ${batch.location_name}  |  Pay Date: ${dateLabel(batch.pay_date)}`;
    sheet.getCell("A3").font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: blue },
    };
    sheet.getCell("A3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(3).height = 23;

    sheet.mergeCells("A4:J4");
    sheet.getCell("A4").value =
      `Payroll Week: ${dateLabel(batch.week_start)} - ${dateLabel(batch.week_end)}`;
    sheet.getCell("A4").font = {
      name: "Arial",
      size: 10,
      italic: true,
      color: { argb: "FF475569" },
    };
    sheet.getCell("A4").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(4).height = 22;

    const headers = [
      "No.",
      "Employee Name",
      "Designation",
      "Rate per Day",
      "Days Worked",
      "Total Pay",
      "OT Hours",
      "OT Amount",
      "Net Amount",
      "Employee Signature",
    ];

    sheet.addRow(headers);
    const headerRow = sheet.getRow(5);
    headerRow.height = 34;
    headerRow.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: white },
    };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: blue },
    };
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    const records = batch.payroll_records || [];

    records.forEach((record, index) => {
      const row = sheet.addRow([
        index + 1,
        record.employee_name,
        record.designation || "",
        Number(record.daily_rate || 0),
        Number(record.days_worked || 0),
        Number(record.total_pay || 0),
        Number(record.overtime_hours || 0),
        Number(record.overtime_total || 0),
        Number(record.net_amount || 0),
        "",
      ]);

      row.height = 25;
      row.font = { name: "Arial", size: 10 };
      row.alignment = {
        vertical: "middle",
        wrapText: true,
      };

      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: lightGray },
          };
        });
      }

      row.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      row.getCell(4).numFmt = '"₱"#,##0.00';
      row.getCell(5).numFmt = "0.00";
      row.getCell(7).numFmt = "0.00";
      row.getCell(6).numFmt = '"₱"#,##0.00';
      row.getCell(8).numFmt = '"₱"#,##0.00';
      row.getCell(9).numFmt = '"₱"#,##0.00';
      row.getCell(10).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });

    const totalRowNumber = sheet.rowCount + 1;
    const totalRow = sheet.addRow([
      "",
      "TOTAL PAYROLL",
      "",
      "",
      "",
      { formula: `SUM(F6:F${totalRowNumber - 1})` },
      "",
      { formula: `SUM(H6:H${totalRowNumber - 1})` },
      { formula: `SUM(I6:I${totalRowNumber - 1})` },
      "",
    ]);

    totalRow.height = 30;
    totalRow.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: white },
    };
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: navy },
      };
      cell.border = {
        top: { style: "medium", color: { argb: white } },
        bottom: { style: "thin", color: { argb: borderColor } },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };
    });

    [6, 8, 9].forEach((columnNumber) => {
      totalRow.getCell(columnNumber).numFmt = '"₱"#,##0.00';
    });

    // Apply consistent borders to the entire payroll table.
    for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber++) {
      sheet.getRow(rowNumber).eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: borderColor } },
          left: { style: "thin", color: { argb: borderColor } },
          bottom: { style: "thin", color: { argb: borderColor } },
          right: { style: "thin", color: { argb: borderColor } },
        };
      });
    }

    // Restore the highlighted total row after applying table borders.
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: navy },
      };
      cell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: white },
      };
    });

    const notesRow = sheet.rowCount + 2;
    sheet.mergeCells(`A${notesRow}:J${notesRow}`);
    sheet.getCell(`A${notesRow}`).value =
      "Prepared payroll record. Please verify all amounts before approval and payment.";
    sheet.getCell(`A${notesRow}`).font = {
      name: "Arial",
      size: 9,
      italic: true,
      color: { argb: "FF64748B" },
    };
    sheet.getCell(`A${notesRow}`).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    sheet.getRow(notesRow).height = 25;

    sheet.views = [{ state: "frozen", ySplit: 5 }];
    sheet.autoFilter = {
      from: "A5",
      to: `J${Math.max(5, totalRowNumber - 1)}`,
    };

    sheet.pageSetup.printArea = `A1:J${notesRow}`;
    sheet.pageSetup.horizontalCentered = true;
    sheet.headerFooter.oddFooter =
      "&LDCYES Finance Management System&CWeekly Payroll&RPage &P of &N";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      `Weekly-Payroll-${batch.location_name.replace(/[^a-z0-9-_]/gi, "_")}-${batch.pay_date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  async function exportMonthly() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Jrose";
    workbook.subject = "Monthly Payroll Report";
    workbook.created = new Date();

    const navy = "FF17365D";
    const blue = "FF24476B";
    const lightBlue = "FFD9E7F5";
    const lightGray = "FFF3F6FA";
    const white = "FFFFFFFF";
    const borderColor = "FFD9E2F3";
    const currencyFormat = '"₱"#,##0.00;[Red]-"₱"#,##0.00';

    function styleTitle(
      sheet: ExcelJS.Worksheet,
      title: string,
      lastColumn: number,
      subtitle: string,
    ) {
      const lastCol = sheet.getColumn(lastColumn).letter;

      sheet.mergeCells(`A1:${lastCol}1`);
      sheet.getCell("A1").value = title;
      sheet.getCell("A1").font = {
        name: "Arial",
        size: 17,
        bold: true,
        color: { argb: white },
      };
      sheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: navy },
      };
      sheet.getCell("A1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      sheet.getRow(1).height = 34;

      sheet.mergeCells(`A2:${lastCol}2`);
      sheet.getCell("A2").value = subtitle;
      sheet.getCell("A2").font = {
        name: "Arial",
        size: 11,
        italic: true,
        color: { argb: navy },
      };
      sheet.getCell("A2").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      sheet.getRow(2).height = 25;
    }

    function styleHeader(row: ExcelJS.Row) {
      row.height = 34;
      row.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: blue },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: borderColor } },
          bottom: { style: "thin", color: { argb: borderColor } },
          left: { style: "thin", color: { argb: borderColor } },
          right: { style: "thin", color: { argb: borderColor } },
        };
      });
    }

    function styleBody(sheet: ExcelJS.Worksheet, startRow: number) {
      for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        row.height = 24;

        row.eachCell((cell) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = {
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            bottom: { style: "thin", color: { argb: borderColor } },
            left: { style: "thin", color: { argb: borderColor } },
            right: { style: "thin", color: { argb: borderColor } },
          };
        });

        if ((rowNumber - startRow) % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: lightGray },
            };
          });
        }
      }
    }

    // SHEET 1: MONTHLY SUMMARY
    const summary = workbook.addWorksheet("Monthly Summary");
    summary.columns = [
      { header: "Location", key: "location", width: 30 },
      { header: "Payroll Batches", key: "batches", width: 19 },
      { header: "Employees", key: "employees", width: 16 },
      { header: "Total Net Payroll", key: "total", width: 24 },
    ];

    styleTitle(
      summary,
      "MONTHLY PAYROLL SUMMARY",
      4,
      `Payroll Month: ${month} | Generated: ${new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`,
    );

    summary.addRow([]);
    summary.addRow(summary.columns.map((column) => column.header));
    styleHeader(summary.getRow(4));

    const groups = new Map<
      string,
      { batches: number; employees: number; total: number }
    >();

    for (const batch of visibleBatches) {
      const current = groups.get(batch.location_name) || {
        batches: 0,
        employees: 0,
        total: 0,
      };

      current.batches += 1;
      current.employees += (batch.payroll_records || []).length;
      current.total += (batch.payroll_records || []).reduce(
        (sum, record) => sum + Number(record.net_amount || 0),
        0,
      );
      groups.set(batch.location_name, current);
    }

    for (const [name, value] of groups) {
      summary.addRow([
        name,
        value.batches,
        value.employees,
        value.total,
      ]);
    }

    styleBody(summary, 5);

    for (let rowNumber = 5; rowNumber <= summary.rowCount; rowNumber++) {
      summary.getCell(rowNumber, 4).numFmt = currencyFormat;
      summary.getCell(rowNumber, 4).alignment = {
        horizontal: "right",
        vertical: "middle",
      };
    }

    const summaryTotalRow = summary.addRow([
      "GRAND TOTAL",
      visibleBatches.length,
      monthEmployees,
      monthTotal,
    ]);

    summaryTotalRow.height = 30;
    summaryTotalRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: white },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: navy },
      };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: navy } },
      };
    });
    summaryTotalRow.getCell(4).numFmt = currencyFormat;
    summaryTotalRow.getCell(4).alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    summary.autoFilter = {
      from: "A4",
      to: "D4",
    };
    summary.views = [{ state: "frozen", ySplit: 4 }];

    // SHEET 2: PAYROLL DETAILS
    const detail = workbook.addWorksheet("Payroll Details");
    detail.columns = [
      { header: "Pay Date", key: "payDate", width: 15 },
      { header: "Week Start", key: "weekStart", width: 15 },
      { header: "Week End", key: "weekEnd", width: 15 },
      { header: "Location", key: "location", width: 25 },
      { header: "Employee Name", key: "employee", width: 28 },
      { header: "Designation", key: "designation", width: 20 },
      { header: "Rate per Day", key: "rate", width: 16 },
      { header: "Days Worked", key: "days", width: 13 },
      { header: "Total Pay", key: "pay", width: 17 },
      { header: "OT Hours", key: "hours", width: 13 },
      { header: "OT Total", key: "overtime", width: 17 },
      { header: "Net Amount", key: "net", width: 18 },
    ];

    styleTitle(
      detail,
      "MONTHLY PAYROLL DETAILS",
      12,
      `Payroll Month: ${month} | All figures in Philippine pesos (PHP)`,
    );

    detail.addRow([]);
    detail.addRow(detail.columns.map((column) => column.header));
    styleHeader(detail.getRow(4));

    for (const batch of visibleBatches) {
      for (const record of batch.payroll_records || []) {
        detail.addRow([
          batch.pay_date,
          batch.week_start,
          batch.week_end,
          batch.location_name,
          record.employee_name,
          record.designation,
          Number(record.daily_rate || 0),
          Number(record.days_worked || 0),
          Number(record.total_pay || 0),
          Number(record.overtime_hours || 0),
          Number(record.overtime_total || 0),
          Number(record.net_amount || 0),
        ]);
      }
    }

    styleBody(detail, 5);

    for (let rowNumber = 5; rowNumber <= detail.rowCount; rowNumber++) {
      [7, 9, 11, 12].forEach((column) => {
        detail.getCell(rowNumber, column).numFmt = currencyFormat;
        detail.getCell(rowNumber, column).alignment = {
          horizontal: "right",
          vertical: "middle",
        };
      });

      [1, 2, 3, 8, 10].forEach((column) => {
        detail.getCell(rowNumber, column).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });
    }

    const detailTotalRow = detail.addRow([
      "",
      "",
      "",
      "",
      "",
      "GRAND TOTAL",
      "",
      "",
      { formula: `SUM(I5:I${Math.max(4, detail.rowCount)})` },
      "",
      { formula: `SUM(K5:K${Math.max(4, detail.rowCount)})` },
      { formula: `SUM(L5:L${Math.max(4, detail.rowCount)})` },
    ]);

    detailTotalRow.height = 30;
    detailTotalRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: white },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: navy },
      };
      cell.alignment = { vertical: "middle" };
    });

    [9, 11, 12].forEach((column) => {
      detailTotalRow.getCell(column).numFmt = currencyFormat;
      detailTotalRow.getCell(column).alignment = {
        horizontal: "right",
        vertical: "middle",
      };
    });

    detail.autoFilter = {
      from: "A4",
      to: "L4",
    };
    detail.views = [{ state: "frozen", ySplit: 4 }];

    // PRINT SETTINGS
    for (const sheet of [summary, detail]) {
      sheet.pageSetup = {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      };
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (!cell.alignment) {
            cell.alignment = { vertical: "middle", wrapText: true };
          }
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Monthly-Payroll-${month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div><h1 className="text-3xl font-bold text-slate-900">Payroll</h1><p className="mt-1 text-sm text-slate-600">Weekly payroll batches and monthly payroll totals by pay date.</p></div>
            <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
          </header>

          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Monthly Total Payroll· {month}</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(monthTotal)}</p><p className="mt-1 text-xs text-slate-500">{monthEmployees} employee rows across {visibleBatches.length} batches</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Grand Total Payroll· all saved batches</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(allTimeBatches.reduce((sum, batch) => sum + (batch.payroll_records || []).reduce((s, row) => s + Number(row.net_amount || 0), 0), 0))}</p><p className="mt-1 text-xs text-slate-500">The monthly list is filtered by pay date.</p></div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Payroll Totals by Location</h2>
              <p className="mt-1 text-sm text-slate-500">Monthly payroll breakdown for {month}</p>
            </div>
            {locationTotals.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No payroll totals for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Location</th>
                      <th className="px-3 py-3">Batches</th>
                      <th className="px-3 py-3">Employees</th>
                      <th className="px-3 py-3 text-right">Total Net Payroll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationTotals.map((item) => (
                      <tr key={item.name} className="border-t border-slate-100">
                        <td className="px-3 py-3 font-medium">{item.name}</td>
                        <td className="px-3 py-3">{item.batches}</td>
                        <td className="px-3 py-3">{item.employees}</td>
                        <td className="px-3 py-3 text-right font-semibold">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <tr>
                      <td className="px-3 py-3">Grand Total</td>
                      <td className="px-3 py-3">{visibleBatches.length}</td>
                      <td className="px-3 py-3">{monthEmployees}</td>
                      <td className="px-3 py-3 text-right">{money(monthTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
          <form onSubmit={savePayroll} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div><h2 className="text-xl font-bold text-slate-900">Create Weekly Payroll</h2><p className="mt-1 text-sm text-slate-500">Check employee details and totals before saving.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Location<select value={locationId} onChange={e => setLocationId(e.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5"><option value="">Select location</option>{locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Pay Date<input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm font-medium text-slate-700">Prepared By<input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Name of preparer" className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm font-medium text-slate-700">Payroll Week Start<input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm font-medium text-slate-700">Payroll Week End<input type="date" value={weekEnd} min={weekStart} onChange={e => setWeekEnd(e.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm font-medium text-slate-700">Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5" /></label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[1120px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["No.", "Employee Name", "Designation", "Rate per Day", "No. of Days", "Total Pay", "OT Hours", "Total of Overtime", "Net Amount", ""].map((heading, i) => <th key={`${heading}-${i}`} className="px-3 py-3">{heading}</th>)}</tr></thead>
                <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-2 py-2"><input value={row.employee_name} onChange={e => updateRow(index, "employee_name", e.target.value)} aria-label={`Employee name row ${index + 1}`} placeholder="Employee name" className="w-48 rounded border border-slate-300 p-2" /></td>
                  <td className="px-2 py-2"><input value={row.designation} onChange={e => updateRow(index, "designation", e.target.value)} aria-label={`Designation row ${index + 1}`} placeholder="Designation" className="w-36 rounded border border-slate-300 p-2" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" step="0.01" value={row.daily_rate} onChange={e => updateRow(index, "daily_rate", e.target.value)} className="w-28 rounded border border-slate-300 p-2" /></td>
                  <td className="px-2 py-2"><input type="number" min="0" max="31" step="0.25" value={row.days_worked} onChange={e => updateRow(index, "days_worked", e.target.value)} className="w-24 rounded border border-slate-300 p-2" /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{money(row.total_pay)}</td>
                  <td className="px-2 py-2"><input type="number" min="0" max="500" step="0.25" value={row.overtime_hours} onChange={e => updateRow(index, "overtime_hours", e.target.value)} className="w-24 rounded border border-slate-300 p-2" /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{money(row.overtime_total)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold">{money(row.net_amount)}</td>
                  <td className="px-2 py-2"><button type="button" onClick={() => removeRow(index)} disabled={rows.length === 1} className="rounded px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-30">Remove</button></td>
                </tr>)}</tbody>
                <tfoot className="bg-slate-50 font-semibold"><tr><td colSpan={5} className="px-3 py-3 text-right">Batch Total</td><td className="px-3 py-3">{money(rows.reduce((s, row) => s + row.total_pay, 0))}</td><td></td><td className="px-3 py-3">{money(rows.reduce((s, row) => s + row.overtime_total, 0))}</td><td className="px-3 py-3">{money(rows.reduce((s, row) => s + row.net_amount, 0))}</td><td></td></tr></tfoot>
              </table>
            </div>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={addRow} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Add Employee</button><button type="submit" disabled={saving || loading} className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{saving ? "Saving..." : "Save Payroll Batch"}</button></div>
          </form>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-xl font-bold text-slate-900">Saved Payroll</h2><p className="mt-1 text-sm text-slate-500">Monthly report uses each batch's pay date.</p></div>
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-slate-600">Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2" /></label>
                <label className="text-sm text-slate-600">Location<select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2"><option value="all">All locations</option>{locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                <button type="button" onClick={() => void exportMonthly()} disabled={!visibleBatches.length} className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Export Monthly Excel</button>
              </div>
            </div>
            {loading ? <p className="py-8 text-sm text-slate-500">Loading payroll</p> : !visibleBatches.length ? <p className="py-8 text-sm text-slate-500">No payroll batches found for this month and location.</p> :
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-3 py-3">Pay Date</th><th className="px-3 py-3">Payroll Week</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Employees</th><th className="px-3 py-3">Net Payroll</th><th className="px-3 py-3">Excel</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{visibleBatches.map(batch => <tr key={batch.id} className="border-t border-slate-100"><td className="px-3 py-3">{dateLabel(batch.pay_date)}</td><td className="px-3 py-3">{dateLabel(batch.week_start)} “ {dateLabel(batch.week_end)}</td><td className="px-3 py-3">{batch.location_name}</td><td className="px-3 py-3">{(batch.payroll_records || []).length}</td><td className="px-3 py-3 font-semibold">{money((batch.payroll_records || []).reduce((s, row) => s + Number(row.net_amount || 0), 0))}</td><td className="px-3 py-3"><button type="button" onClick={() => void exportWeekly(batch)} className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50">Export .xlsx</button></td><td className="px-3 py-3"><button type="button" onClick={() => void deletePayroll(batch)} disabled={deletingId !== null} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingId === batch.id ? "Deleting..." : "Delete"}</button></td></tr>)}</tbody></table></div>}
          </section>
          <p className="text-xs text-slate-500">OT calculation: daily rate Ã· 8 Ã— OT hours. Net amount: total pay + overtime. No deductions or OT multiplier are applied.</p>
        </div>
      </main>
    </div>
  );
}

