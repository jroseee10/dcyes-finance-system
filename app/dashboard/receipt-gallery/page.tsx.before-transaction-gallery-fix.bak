
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LocationOption = {
  id: number | string;
  name: string;
};

type FileRecord = {
  id: number | string;
  location_id?: number | string | null;
  location_name?: string | null;
  daily_record_id?: number | string | null;
  original_file_name?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  content_type?: string | null;
  mime_type?: string | null;
  file_size?: number | string | null;
  receipt_date?: string | null;
  description?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  signed_url?: string | null;
  signedUrl?: string | null;
};

type GalleryItem = {
  id: string;
  recordId: number | string;
  kind: "standalone" | "daily";
  locationId: string;
  locationName: string;
  original_file_name: string;
  storage_path: string;
  content_type: string;
  file_size: number;
  created_at: string;
  signedUrl: string | null;
  description: string;
};

const BUCKET = "daily-record-proofs";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getFileName(row: FileRecord) {
  return (
    row.original_file_name ||
    row.file_name ||
    row.storage_path?.split("/").pop() ||
    row.file_path?.split("/").pop() ||
    "Receipt file"
  );
}

function getStoragePath(row: FileRecord) {
  return row.storage_path || row.file_path || "";
}

function getContentType(row: FileRecord) {
  const provided = row.content_type || row.mime_type;

  if (provided) return provided.toLowerCase();

  const name = getFileName(row).toLowerCase();

  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".pdf")) return "application/pdf";

  return "application/octet-stream";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

function formatBytes(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ReceiptGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [uploadLocation, setUploadLocation] = useState("");
  const [receiptDate, setReceiptDate] = useState(
    new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    })
  );
  const [description, setDescription] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const getToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error("Unable to verify your session. Please sign in again.");
    }

    if (!session?.access_token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    return session.access_token;
  }, []);

  const createPreviewUrl = useCallback(
    async (row: FileRecord, existingUrl?: string | null) => {
      if (existingUrl) return existingUrl;

      const path = getStoragePath(row);

      if (!path) return null;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 10);

      if (error) {
        console.warn(
          "Unable to create receipt preview URL:",
          getFileName(row),
          error.message
        );
        return null;
      }

      return data?.signedUrl || null;
    },
    []
  );

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = await getToken();

      const [receiptResponse, locationsResponse, attachmentsResponse] =
        await Promise.all([
          fetch("/api/admin/standalone-receipts", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }),
          supabase
            .from("locations")
            .select("id, name")
            .order("name", { ascending: true }),
          supabase
            .from("daily_record_attachments")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      if (!receiptResponse.ok) {
        const payload = await receiptResponse.json().catch(() => ({}));
        throw new Error(
          payload.error || "Unable to load standalone receipts."
        );
      }

      if (locationsResponse.error) {
        throw new Error(
          `Unable to load locations: ${locationsResponse.error.message}`
        );
      }

      if (attachmentsResponse.error) {
        throw new Error(
          `Unable to load daily record attachments: ${attachmentsResponse.error.message}`
        );
      }

      const receiptPayload = await receiptResponse.json();

      const standaloneRows: FileRecord[] = Array.isArray(receiptPayload)
        ? receiptPayload
        : Array.isArray(receiptPayload.receipts)
          ? receiptPayload.receipts
          : Array.isArray(receiptPayload.data)
            ? receiptPayload.data
            : [];

      const locationRows = (locationsResponse.data ??
        []) as LocationOption[];

      setLocations(locationRows);

      const locationMap = new Map(
        locationRows.map((location) => [
          String(location.id),
          location.name,
        ])
      );

      const standaloneItems: GalleryItem[] = await Promise.all(
        standaloneRows.map(async (row) => {
          const locationId =
            row.location_id == null ? "" : String(row.location_id);

          const signedUrl = await createPreviewUrl(
            row,
            row.signed_url || row.signedUrl
          );

          return {
            id: `standalone-${row.id}`,
            recordId: row.id,
            kind: "standalone" as const,
            locationId,
            locationName:
              row.location_name ||
              locationMap.get(locationId) ||
              "Unassigned Location",
            original_file_name: getFileName(row),
            storage_path: getStoragePath(row),
            content_type: getContentType(row),
            file_size: Number(row.file_size || 0),
            created_at:
              row.receipt_date ||
              row.created_at ||
              new Date().toISOString(),
            signedUrl,
            description: row.description || row.remarks || "",
          };
        })
      );

      const attachmentRows = (attachmentsResponse.data ??
        []) as FileRecord[];

      const dailyRecordIds = [
        ...new Set(
          attachmentRows
            .map((row) => row.daily_record_id)
            .filter((id) => id != null)
            .map((id) => String(id))
        ),
      ];

      const dailyRecordLocationMap = new Map<string, string>();
      const dailyRecordTransactionMap = new Map<string, string>();

      if (dailyRecordIds.length > 0) {
        const { data: dailyRecords, error: dailyRecordsError } =
          await supabase
            .from("daily_records")
            .select("id, location_id, transaction_no")
            .in("id", dailyRecordIds);

        if (dailyRecordsError) {
          throw new Error(
            `Unable to load daily record details: ${dailyRecordsError.message}`
          );
        }

        for (const record of dailyRecords ?? []) {
          const recordId = String(record.id);

          dailyRecordLocationMap.set(
            recordId,
            String(record.location_id)
          );

          dailyRecordTransactionMap.set(
            recordId,
            String(record.transaction_no ?? "")
          );
        }
      }

      const dailyItems: GalleryItem[] = await Promise.all(
        attachmentRows.map(async (row) => {
          const signedUrl = await createPreviewUrl(
            row,
            row.signed_url || row.signedUrl
          );

          const recordId =
            row.daily_record_id == null
              ? ""
              : String(row.daily_record_id);

          const locationId = recordId
            ? dailyRecordLocationMap.get(recordId) || ""
            : "";

          const transactionNo = recordId
            ? dailyRecordTransactionMap.get(recordId) || ""
            : "";

          return {
            id: `daily-${row.id}`,
            recordId: row.id,
            kind: "daily" as const,
            locationId,
            locationName:
              locationMap.get(locationId) || "Unassigned Location",
            original_file_name: getFileName(row),
            storage_path: getStoragePath(row),
            content_type: getContentType(row),
            file_size: Number(row.file_size || 0),
            created_at: row.created_at || new Date().toISOString(),
            signedUrl,
            description: recordId
              ? `Daily Record #${transactionNo || recordId}`
              : "Daily Record Attachment",
          };
        })
      );

      const combined = [...standaloneItems, ...dailyItems].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      setItems(combined);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading the gallery."
      );
    } finally {
      setLoading(false);
    }
  }, [createPreviewUrl, getToken]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!uploadLocation) {
      setErrorMessage("Please select a project location.");
      return;
    }

    if (!file) {
      setErrorMessage("Please choose a receipt image or PDF.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Only JPG, PNG, WEBP, and PDF files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("The file must not exceed 10 MB.");
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();
      const formData = new FormData();

      formData.append("file", file);
      formData.append("location_id", uploadLocation);
      formData.append("receipt_date", receiptDate);
      formData.append("description", description.trim());
      formData.append("remarks", remarks.trim());

      const response = await fetch("/api/admin/standalone-receipts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to save the receipt.");
      }

      setFile(null);
      setDescription("");
      setRemarks("");

      const fileInput = document.getElementById(
        "receipt-file"
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      await loadGallery();
      setMessage("Receipt uploaded successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the receipt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GalleryItem) {
    const confirmed = window.confirm(
      `Delete "${item.original_file_name}"?\n\n` +
        (item.kind === "daily"
          ? "Only this attachment will be deleted. The Daily Record itself will remain."
          : "This receipt record and its associated file will be deleted.") +
        "\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    setMessage("");
    setErrorMessage("");
    setDeletingId(item.id);

    try {
      const token = await getToken();

      const response = await fetch("/api/admin/standalone-receipts", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: Number(item.recordId),
          kind: item.kind,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Unable to delete this receipt.");
      }

      await loadGallery();

      setMessage(
        payload.warning ||
          payload.message ||
          `"${item.original_file_name}" was deleted successfully.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting the receipt."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.original_file_name.toLowerCase().includes(normalizedSearch) ||
        item.locationName.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch) ||
        item.storage_path.toLowerCase().includes(normalizedSearch);

      const matchesLocation =
        locationFilter === "all" ||
        item.locationId === locationFilter ||
        (locationFilter === "daily" && item.kind === "daily");

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "images" &&
          item.content_type.startsWith("image/")) ||
        (typeFilter === "pdf" &&
          item.content_type === "application/pdf");

      const itemDate = item.created_at.slice(0, 10);

      return (
        matchesSearch &&
        matchesLocation &&
        matchesType &&
        (!dateFrom || itemDate >= dateFrom) &&
        (!dateTo || itemDate <= dateTo)
      );
    });
  }, [items, search, locationFilter, typeFilter, dateFrom, dateTo]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, GalleryItem[]>();

    for (const item of filteredItems) {
      if (!groups.has(item.locationName)) {
        groups.set(item.locationName, []);
      }

      groups.get(item.locationName)!.push(item);
    }

    return Array.from(groups.entries());
  }, [filteredItems]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              DCYES Finance Management System
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Receipt / Proof Gallery
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              View and manage receipt files and proof attachments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              ← Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void loadGallery()}
              disabled={loading || deletingId !== null}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Gallery"}
            </button>
          </div>
        </header>

        {message && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Upload a Receipt / Proof</h2>
          <p className="mt-1 text-sm text-slate-600">
            JPG, PNG, WEBP, or PDF. Maximum file size: 10 MB.
          </p>

          <form
            onSubmit={handleSave}
            className="mt-4 grid gap-4 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="receipt-location"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Project Location
              </label>
              <select
                id="receipt-location"
                value={uploadLocation}
                onChange={(event) => setUploadLocation(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={String(location.id)}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="receipt-date"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Receipt Date
              </label>
              <input
                id="receipt-date"
                type="date"
                value={receiptDate}
                onChange={(event) => setReceiptDate(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="receipt-description"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Description
              </label>
              <input
                id="receipt-description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. Office supplies receipt"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="receipt-remarks"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Remarks
              </label>
              <input
                id="receipt-remarks"
                type="text"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Optional remarks"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="receipt-file"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Receipt File
              </label>
              <input
                id="receipt-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                required
                className="block w-full rounded-lg border border-slate-300 bg-white text-sm"
              />
              {file && (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} · {formatBytes(file.size)}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || loading || deletingId !== null}
                className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Uploading..." : "Upload Receipt"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold">Saved Receipts and Proofs</h2>
            <p className="text-sm text-slate-600">
              {filteredItems.length} file
              {filteredItems.length === 1 ? "" : "s"} found
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label
                htmlFor="gallery-search"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Search
              </label>
              <input
                id="gallery-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search filename, location, description..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="gallery-location"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Location / Source
              </label>
              <select
                id="gallery-location"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All locations</option>
                <option value="daily">Daily record attachments</option>
                {locations.map((location) => (
                  <option key={location.id} value={String(location.id)}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="gallery-type"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                File Type
              </label>
              <select
                id="gallery-type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All files</option>
                <option value="images">Images</option>
                <option value="pdf">PDF files</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setLocationFilter("all");
                  setTypeFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

            <div>
              <label
                htmlFor="gallery-from"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Date From
              </label>
              <input
                id="gallery-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="gallery-to"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Date To
              </label>
              <input
                id="gallery-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Loading receipt gallery...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
              <p className="font-semibold text-slate-700">
                No receipts or proofs found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting the filters.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedItems.map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-slate-800">
                      {groupName}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {groupItems.length} file
                      {groupItems.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {groupItems.map((item) => {
                      const isDeleting = deletingId === item.id;
                      const isImage = item.content_type.startsWith("image/");
                      const isPdf =
                        item.content_type === "application/pdf";

                      return (
                        <article
                          key={item.id}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                        >
                          <div className="flex h-44 items-center justify-center overflow-hidden bg-slate-100">
                            {item.signedUrl && isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.signedUrl}
                                alt={item.original_file_name}
                                className="h-full w-full object-contain"
                                onError={() => {
                                  console.warn(
                                    "Receipt image failed to load:",
                                    item.original_file_name,
                                    item.storage_path
                                  );
                                }}
                              />
                            ) : (
                              <div className="px-4 text-center">
                                <div className="text-4xl">
                                  {isPdf ? "📄" : "🧾"}
                                </div>
                                <p className="mt-2 text-xs font-semibold uppercase text-slate-600">
                                  {isPdf ? "PDF Document" : "Receipt File"}
                                </p>
                                {!item.signedUrl && (
                                  <p className="mt-1 text-xs text-amber-700">
                                    Preview URL unavailable
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 p-4">
                            <div>
                              <p
                                className="break-words text-sm font-semibold text-slate-800"
                                title={item.original_file_name}
                              >
                                {item.original_file_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(item.created_at)} ·{" "}
                                {formatBytes(item.file_size)}
                              </p>
                              {item.description && (
                                <p className="mt-2 break-words text-xs text-slate-600">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {item.signedUrl ? (
                                <>
                                  <a
                                    href={item.signedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                                  >
                                    View
                                  </a>
                                  <a
                                    href={item.signedUrl}
                                    download={item.original_file_name}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                                  >
                                    Download
                                  </a>
                                </>
                              ) : (
                                <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                  Preview unavailable
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                disabled={
                                  deletingId !== null || saving || loading
                                }
                                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isDeleting ? "Deleting..." : "Delete"}
                              </button>
                            </div>

                            <p className="text-[11px] text-slate-400">
                              {item.kind === "daily"
                                ? "Daily record attachment"
                                : "Standalone receipt"}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
