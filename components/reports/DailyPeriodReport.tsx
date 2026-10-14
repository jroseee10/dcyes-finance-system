"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Item = { id: number; description: string; amount: number | string; item_order: number };
type RecordRow = {
  id: number; transaction_no: string; record_date: string; payee: string;
  employee_name: string | null; receipt_no: string | null; remarks: string | null;
  location_id: number; destination: string; locations?: { name: string } | null;
  daily_record_items?: Item[];
};
type Period = "daily" | "weekly" | "monthly";
const money = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
const localDate = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const o = Object.fromEntries(p.map(x => [x.type, x.value])); return `${o.year}-${o.month}-${o.day}`;
};
const recordTotal = (r: RecordRow) => (r.daily_record_items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
function dateRange(period: Period, date: string) {
  const d = new Date(`${date.slice(0,10)}T00:00:00`); let start = new Date(d), end = new Date(d);
  if (period === "weekly") { const offset = (d.getDay() + 6) % 7; start.setDate(d.getDate() - offset); end = new Date(start); end.setDate(start.getDate() + 6); }
  if (period === "monthly") { start = new Date(d.getFullYear(), d.getMonth(), 1); end = new Date(d.getFullYear(), d.getMonth()+1, 0); }
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  return { start: fmt(start), end: fmt(end) };
}
function label(period: Period) { return period === "daily" ? "Daily Report" : period === "weekly" ? "Weekly Report" : "Monthly Report"; }
export default function DailyPeriodReport({ period }: { period: Period }) {
  const [date, setDate] = useState(localDate()); const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const range = useMemo(() => dateRange(period, date), [period, date]);
  useEffect(() => { let alive = true; async function load() {
    setLoading(true); setError("");
    try {
      const { data, error } = await supabase.from("daily_records").select(`id, transaction_no, record_date, payee, employee_name, receipt_no, remarks, location_id, destination, locations ( name ), daily_record_items ( id, description, amount, item_order )`).gte("record_date", range.start).lte("record_date", range.end).order("record_date", { ascending: true }).order("id", { ascending: true });
      if (error) throw error; if (alive) setRows((data || []) as unknown as RecordRow[]);
    } catch (e) { console.error(`${period} report load error`, e); if (alive) { setRows([]); setError(e instanceof Error ? e.message : "Unable to load report. Check database permissions and connection."); } }
    finally { if (alive) setLoading(false); }
  } void load(); return () => { alive = false; }; }, [period, range.start, range.end]);
  const total = rows.reduce((s,r) => s + recordTotal(r), 0);
  const daily = new Map<string, { count: number; total: number }>();
  for (const r of rows) { const cur = daily.get(r.record_date) || { count: 0, total: 0 }; cur.count++; cur.total += recordTotal(r); daily.set(r.record_date, cur); }
  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "DCYES";
    workbook.subject = `${label(period)} financial summary`;
    workbook.title = `${label(period)} - ${range.start} to ${range.end}`;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("DCYES Report", {
      views: [{ state: "frozen", ySplit: 5 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    sheet.columns = [
      { key: "date", width: 14 }, { key: "transaction", width: 20 },
      { key: "payee", width: 24 }, { key: "employee", width: 22 },
      { key: "location", width: 22 }, { key: "destination", width: 22 },
      { key: "items", width: 12 }, { key: "amount", width: 18 },
      { key: "receipt", width: 18 }, { key: "remarks", width: 30 },
    ];
    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value = "DCYES";
    sheet.getCell("A1").font = { name: "Aptos Display", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 34;
    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").value = `FINANCE MANAGEMENT SYSTEM • ${label(period).toUpperCase()}`;
    sheet.getCell("A2").font = { size: 12, bold: true, color: { argb: "FF1E3A8A" } };
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.mergeCells("A3:J3");
    sheet.getCell("A3").value = `Reporting period: ${range.start} to ${range.end}`;
    sheet.getCell("A3").font = { italic: true, color: { argb: "FF475569" } };
    sheet.getCell("A3").alignment = { horizontal: "center" };
    sheet.mergeCells("A4:J4");
    sheet.getCell("A4").value = `Generated: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`;
    sheet.getCell("A4").font = { size: 9, color: { argb: "FF64748B" } };
    sheet.getCell("A4").alignment = { horizontal: "center" };
    const headers = ["Date", "Transaction No.", "Payee", "Employee Name", "Project Location", "Destination", "Item Count", "Total Amount (PHP)", "Receipt No.", "Remarks"];
    const header = sheet.addRow(headers);
    header.height = 28;
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { top: { style: "thin", color: { argb: "FFCBD5E1" } }, bottom: { style: "medium", color: { argb: "FF0F172A" } } };
    });
    rows.forEach((r, i) => {
      const row = sheet.addRow([r.record_date, r.transaction_no, r.payee, r.employee_name || "", r.locations?.name || "", String(r.destination || "").replaceAll("_", " "), r.daily_record_items?.length || 0, recordTotal(r), r.receipt_no || "", r.remarks || ""]);
      row.height = 22;
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 ? "FFF1F5F9" : "FFFFFFFF" } };
        cell.border = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
      row.getCell(8).numFmt = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
    });
    const totalRow = sheet.addRow(["", "", "", "", "", "", "GRAND TOTAL", total, "", ""]);
    totalRow.height = 30;
    totalRow.eachCell(cell => {
      cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cell.border = { top: { style: "medium", color: { argb: "FF0F172A" } } };
      cell.alignment = { vertical: "middle" };
    });
    totalRow.getCell(8).numFmt = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, sheet.rowCount - 1), column: 10 } };
    sheet.getColumn(8).alignment = { horizontal: "right", vertical: "middle" };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DCYES-${period}-report-${range.start}-to-${range.end}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return <main className="flex min-h-screen bg-slate-50"><Sidebar/><section className="min-w-0 flex-1 p-5 md:p-8">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-900">{label(period)}</h1><p className="mt-2 text-sm text-slate-500">Totals are calculated from saved Daily Records and their item amounts. Reports do not create duplicate records.</p></div><button onClick={() => void exportExcel()} disabled={loading || rows.length===0} className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-40">Export Excel (.xlsx)</button></div>
    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5"><label className="text-sm font-semibold text-slate-700">{period === "monthly" ? "Select month" : period === "weekly" ? "Choose any date in the week" : "Select date"}<input className="mt-2 block rounded-lg border border-slate-300 px-3 py-2 font-normal" type={period === "monthly" ? "month" : "date"} value={period === "monthly" ? date.slice(0,7) : date} onChange={e=>setDate(period === "monthly" ? `${e.target.value}-01` : e.target.value)} /></label><div className="text-sm text-slate-500">Period: <strong className="text-slate-800">{range.start}</strong> to <strong className="text-slate-800">{range.end}</strong></div></div>
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load report: {error}</div>}
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Overall Total</p><p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "Loading…" : money(total)}</p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Saved Transactions</p><p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "…" : rows.length}</p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Days With Records</p><p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "…" : daily.size}</p></div></div>
    {(period !== "daily") && <div className="mb-6 overflow-x-auto rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-bold text-slate-900">Daily Totals</h2></div><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3 text-left">Date</th><th className="px-5 py-3 text-right">Transactions</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody>{[...daily.entries()].map(([day,v])=><tr key={day} className="border-t"><td className="px-5 py-3">{day}</td><td className="px-5 py-3 text-right">{v.count}</td><td className="px-5 py-3 text-right font-semibold">{money(v.total)}</td></tr>)}{!loading && daily.size===0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">No records for this period.</td></tr>}</tbody></table></div>}
    <div className="overflow-x-auto rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-bold text-slate-900">Transaction Details</h2></div><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Date","Transaction No.","Payee","Employee","Location","Destination","Item Count","Total Amount"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t hover:bg-slate-50"><td className="px-4 py-3">{r.record_date}</td><td className="px-4 py-3 font-medium">{r.transaction_no}</td><td className="px-4 py-3">{r.payee}</td><td className="px-4 py-3">{r.employee_name || "—"}</td><td className="px-4 py-3">{r.locations?.name || "—"}</td><td className="px-4 py-3">{r.destination.replaceAll("_"," ")}</td><td className="px-4 py-3 text-right">{r.daily_record_items?.length || 0}</td><td className="px-4 py-3 text-right font-semibold">{money(recordTotal(r))}</td></tr>)}{!loading && rows.length===0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500">No saved Daily Records found for this period.</td></tr>}</tbody></table></div>
  </section></main>;
}
