"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

type TelegraphicTransfer = {
  id: number;
  location_id: number;
  transfer_date: string;
  tt_ref_no: string | null;
  applicant_sender: string | null;
  beneficiary_name: string | null;
  beneficiary_bank: string | null;
  beneficiary_account_no: string | null;
  swift_branch_code: string | null;
  amount: number | null;
  currency: string | null;
  charges: number | null;
  total_debited: number | null;
  purpose_of_payment: string | null;
  status: string | null;
  remarks: string | null;
  attachment_url: string | null;
  created_at: string;
};

type Location = {
  id: number;
  name: string;
};

type CurrentUserProfile = {
  name: string;
  email: string;
  position: string;
};

const makeEmptyForm = () => ({
  transfer_date: new Date().toISOString().slice(0, 10),
  tt_ref_no: "",
  applicant_sender: "",
  beneficiary_name: "",
  beneficiary_bank: "",
  beneficiary_account_no: "",
  swift_branch_code: "",
  amount: "",
  currency: "PHP",
  charges: "",
  purpose_of_payment: "",
  status: "Pending",
  remarks: "",
  attachment_url: "",
});

export default function TelegraphicTransferPage() {
  const params = useParams();
  const router = useRouter();

  const locationId = Number(params.id);

  const [location, setLocation] = useState<Location | null>(null);

  const [records, setRecords] =
    useState<TelegraphicTransfer[]>([]);

  const [form, setForm] = useState(makeEmptyForm());

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [attachmentFile, setAttachmentFile] =
    useState<File | null>(null);

  const [search, setSearch] = useState("");

  // =====================================================
  // ROLE
  // =====================================================

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  const [currentProfile, setCurrentProfile] =
    useState<CurrentUserProfile | null>(null);

  async function loadCurrentUserRole() {
    setLoadingRole(true);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !authData.user ||
        !authData.user.email
      ) {
        console.error(
          "TT auth error:",
          authError
        );

        setIsAdmin(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("users")
        .select("name, email, position, status")
        .eq("email", authData.user.email)
        .maybeSingle();

      if (profileError) {
        console.error(
          "TT profile error:",
          profileError
        );

        setIsAdmin(false);
        return;
      }

      const active =
        String(profile?.status || "")
          .trim()
          .toLowerCase() === "active";

      const admin =
        String(profile?.position || "")
          .trim()
          .toLowerCase() === "admin";

      setIsAdmin(active && admin);

      setCurrentProfile({
        name: profile?.name || "",
        email:
          profile?.email ||
          authData.user.email,
        position: profile?.position || "",
      });
    } catch (error) {
      console.error(
        "TT role check error:",
        error
      );

      setIsAdmin(false);
    } finally {
      setLoadingRole(false);
    }
  }

  // =====================================================
  // ACTIVITY LOG
  // =====================================================

  async function addActivityLog({
    action,
    recordId,
    description,
  }: {
    action: string;
    recordId: number;
    description: string;
  }) {
    try {
      if (!currentProfile) {
        console.warn(
          "Activity log skipped: user profile not loaded."
        );
        return;
      }

      const { error } = await supabase
        .from("activity_logs")
        .insert({
          user_email: currentProfile.email,
          user_name: currentProfile.name,
          user_position: currentProfile.position,
          action,
          module: "Telegraphic Transfer",
          record_id: recordId,
          location_id: locationId,
          location_name: location?.name || null,
          description,
        });

      if (error) {
        console.error(
          "TT activity log error:",
          error
        );
      }
    } catch (error) {
      console.error(
        "TT activity log unexpected error:",
        error
      );
    }
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    setLoading(true);

    try {
      const {
        data: locationData,
        error: locationError,
      } = await supabase
        .from("locations")
        .select("id, name")
        .eq("id", locationId)
        .single();

      if (locationError) {
        console.error(locationError);

        alert(
          "Hindi ma-load ang location: " +
            locationError.message
        );

        return;
      }

      setLocation(locationData);

      const {
        data,
        error,
      } = await supabase
        .from("telegraphic_transfers")
        .select("*")
        .eq("location_id", locationId)
        .order("transfer_date", {
          ascending: false,
        });

      if (error) {
        console.error(error);

        alert(
          "Hindi makuha ang Telegraphic Transfers: " +
            error.message
        );

        return;
      }

      setRecords(
        (data || []) as TelegraphicTransfer[]
      );
    } catch (error) {
      console.error(
        "Load TT error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      !locationId ||
      Number.isNaN(locationId)
    ) {
      return;
    }

    loadCurrentUserRole();
    loadData();
  }, [locationId]);

  // =====================================================
  // FORM HELPERS
  // =====================================================

  function updateField(
    field: keyof ReturnType<typeof makeEmptyForm>,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function clearForm() {
    setForm(makeEmptyForm());
    setEditingId(null);
    setAttachmentFile(null);
    setShowForm(false);
  }

  function calculateTotal() {
    const amount =
      Number(form.amount) || 0;

    const charges =
      Number(form.charges) || 0;

    return amount + charges;
  }

  // =====================================================
  // FILE
  // =====================================================

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-upload o pagpalit ng TT attachment."
      );

      e.target.value = "";
      return;
    }

    const file =
      e.target.files?.[0];

    if (!file) {
      setAttachmentFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert(
        "Image file lang ang puwedeng i-upload."
      );

      e.target.value = "";
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        "Maximum file size ay 5MB."
      );

      e.target.value = "";
      return;
    }

    setAttachmentFile(file);
  }

  async function uploadAttachment(
    file: File
  ) {
    if (!isAdmin) {
      throw new Error(
        "Admin only ang pag-upload ng TT attachment."
      );
    }

    setUploading(true);

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const safeExtension =
        extension.replace(
          /[^a-z0-9]/g,
          ""
        ) || "jpg";

      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${safeExtension}`;

      const filePath =
        `telegraphic/${locationId}/${fileName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("receipts")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          }
        );

      if (uploadError) {
        console.error(
          "TT attachment upload error:",
          uploadError
        );

        throw new Error(
          uploadError.message
        );
      }

      const { data } =
        supabase.storage
          .from("receipts")
          .getPublicUrl(filePath);

      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  // =====================================================
  // VIEW ATTACHMENT
  // =====================================================

  async function viewAttachment(
    url: string
  ) {
    try {
      const marker =
        "/storage/v1/object/public/receipts/";

      const markerIndex =
        url.indexOf(marker);

      if (markerIndex === -1) {
        alert(
          "Invalid attachment URL."
        );
        return;
      }

      const filePath =
        decodeURIComponent(
          url.substring(
            markerIndex +
              marker.length
          )
        );

      const {
        data,
        error,
      } = await supabase.storage
        .from("receipts")
        .createSignedUrl(
          filePath,
          60 * 5
        );

      if (error) {
        console.error(
          "View TT attachment error:",
          error
        );

        alert(
          "Hindi mabuksan ang attachment: " +
            error.message
        );

        return;
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "View TT attachment error:",
        error
      );

      alert(
        "May error habang binubuksan ang attachment."
      );
    }
  }

  // =====================================================
  // SAVE - ADMIN ONLY
  // =====================================================

  async function saveRecord(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!isAdmin) {
      alert(
        "Admin only ang pag-add o pag-edit ng Telegraphic Transfer."
      );
      return;
    }

    if (!form.transfer_date) {
      alert(
        "Ilagay muna ang transfer date."
      );
      return;
    }

    if (
      !form.applicant_sender.trim()
    ) {
      alert(
        "Ilagay muna ang Applicant / Sender."
      );
      return;
    }

    if (
      !form.beneficiary_name.trim()
    ) {
      alert(
        "Ilagay muna ang Beneficiary Name."
      );
      return;
    }

    const amount =
      Number(form.amount) || 0;

    const charges =
      Number(form.charges) || 0;

    const totalDebited =
      amount + charges;

    setSaving(true);

    try {
      let finalAttachmentUrl =
        form.attachment_url || null;

      if (attachmentFile) {
        finalAttachmentUrl =
          await uploadAttachment(
            attachmentFile
          );
      }

      const payload = {
        location_id: locationId,

        transfer_date:
          form.transfer_date,

        tt_ref_no:
          form.tt_ref_no.trim() ||
          null,

        applicant_sender:
          form.applicant_sender.trim(),

        beneficiary_name:
          form.beneficiary_name.trim(),

        beneficiary_bank:
          form.beneficiary_bank.trim() ||
          null,

        beneficiary_account_no:
          form.beneficiary_account_no.trim() ||
          null,

        swift_branch_code:
          form.swift_branch_code.trim() ||
          null,

        amount,

        currency:
          form.currency.trim() ||
          "PHP",

        charges,

        total_debited:
          totalDebited,

        purpose_of_payment:
          form.purpose_of_payment.trim() ||
          null,

        status:
          form.status,

        remarks:
          form.remarks.trim() ||
          null,

        attachment_url:
          finalAttachmentUrl,
      };

      if (
        editingId !== null
      ) {
        const {
          error,
        } = await supabase
          .from("telegraphic_transfers")
          .update(payload)
          .eq("id", editingId)
          .eq(
            "location_id",
            locationId
          );

        if (error) {
          alert(
            "Hindi ma-update ang record: " +
              error.message
          );

          return;
        }

        await addActivityLog({
          action: "Updated",
          recordId: editingId,
          description: `Updated Telegraphic Transfer${
            form.tt_ref_no.trim()
              ? ` ${form.tt_ref_no.trim()}`
              : ""
          } for ${form.beneficiary_name.trim()} - ${
            form.currency || "PHP"
          } ${totalDebited.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        });

        alert(
          "Telegraphic Transfer successfully updated!"
        );
      } else {
        const {
          data: insertedData,
          error,
        } = await supabase
          .from("telegraphic_transfers")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          alert(
            "Hindi ma-save ang record: " +
              error.message
          );

          return;
        }

        await addActivityLog({
          action: "Added",
          recordId: insertedData.id,
          description: `Added Telegraphic Transfer${
            form.tt_ref_no.trim()
              ? ` ${form.tt_ref_no.trim()}`
              : ""
          } for ${form.beneficiary_name.trim()} - ${
            form.currency || "PHP"
          } ${totalDebited.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        });

        alert(
          "Telegraphic Transfer successfully saved!"
        );
      }

      clearForm();
      await loadData();
    } catch (error) {
      console.error(
        "Save TT error:",
        error
      );

      alert(
        "Hindi ma-save ang Telegraphic Transfer: " +
          (
            error instanceof Error
              ? error.message
              : "Unknown error"
          )
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  // =====================================================
  // EDIT - ADMIN ONLY
  // =====================================================

  function startEdit(
    record: TelegraphicTransfer
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-edit ng Telegraphic Transfer."
      );

      return;
    }

    setEditingId(record.id);
    setAttachmentFile(null);

    setForm({
      transfer_date:
        record.transfer_date || "",

      tt_ref_no:
        record.tt_ref_no || "",

      applicant_sender:
        record.applicant_sender || "",

      beneficiary_name:
        record.beneficiary_name || "",

      beneficiary_bank:
        record.beneficiary_bank || "",

      beneficiary_account_no:
        record.beneficiary_account_no || "",

      swift_branch_code:
        record.swift_branch_code || "",

      amount:
        record.amount?.toString() || "",

      currency:
        record.currency || "PHP",

      charges:
        record.charges?.toString() || "",

      purpose_of_payment:
        record.purpose_of_payment || "",

      status:
        record.status || "Pending",

      remarks:
        record.remarks || "",

      attachment_url:
        record.attachment_url || "",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================================
  // DELETE - ADMIN ONLY
  // =====================================================

  async function deleteRecord(
    record: TelegraphicTransfer
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-delete ng Telegraphic Transfer."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Sigurado ka bang gusto mong i-delete ang TT record${
          record.tt_ref_no
            ? ` "${record.tt_ref_no}"`
            : ""
        }?

Note: Hindi mabubura ang uploaded attachment sa Storage.`
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("telegraphic_transfers")
      .delete()
      .eq("id", record.id)
      .eq(
        "location_id",
        locationId
      );

    if (error) {
      alert(
        "Hindi ma-delete ang record: " +
          error.message
      );

      return;
    }

    await addActivityLog({
      action: "Deleted",
      recordId: record.id,
      description: `Deleted Telegraphic Transfer${
        record.tt_ref_no
          ? ` ${record.tt_ref_no}`
          : ""
      } for ${record.beneficiary_name || "Unknown beneficiary"} - ${
        record.currency || "PHP"
      } ${Number(record.total_debited || 0).toLocaleString(
        "en-PH",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}`,
    });

    alert(
      "Telegraphic Transfer successfully deleted!"
    );

    await loadData();
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredRecords =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return records;
      }

      return records.filter(
        (record) =>
          [
            record.tt_ref_no,
            record.applicant_sender,
            record.beneficiary_name,
            record.beneficiary_bank,
            record.beneficiary_account_no,
            record.purpose_of_payment,
            record.status,
            record.remarks,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      records,
      search,
    ]);

  // =====================================================
  // TOTAL
  // =====================================================

  const overallTotal =
    filteredRecords.reduce(
      (sum, record) =>
        sum +
        Number(
          record.total_debited ||
            0
        ),
      0
    );

  // =====================================================
  // FORMATTERS
  // =====================================================

  function formatCurrency(
    amount: number,
    currency = "PHP"
  ) {
    try {
      return new Intl.NumberFormat(
        "en-PH",
        {
          style: "currency",
          currency:
            currency || "PHP",
          minimumFractionDigits: 2,
        }
      ).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(
        2
      )}`;
    }
  }

  function formatDate(
    date: string
  ) {
    if (!date) {
      return "";
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
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // EXCEL
  // =====================================================

  async function exportToExcel() {
    if (!location) {
      alert(
        "Location not found."
      );
      return;
    }

    if (
      records.length === 0
    ) {
      alert(
        "Walang Telegraphic Transfer records na ie-export."
      );
      return;
    }

    setExporting(true);

    try {
      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "DCYES Finance System";

      const worksheet =
        workbook.addWorksheet(
          "Telegraphic Transfer"
        );

      worksheet.columns = [
        {
          header: "Date",
          key: "date",
          width: 20,
        },
        {
          header: "TT Ref. No.",
          key: "ref",
          width: 18,
        },
        {
          header: "Applicant / Sender",
          key: "sender",
          width: 25,
        },
        {
          header: "Beneficiary Name",
          key: "beneficiary",
          width: 25,
        },
        {
          header: "Beneficiary Bank",
          key: "bank",
          width: 25,
        },
        {
          header: "Account No.",
          key: "account",
          width: 22,
        },
        {
          header: "SWIFT / Branch Code",
          key: "swift",
          width: 22,
        },
        {
          header: "Amount",
          key: "amount",
          width: 18,
        },
        {
          header: "Currency",
          key: "currency",
          width: 12,
        },
        {
          header: "Charges",
          key: "charges",
          width: 18,
        },
        {
          header: "Total Debited",
          key: "total",
          width: 20,
        },
        {
          header: "Purpose of Payment",
          key: "purpose",
          width: 28,
        },
        {
          header: "Status",
          key: "status",
          width: 15,
        },
        {
          header: "Remarks",
          key: "remarks",
          width: 28,
        },
        {
          header: "Attachment",
          key: "attachment",
          width: 25,
        },
      ];

      worksheet.mergeCells(
        "A1:O1"
      );

      const titleCell =
        worksheet.getCell("A1");

      titleCell.value =
        `${location.name.toUpperCase()} - TELEGRAPHIC TRANSFER`;

      titleCell.font = {
        size: 16,
        bold: true,
        color: {
          argb: "FFFFFFFF",
        },
      };

      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "1F3B64",
        },
      };

      titleCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.mergeCells(
        "A2:O2"
      );

      worksheet.getCell(
        "A2"
      ).value = "DCYES";

      const headerRow =
        worksheet.getRow(4);

      headerRow.values = [
        "Date",
        "TT Ref. No.",
        "Applicant / Sender",
        "Beneficiary Name",
        "Beneficiary Bank",
        "Account No.",
        "SWIFT / Branch Code",
        "Amount",
        "Currency",
        "Charges",
        "Total Debited",
        "Purpose of Payment",
        "Status",
        "Remarks",
        "Attachment",
      ];

      headerRow.eachCell(
        (cell) => {
          cell.font = {
            bold: true,
            color: {
              argb: "FFFFFFFF",
            },
          };

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "1F3B64",
            },
          };

          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        }
      );

      records.forEach(
        (record) => {
          const parts =
            record.transfer_date?.split(
              "-"
            ) || [];

          let excelDate:
            | Date
            | null = null;

          if (
            parts.length === 3
          ) {
            excelDate =
              new Date(
                Number(parts[0]),
                Number(parts[1]) -
                  1,
                Number(parts[2])
              );
          }

          const row =
            worksheet.addRow([
              excelDate,
              record.tt_ref_no || "",
              record.applicant_sender || "",
              record.beneficiary_name || "",
              record.beneficiary_bank || "",
              record.beneficiary_account_no ||
                "",
              record.swift_branch_code || "",
              Number(
                record.amount || 0
              ),
              record.currency || "PHP",
              Number(
                record.charges || 0
              ),
              Number(
                record.total_debited ||
                  0
              ),
              record.purpose_of_payment ||
                "",
              record.status ||
                "Pending",
              record.remarks || "",
              record.attachment_url
                ? "View Attachment"
                : "",
            ]);

          row.getCell(
            1
          ).numFmt =
            "mmmm d, yyyy";

          row.getCell(
            8
          ).numFmt =
            "₱#,##0.00";

          row.getCell(
            10
          ).numFmt =
            "₱#,##0.00";

          row.getCell(
            11
          ).numFmt =
            "₱#,##0.00";

          if (
            record.attachment_url
          ) {
            row.getCell(
              15
            ).value = {
              text:
                "View Attachment",

              hyperlink:
                record.attachment_url,
            };
          }
        }
      );

      const totalRow =
        worksheet.addRow([
          "OVERALL TOTAL",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          records.reduce(
            (sum, record) =>
              sum +
              Number(
                record.total_debited ||
                  0
              ),
            0
          ),
          "",
          "",
          "",
          "",
        ]);

      totalRow.font = {
        bold: true,
      };

      totalRow.getCell(
        11
      ).numFmt =
        "₱#,##0.00";

      worksheet.autoFilter = {
        from: "A4",
        to: "O4",
      };

      worksheet.views = [
        {
          state: "frozen",
          ySplit: 4,
        },
      ];

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
        )}_Telegraphic_Transfer.xlsx`;

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
        "Telegraphic Transfer Excel successfully exported!"
      );
    } catch (error) {
      console.error(error);

      alert(
        "Hindi ma-export ang Telegraphic Transfer Excel."
      );
    } finally {
      setExporting(false);
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">

      <div className="flex min-h-screen">

        <Sidebar />

        <section className="flex-1 p-8">

          {/* HEADER */}

          <div className="mb-8">

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}`
                )
              }
              className="text-blue-600 hover:underline mb-4"
            >
              ← Back to Location
            </button>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              <div>

                <h1 className="text-3xl font-bold text-slate-900">
                  Telegraphic Transfer
                </h1>

                <div className="flex items-center gap-3 mt-2">

                  <p className="text-gray-500">
                    {location?.name ||
                      "Location"}{" "}
                    - Telegraphic Transfer Records
                  </p>

                  {!loadingRole && (
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        isAdmin
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isAdmin
                        ? "👑 Admin"
                        : "👤 Office Staff"}
                    </span>
                  )}

                </div>

              </div>

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={
                    exportToExcel
                  }
                  disabled={
                    exporting ||
                    records.length === 0
                  }
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-medium"
                >
                  {exporting
                    ? "Exporting..."
                    : "📊 Export Excel"}
                </button>

                {!loadingRole &&
                  isAdmin && (

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        showForm
                      ) {
                        clearForm();
                      } else {
                        setShowForm(
                          true
                        );
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium"
                  >
                    {showForm
                      ? "✕ Close Form"
                      : "+ Add Transfer"}
                  </button>

                )}

              </div>

            </div>

          </div>

          {/* OFFICE STAFF */}

          {!loadingRole &&
            !isAdmin && (

            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

              <p className="font-semibold text-blue-900">
                👤 Office Staff Access
              </p>

              <p className="text-sm text-blue-700 mt-1">
                You can view Telegraphic Transfer records, open proof attachments, search, and export to Excel. Adding, editing, and deleting are restricted to Admin users.
              </p>

            </div>

          )}

          {/* FORM */}

          {showForm &&
            isAdmin && (

            <div className="bg-white rounded-xl shadow p-6 mb-8">

              <div className="mb-6">

                <h2 className="text-xl font-bold text-slate-900">
                  {editingId !==
                  null
                    ? "Edit Telegraphic Transfer"
                    : "Add Telegraphic Transfer"}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Enter the transfer application details and attach proof/photo if available.
                </p>

              </div>

              <form
                onSubmit={
                  saveRecord
                }
              >

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Transfer Date *
                    </label>

                    <input
                      type="date"
                      value={
                        form.transfer_date
                      }
                      onChange={(e) =>
                        updateField(
                          "transfer_date",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      TT Ref. No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.tt_ref_no
                      }
                      onChange={(e) =>
                        updateField(
                          "tt_ref_no",
                          e.target.value
                        )
                      }
                      placeholder="TT-0001"
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Status
                    </label>

                    <select
                      value={
                        form.status
                      }
                      onChange={(e) =>
                        updateField(
                          "status",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    >
                      <option value="Pending">
                        Pending
                      </option>

                      <option value="Processing">
                        Processing
                      </option>

                      <option value="Completed">
                        Completed
                      </option>

                      <option value="Cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Applicant / Sender *
                    </label>

                    <input
                      type="text"
                      value={
                        form.applicant_sender
                      }
                      onChange={(e) =>
                        updateField(
                          "applicant_sender",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Beneficiary Name *
                    </label>

                    <input
                      type="text"
                      value={
                        form.beneficiary_name
                      }
                      onChange={(e) =>
                        updateField(
                          "beneficiary_name",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Beneficiary Bank
                    </label>

                    <input
                      type="text"
                      value={
                        form.beneficiary_bank
                      }
                      onChange={(e) =>
                        updateField(
                          "beneficiary_bank",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Account No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.beneficiary_account_no
                      }
                      onChange={(e) =>
                        updateField(
                          "beneficiary_account_no",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      SWIFT / Branch Code
                    </label>

                    <input
                      type="text"
                      value={
                        form.swift_branch_code
                      }
                      onChange={(e) =>
                        updateField(
                          "swift_branch_code",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Currency
                    </label>

                    <select
                      value={
                        form.currency
                      }
                      onChange={(e) =>
                        updateField(
                          "currency",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    >
                      <option value="PHP">PHP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Amount
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.amount
                      }
                      onChange={(e) =>
                        updateField(
                          "amount",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Charges
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.charges
                      }
                      onChange={(e) =>
                        updateField(
                          "charges",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Total Debited
                    </label>

                    <div className="w-full border rounded-lg p-3 bg-slate-100 font-bold">
                      {formatCurrency(
                        calculateTotal(),
                        form.currency
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-3">

                    <label className="block text-sm font-medium mb-2">
                      📎 Proof / Attachment Photo
                    </label>

                    <div className="border rounded-xl p-4 bg-slate-50">

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handleFileChange
                        }
                      />

                      <p className="text-xs text-gray-500 mt-2">
                        Maximum 5MB.
                      </p>

                      {attachmentFile && (
                        <p className="mt-3 text-sm text-blue-700">
                          Selected: {attachmentFile.name}
                        </p>
                      )}

                      {form.attachment_url && (
                        <button
                          type="button"
                          onClick={() =>
                            viewAttachment(
                              form.attachment_url
                            )
                          }
                          className="mt-3 bg-slate-900 text-white px-4 py-2 rounded-lg"
                        >
                          👁 View Current Attachment
                        </button>
                      )}

                    </div>

                  </div>

                  <div className="md:col-span-3">

                    <label className="block text-sm font-medium mb-2">
                      Purpose of Payment
                    </label>

                    <textarea
                      rows={3}
                      value={
                        form.purpose_of_payment
                      }
                      onChange={(e) =>
                        updateField(
                          "purpose_of_payment",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  <div className="md:col-span-3">

                    <label className="block text-sm font-medium mb-2">
                      Remarks
                    </label>

                    <textarea
                      rows={3}
                      value={
                        form.remarks
                      }
                      onChange={(e) =>
                        updateField(
                          "remarks",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                </div>

                <div className="flex gap-3 mt-6">

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      uploading
                    }
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg"
                  >
                    {uploading
                      ? "Uploading..."
                      : saving
                      ? "Saving..."
                      : editingId !== null
                      ? "Save Changes"
                      : "Save Transfer"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearForm
                    }
                    className="border px-6 py-3 rounded-lg"
                  >
                    Cancel
                  </button>

                </div>

              </form>

            </div>

          )}

          {/* SEARCH */}

          <div className="bg-white rounded-xl shadow p-5 mb-6">

            <input
              type="text"
              value={
                search
              }
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="🔎 Search TT Ref. No., sender, beneficiary, bank..."
              className="w-full border rounded-lg p-3"
            />

          </div>

          {/* TABLE */}

          <div className="bg-white rounded-xl shadow overflow-hidden">

            <div className="p-6 border-b flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold">
                  Telegraphic Transfer Records
                </h2>

                <p className="text-sm text-gray-500">
                  {filteredRecords.length} record
                  {filteredRecords.length !== 1
                    ? "s"
                    : ""}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Overall Total
                </p>

                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(
                    overallTotal
                  )}
                </p>
              </div>

            </div>

            {loading ? (
              <div className="p-10 text-center text-gray-500">
                Loading records...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No Telegraphic Transfer records found.
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1750px]">

                  <thead>
                    <tr className="bg-[#1F3B64] text-white">

                      <th className="px-4 py-4 text-left">
                        Date
                      </th>

                      <th className="px-4 py-4 text-left">
                        TT Ref. No.
                      </th>

                      <th className="px-4 py-4 text-left">
                        Applicant / Sender
                      </th>

                      <th className="px-4 py-4 text-left">
                        Beneficiary
                      </th>

                      <th className="px-4 py-4 text-left">
                        Bank
                      </th>

                      <th className="px-4 py-4 text-left">
                        Account No.
                      </th>

                      <th className="px-4 py-4 text-right">
                        Amount
                      </th>

                      <th className="px-4 py-4 text-right">
                        Charges
                      </th>

                      <th className="px-4 py-4 text-right">
                        Total Debited
                      </th>

                      <th className="px-4 py-4 text-center">
                        Status
                      </th>

                      <th className="px-4 py-4 text-center">
                        Attachment
                      </th>

                      <th className="px-4 py-4 text-center">
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {filteredRecords.map(
                      (record) => (

                        <tr
                          key={
                            record.id
                          }
                          className="border-b hover:bg-slate-50"
                        >

                          <td className="px-4 py-4 whitespace-nowrap">
                            {formatDate(
                              record.transfer_date
                            )}
                          </td>

                          <td className="px-4 py-4 font-medium">
                            {record.tt_ref_no ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.applicant_sender ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.beneficiary_name ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.beneficiary_bank ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.beneficiary_account_no ||
                              "—"}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {formatCurrency(
                              Number(
                                record.amount || 0
                              ),
                              record.currency ||
                                "PHP"
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            {formatCurrency(
                              Number(
                                record.charges || 0
                              ),
                              record.currency ||
                                "PHP"
                            )}
                          </td>

                          <td className="px-4 py-4 text-right font-semibold">
                            {formatCurrency(
                              Number(
                                record.total_debited ||
                                  0
                              ),
                              record.currency ||
                                "PHP"
                            )}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-sm">
                              {record.status ||
                                "Pending"}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center">

                            {record.attachment_url ? (
                              <button
                                type="button"
                                onClick={() =>
                                  viewAttachment(
                                    record.attachment_url!
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"
                              >
                                📎 View Proof
                              </button>
                            ) : (
                              <span className="text-gray-400">
                                —
                              </span>
                            )}

                          </td>

                          <td className="px-4 py-4 text-center">

                            {loadingRole ? (
                              <span className="text-gray-400 text-xs">
                                Checking...
                              </span>
                            ) : isAdmin ? (
                              <div className="flex gap-2 justify-center">

                                <button
                                  type="button"
                                  onClick={() =>
                                    startEdit(
                                      record
                                    )
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteRecord(
                                      record
                                    )
                                  }
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
                                >
                                  Delete
                                </button>

                              </div>
                            ) : (
                              <span className="inline-flex px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium">
                                👁 View Only
                              </span>
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

        </section>

      </div>

    </main>
  );
}