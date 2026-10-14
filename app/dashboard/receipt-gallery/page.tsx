
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Attachment = {
  id: number;
  daily_record_id: number;
  original_file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type RecordInfo = {
  transaction_no: string;
  record_date: string;
  payee: string;
  receipt_no: string | null;
  locations?: { name: string } | null;
};

type GalleryItem = Attachment & {
  record: RecordInfo | null;
  signedUrl: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ReceiptGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setItems([]);
        setMessage("Please log in to view receipt attachments.");
        return;
      }

      const { data, error } = await supabase
        .from("daily_record_attachments")
        .select(`
          id,
          daily_record_id,
          original_file_name,
          storage_path,
          mime_type,
          file_size,
          created_at,
          daily_records (
            transaction_no,
            record_date,
            payee,
            receipt_no,
            locations ( name )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Receipt Gallery load error:", error);
        setItems([]);
        setMessage(
          "Unable to load attachments. Check the attachment table permissions and relationship."
        );
        return;
      }

      const rows = (data || []) as unknown as Array<
        Attachment & { daily_records: RecordInfo | null }
      >;

      const galleryItems: GalleryItem[] = await Promise.all(
        rows.map(async (row) => {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("daily-record-proofs")
            .createSignedUrl(row.storage_path, 300);

          if (signedError) {
            console.error("Receipt signed URL error:", signedError);
          }

          const { daily_records: record, ...attachment } = row;

          return {
            ...attachment,
            record,
            signedUrl: signedData?.signedUrl || null,
          };
        })
      );

      setItems(galleryItems);
    } catch (error) {
      console.error("Receipt Gallery error:", error);
      setItems([]);
      setMessage("An unexpected error occurred while loading the gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const locationNames = useMemo(
    () => Array.from(new Set(items.map((item) => item.record?.locations?.name || "Unknown location"))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const locationName = item.record?.locations?.name || "Unknown location";
      const recordDate = item.record?.record_date || item.created_at.slice(0, 10);
      const matchesSearch = !term || [
        item.original_file_name,
        item.record?.transaction_no,
        item.record?.payee,
        item.record?.receipt_no,
        locationName,
      ].some((value) => String(value || "").toLowerCase().includes(term));
      return matchesSearch &&
        (locationFilter === "all" || locationName === locationFilter) &&
        (!dateFrom || recordDate >= dateFrom) &&
        (!dateTo || recordDate <= dateTo);
    });
  }, [items, search, locationFilter, dateFrom, dateTo]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce<Record<string, GalleryItem[]>>((groups, item) => {
      const name = item.record?.locations?.name || "Unknown location";
      (groups[name] ||= []).push(item);
      return groups;
    }, {});
  }, [filteredItems]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Receipt / Proof Gallery
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              View attachments linked to saved Daily Records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              ← Back to Dashboard
            </a>
            <a
              href="/dashboard/daily-records"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back to Daily Records
            </a>
            <button
              type="button"
              onClick={() => void loadGallery()}
              disabled={loading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {message}
          </div>
        )}

        <section className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            Search receipts
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Transaction, payee, receipt, file..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Project / Location
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
              <option value="all">All projects</option>
              {locationNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            From date
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            To date
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <div className="md:col-span-2 xl:col-span-4 flex items-center justify-between gap-3 text-sm text-slate-500">
            <span>{filteredItems.length} receipt(s) · {Object.keys(groupedItems).length} project/location(s)</span>
            <button type="button" onClick={() => { setSearch(""); setLocationFilter("all"); setDateFrom(""); setDateTo(""); }}
              className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
              Clear filters
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border bg-white p-12 text-center text-slate-500">
            Loading attachments...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <div className="text-4xl">🧾</div>
            <h2 className="mt-3 font-bold text-slate-900">
              {items.length === 0 ? "No receipt attachments yet" : "No receipts match these filters"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {items.length === 0 ? "Upload a receipt from a saved Daily Record to see it here." : "Try another search term, project, or date range."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([locationName, locationItems]) => (
              <section key={locationName}>
                <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-lg font-bold text-slate-900">📁 {locationName}</h2>
                  <span className="text-sm text-slate-500">{locationItems.length} receipt(s)</span>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {locationItems.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex h-48 items-center justify-center overflow-hidden bg-slate-100">
                  {item.signedUrl && item.mime_type.startsWith("image/") ? (
                    <a
                      href={item.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-full w-full items-center justify-center"
                    >
                      <img
                        src={item.signedUrl}
                        alt={item.original_file_name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </a>
                  ) : (
                    <div className="text-center">
                      <div className="text-5xl">
                        {item.mime_type === "application/pdf" ? "📄" : "🧾"}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {item.mime_type === "application/pdf"
                          ? "PDF Document"
                          : "Attachment"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-5">
                  <div>
                    <h2 className="break-words font-bold text-slate-900">
                      {item.original_file_name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatBytes(Number(item.file_size || 0))} ·{" "}
                      {formatDate(item.created_at)}
                    </p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-slate-500">Transaction:</span>{" "}
                      <strong>{item.record?.transaction_no || "-"}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Record Date:</span>{" "}
                      {item.record?.record_date
                        ? formatDate(item.record.record_date)
                        : "-"}
                    </p>
                    <p>
                      <span className="text-slate-500">Payee:</span>{" "}
                      {item.record?.payee || "-"}
                    </p>
                    <p>
                      <span className="text-slate-500">Location:</span>{" "}
                      {item.record?.locations?.name || "-"}
                    </p>
                    <p>
                      <span className="text-slate-500">Receipt No.:</span>{" "}
                      {item.record?.receipt_no || "-"}
                    </p>
                  </div>

                  {item.signedUrl ? (
                    <div className="flex gap-2 border-t pt-4">
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        View
                      </a>
                      <a
                        href={item.signedUrl}
                        download={item.original_file_name}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700"
                      >
                        Download
                      </a>
                    </div>
                  ) : (
                    <p className="border-t pt-3 text-xs text-red-600">
                      Unable to create a temporary file link. Check storage permissions.
                    </p>
                  )}
                </div>
              </article>
                ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
