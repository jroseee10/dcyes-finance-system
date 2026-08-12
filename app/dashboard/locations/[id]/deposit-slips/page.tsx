"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

type DepositSlip = {
  id: number;
  location_id: number;
  deposit_date: string;
  deposit_slip_no: string | null;
  bank: string | null;
  account_name: string | null;
  account_no: string | null;
  depositor: string | null;
  amount: number | null;
  deposit_type: string | null;
  reference_no: string | null;
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
  deposit_date: new Date()
    .toISOString()
    .slice(0, 10),

  deposit_slip_no: "",
  bank: "",
  account_name: "",
  account_no: "",
  depositor: "",
  amount: "",
  deposit_type: "Cash",
  reference_no: "",
  status: "Pending",
  remarks: "",
  attachment_url: "",
});

export default function DepositSlipsPage() {
  const params = useParams();
  const router = useRouter();

  const locationId =
    Number(params.id);

  // =====================================================
  // DATA
  // =====================================================

  const [
    location,
    setLocation,
  ] =
    useState<Location | null>(
      null
    );

  const [
    records,
    setRecords,
  ] =
    useState<DepositSlip[]>(
      []
    );

  // =====================================================
  // FORM
  // =====================================================

  const [
    form,
    setForm,
  ] =
    useState(
      makeEmptyForm()
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    showForm,
    setShowForm,
  ] =
    useState(false);

  // =====================================================
  // LOADING
  // =====================================================

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  // =====================================================
  // ATTACHMENT
  // =====================================================

  const [
    attachmentFile,
    setAttachmentFile,
  ] =
    useState<File | null>(
      null
    );

  // =====================================================
  // SEARCH
  // =====================================================

  const [
    search,
    setSearch,
  ] =
    useState("");

  // =====================================================
  // ROLE
  // =====================================================

  const [
    isAdmin,
    setIsAdmin,
  ] =
    useState(false);

  const [
    loadingRole,
    setLoadingRole,
  ] =
    useState(true);

  const [
    currentProfile,
    setCurrentProfile,
  ] = useState<CurrentUserProfile | null>(null);

  // =====================================================
  // LOAD CURRENT USER ROLE
  // =====================================================

  async function loadCurrentUserRole() {
    setLoadingRole(true);

    try {
      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !authData.user ||
        !authData.user.email
      ) {
        console.error(
          "Deposit auth error:",
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
        .select(
          "name, email, position, status"
        )
        .eq(
          "email",
          authData.user.email
        )
        .maybeSingle();

      if (profileError) {
        console.error(
          "Deposit profile error:",
          profileError
        );

        setIsAdmin(false);

        return;
      }

      const active =
        String(
          profile?.status ||
            ""
        )
          .trim()
          .toLowerCase() ===
        "active";

      const admin =
        String(
          profile?.position ||
            ""
        )
          .trim()
          .toLowerCase() ===
        "admin";

      setIsAdmin(
        active && admin
      );

      setCurrentProfile({
        name: profile?.name || "",
        email: profile?.email || authData.user.email,
        position: profile?.position || "",
      });
    } catch (error) {
      console.error(
        "Deposit role check error:",
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
        console.warn("Activity log skipped: user profile not loaded.");
        return;
      }

      const { error } = await supabase
        .from("activity_logs")
        .insert({
          user_email: currentProfile.email,
          user_name: currentProfile.name,
          user_position: currentProfile.position,
          action,
          module: "Deposit Slips",
          record_id: recordId,
          location_id: locationId,
          location_name: location?.name || null,
          description,
        });

      if (error) {
        console.error("Activity log error:", error);
      }
    } catch (error) {
      console.error("Activity log unexpected error:", error);
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
      } =
        await supabase
          .from(
            "locations"
          )
          .select(
            "id, name"
          )
          .eq(
            "id",
            locationId
          )
          .single();

      if (
        locationError
      ) {
        throw new Error(
          "Hindi ma-load ang location: " +
            locationError.message
        );
      }

      setLocation(
        locationData
      );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "deposit_slips"
          )
          .select("*")
          .eq(
            "location_id",
            locationId
          )
          .order(
            "deposit_date",
            {
              ascending:
                false,
            }
          );

      if (error) {
        throw new Error(
          "Hindi makuha ang deposit slips: " +
            error.message
        );
      }

      setRecords(
        (data || []) as DepositSlip[]
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "May error habang nilo-load ang Deposit Slips."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  useEffect(() => {
    if (
      !locationId ||
      Number.isNaN(
        locationId
      )
    ) {
      return;
    }

    loadCurrentUserRole();
    loadData();
  }, [locationId]);

  // =====================================================
  // UPDATE FIELD
  // =====================================================

  function updateField(
    field:
      keyof ReturnType<
        typeof makeEmptyForm
      >,
    value: string
  ) {
    setForm(
      (
        previous
      ) => ({
        ...previous,

        [field]:
          value,
      })
    );
  }

  // =====================================================
  // CLEAR FORM
  // =====================================================

  function clearForm() {
    setForm(
      makeEmptyForm()
    );

    setEditingId(
      null
    );

    setAttachmentFile(
      null
    );

    setShowForm(
      false
    );
  }

  // =====================================================
  // FILE SELECT - ADMIN ONLY
  // =====================================================

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-upload o pagpalit ng Deposit Slip proof."
      );

      e.target.value =
        "";

      return;
    }

    const file =
      e.target.files?.[0];

    if (!file) {
      setAttachmentFile(
        null
      );

      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Image file lang ang puwedeng i-upload."
      );

      e.target.value =
        "";

      return;
    }

    if (
      file.size >
      5 *
        1024 *
        1024
    ) {
      alert(
        "Maximum file size ay 5MB."
      );

      e.target.value =
        "";

      return;
    }

    setAttachmentFile(
      file
    );
  }

  // =====================================================
  // UPLOAD ATTACHMENT - ADMIN ONLY
  // =====================================================

  async function uploadAttachment(
    file: File
  ) {
    if (!isAdmin) {
      throw new Error(
        "Admin only ang pag-upload ng Deposit Slip proof."
      );
    }

    setUploading(
      true
    );

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const safeExtension =
        extension.replace(
          /[^a-z0-9]/g,
          ""
        ) || "jpg";

      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(
            2,
            8
          )}.${safeExtension}`;

      const filePath =
        `deposits/${locationId}/${fileName}`;

      const {
        error,
      } =
        await supabase.storage
          .from(
            "receipts"
          )
          .upload(
            filePath,
            file,
            {
              cacheControl:
                "3600",

              upsert:
                false,

              contentType:
                file.type,
            }
          );

      if (error) {
        console.error(
          "Deposit attachment upload error:",
          error
        );

        throw new Error(
          error.message
        );
      }

      const {
        data,
      } =
        supabase.storage
          .from(
            "receipts"
          )
          .getPublicUrl(
            filePath
          );

      return data.publicUrl;
    } finally {
      setUploading(
        false
      );
    }
  }

  // =====================================================
  // VIEW ATTACHMENT
  // =====================================================

  async function viewAttachment(
    url: string
  ) {
    try {
      const publicMarker =
        "/storage/v1/object/public/receipts/";

      const signedMarker =
        "/storage/v1/object/sign/receipts/";

      let filePath =
        "";

      if (
        url.includes(
          publicMarker
        )
      ) {
        filePath =
          decodeURIComponent(
            url.substring(
              url.indexOf(
                publicMarker
              ) +
                publicMarker.length
            )
          );
      } else if (
        url.includes(
          signedMarker
        )
      ) {
        const rawPath =
          url.substring(
            url.indexOf(
              signedMarker
            ) +
              signedMarker.length
          );

        filePath =
          decodeURIComponent(
            rawPath.split(
              "?"
            )[0]
          );
      } else if (
        !url.startsWith(
          "http://"
        ) &&
        !url.startsWith(
          "https://"
        )
      ) {
        filePath =
          url;
      } else {
        alert(
          "Hindi mabasa ang attachment path."
        );

        return;
      }

      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            "receipts"
          )
          .createSignedUrl(
            filePath,
            60 * 5
          );

      if (error) {
        console.error(
          "View Deposit attachment error:",
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
        "View Deposit attachment error:",
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
        "Admin only ang pag-add o pag-edit ng Deposit Slip."
      );

      return;
    }

    if (
      !form.deposit_date
    ) {
      alert(
        "Ilagay muna ang deposit date."
      );

      return;
    }

    if (
      !form.bank.trim()
    ) {
      alert(
        "Ilagay muna ang bank."
      );

      return;
    }

    if (
      !form.depositor.trim()
    ) {
      alert(
        "Ilagay muna ang depositor."
      );

      return;
    }

    const amount =
      Number(
        form.amount
      ) || 0;

    if (
      amount <= 0
    ) {
      alert(
        "Ilagay ang valid deposit amount."
      );

      return;
    }

    setSaving(
      true
    );

    try {
      let finalAttachmentUrl =
        form.attachment_url ||
        null;

      if (
        attachmentFile
      ) {
        finalAttachmentUrl =
          await uploadAttachment(
            attachmentFile
          );
      }

      const payload = {
        location_id:
          locationId,

        deposit_date:
          form.deposit_date,

        deposit_slip_no:
          form.deposit_slip_no
            .trim() ||
          null,

        bank:
          form.bank.trim(),

        account_name:
          form.account_name
            .trim() ||
          null,

        account_no:
          form.account_no
            .trim() ||
          null,

        depositor:
          form.depositor.trim(),

        amount,

        deposit_type:
          form.deposit_type ||
          "Cash",

        reference_no:
          form.reference_no
            .trim() ||
          null,

        status:
          form.status ||
          "Pending",

        remarks:
          form.remarks
            .trim() ||
          null,

        attachment_url:
          finalAttachmentUrl,
      };

      // =================================================
      // UPDATE
      // =================================================

      if (
        editingId !==
        null
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              "deposit_slips"
            )
            .update(
              payload
            )
            .eq(
              "id",
              editingId
            )
            .eq(
              "location_id",
              locationId
            );

        if (error) {
          throw new Error(
            error.message
          );
        }

        await addActivityLog({
          action: "Updated",
          recordId: editingId,
          description: `Updated deposit slip ${form.deposit_slip_no.trim() || "(no slip number)"} - ${form.bank.trim()} - ₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });

        alert(
          "Deposit Slip successfully updated!"
        );
      }

      // =================================================
      // INSERT
      // =================================================

      else {
        const {
          data: insertedData,
          error,
        } =
          await supabase
            .from(
              "deposit_slips"
            )
            .insert(
              payload
            )
            .select("id")
            .single();

        if (error) {
          throw new Error(
            error.message
          );
        }

        await addActivityLog({
          action: "Added",
          recordId: insertedData.id,
          description: `Added deposit slip ${form.deposit_slip_no.trim() || "(no slip number)"} - ${form.bank.trim()} - ₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });

        alert(
          "Deposit Slip successfully saved!"
        );
      }

      clearForm();

      await loadData();
    } catch (error) {
      console.error(
        "Deposit save error:",
        error
      );

      alert(
        "Hindi ma-save ang Deposit Slip: " +
          (
            error instanceof Error
              ? error.message
              : "Unknown error"
          )
      );
    } finally {
      setSaving(
        false
      );

      setUploading(
        false
      );
    }
  }

  // =====================================================
  // EDIT - ADMIN ONLY
  // =====================================================

  function startEdit(
    record: DepositSlip
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-edit ng Deposit Slip."
      );

      return;
    }

    setEditingId(
      record.id
    );

    setAttachmentFile(
      null
    );

    setForm({
      deposit_date:
        record.deposit_date ||
        "",

      deposit_slip_no:
        record.deposit_slip_no ||
        "",

      bank:
        record.bank ||
        "",

      account_name:
        record.account_name ||
        "",

      account_no:
        record.account_no ||
        "",

      depositor:
        record.depositor ||
        "",

      amount:
        record.amount?.toString() ||
        "",

      deposit_type:
        record.deposit_type ||
        "Cash",

      reference_no:
        record.reference_no ||
        "",

      status:
        record.status ||
        "Pending",

      remarks:
        record.remarks ||
        "",

      attachment_url:
        record.attachment_url ||
        "",
    });

    setShowForm(
      true
    );

    window.scrollTo({
      top: 0,

      behavior:
        "smooth",
    });
  }

  // =====================================================
  // DELETE - ADMIN ONLY
  // =====================================================

  async function deleteRecord(
    record: DepositSlip
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-delete ng Deposit Slip."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Sigurado ka bang gusto mong i-delete ang deposit slip${
          record.deposit_slip_no
            ? ` "${record.deposit_slip_no}"`
            : ""
        }?

Note: Hindi mabubura ang uploaded proof photo sa Storage.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from(
          "deposit_slips"
        )
        .delete()
        .eq(
          "id",
          record.id
        )
        .eq(
          "location_id",
          locationId
        );

    if (error) {
      alert(
        "Hindi ma-delete ang deposit slip: " +
          error.message
      );

      return;
    }

    await addActivityLog({
      action: "Deleted",
      recordId: record.id,
      description: `Deleted deposit slip ${record.deposit_slip_no || "(no slip number)"} - ${record.bank || "No bank"} - ₱${Number(record.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });

    alert(
      "Deposit Slip successfully deleted!"
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

      if (
        !keyword
      ) {
        return records;
      }

      return records.filter(
        (
          record
        ) =>
          [
            record.deposit_slip_no,

            record.bank,

            record.account_name,

            record.account_no,

            record.depositor,

            record.deposit_type,

            record.reference_no,

            record.status,

            record.remarks,
          ]
            .filter(
              Boolean
            )
            .join(" ")
            .toLowerCase()
            .includes(
              keyword
            )
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

  // =====================================================
  // FORMAT CURRENCY
  // =====================================================

  function formatCurrency(
    amount: number
  ) {
    return new Intl.NumberFormat(
      "en-PH",
      {
        style:
          "currency",

        currency:
          "PHP",

        minimumFractionDigits:
          2,
      }
    ).format(
      amount
    );
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    date: string
  ) {
    if (
      !date
    ) {
      return "";
    }

    const parts =
      date.split("-");

    if (
      parts.length !==
      3
    ) {
      return date;
    }

    const year =
      Number(
        parts[0]
      );

    const month =
      Number(
        parts[1]
      );

    const day =
      Number(
        parts[2]
      );

    return new Date(
      year,
      month - 1,
      day
    ).toLocaleDateString(
      "en-US",
      {
        month:
          "long",

        day:
          "numeric",

        year:
          "numeric",
      }
    );
  }

  // =====================================================
  // EXPORT EXCEL
  // =====================================================

  async function exportToExcel() {
    if (
      !location
    ) {
      alert(
        "Location not found."
      );

      return;
    }

    if (
      records.length ===
      0
    ) {
      alert(
        "Walang Deposit Slip records na ie-export."
      );

      return;
    }

    setExporting(
      true
    );

    try {
      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "DCYES Finance System";

      workbook.created =
        new Date();

      const worksheet =
        workbook.addWorksheet(
          "Deposit Slips"
        );

      worksheet.columns =
        [
          {
            header:
              "Date",

            key:
              "date",

            width:
              20,
          },

          {
            header:
              "Deposit Slip No.",

            key:
              "slip",

            width:
              20,
          },

          {
            header:
              "Bank",

            key:
              "bank",

            width:
              25,
          },

          {
            header:
              "Account Name",

            key:
              "accountName",

            width:
              25,
          },

          {
            header:
              "Account No.",

            key:
              "accountNo",

            width:
              22,
          },

          {
            header:
              "Depositor",

            key:
              "depositor",

            width:
              25,
          },

          {
            header:
              "Amount",

            key:
              "amount",

            width:
              18,
          },

          {
            header:
              "Deposit Type",

            key:
              "type",

            width:
              18,
          },

          {
            header:
              "Reference No.",

            key:
              "reference",

            width:
              20,
          },

          {
            header:
              "Status",

            key:
              "status",

            width:
              16,
          },

          {
            header:
              "Remarks",

            key:
              "remarks",

            width:
              30,
          },

          {
            header:
              "Attachment",

            key:
              "attachment",

            width:
              25,
          },
        ];

      // TITLE

      worksheet.mergeCells(
        "A1:L1"
      );

      const title =
        worksheet.getCell(
          "A1"
        );

      title.value =
        `${location.name.toUpperCase()} - DEPOSIT SLIPS`;

      title.font =
        {
          name:
            "Calibri",

          size:
            16,

          bold:
            true,

          color: {
            argb:
              "FFFFFFFF",
          },
        };

      title.fill =
        {
          type:
            "pattern",

          pattern:
            "solid",

          fgColor: {
            argb:
              "1F3B64",
          },
        };

      title.alignment =
        {
          horizontal:
            "center",

          vertical:
            "middle",
        };

      worksheet.getRow(
        1
      ).height =
        30;

      // SUBTITLE

      worksheet.mergeCells(
        "A2:L2"
      );

      const subtitle =
        worksheet.getCell(
          "A2"
        );

      subtitle.value =
        "DCYES FINANCE SYSTEM";

      subtitle.font =
        {
          italic:
            true,

          color: {
            argb:
              "1F3B64",
          },
        };

      subtitle.alignment =
        {
          horizontal:
            "center",
        };

      // HEADER

      const headerRow =
        worksheet.getRow(
          4
        );

      headerRow.values =
        [
          "Date",
          "Deposit Slip No.",
          "Bank",
          "Account Name",
          "Account No.",
          "Depositor",
          "Amount",
          "Deposit Type",
          "Reference No.",
          "Status",
          "Remarks",
          "Attachment",
        ];

      headerRow.eachCell(
        (
          cell
        ) => {
          cell.font =
            {
              bold:
                true,

              color: {
                argb:
                  "FFFFFFFF",
              },
            };

          cell.fill =
            {
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
        }
      );

      // RECORDS

      records.forEach(
        (
          record
        ) => {
          const parts =
            record.deposit_date
              ?.split(
                "-"
              ) || [];

          let excelDate:
            | Date
            | null =
            null;

          if (
            parts.length ===
            3
          ) {
            excelDate =
              new Date(
                Number(
                  parts[0]
                ),

                Number(
                  parts[1]
                ) - 1,

                Number(
                  parts[2]
                )
              );
          }

          const row =
            worksheet.addRow(
              [
                excelDate,

                record.deposit_slip_no ||
                  "",

                record.bank ||
                  "",

                record.account_name ||
                  "",

                record.account_no ||
                  "",

                record.depositor ||
                  "",

                Number(
                  record.amount ||
                    0
                ),

                record.deposit_type ||
                  "Cash",

                record.reference_no ||
                  "",

                record.status ||
                  "Pending",

                record.remarks ||
                  "",

                record.attachment_url
                  ? "View Proof"
                  : "",
              ]
            );

          row.getCell(
            1
          ).numFmt =
            "mmmm d, yyyy";

          row.getCell(
            7
          ).numFmt =
            "₱#,##0.00";

          if (
            record.attachment_url
          ) {
            row.getCell(
              12
            ).value =
              {
                text:
                  "View Proof",

                hyperlink:
                  record.attachment_url,
              };
          }

          row.eachCell(
            (
              cell
            ) => {
              cell.border =
                {
                  top: {
                    style:
                      "thin",
                  },

                  bottom: {
                    style:
                      "thin",
                  },

                  left: {
                    style:
                      "thin",
                  },

                  right: {
                    style:
                      "thin",
                  },
                };

              cell.alignment =
                {
                  vertical:
                    "middle",

                  wrapText:
                    true,
                };
            }
          );
        }
      );

      // TOTAL

      const totalRow =
        worksheet.addRow(
          [
            "OVERALL TOTAL",
            "",
            "",
            "",
            "",
            "",
            records.reduce(
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
            ),
            "",
            "",
            "",
            "",
            "",
          ]
        );

      totalRow.font =
        {
          bold:
            true,

          color: {
            argb:
              "FFFFFFFF",
          },
        };

      totalRow.eachCell(
        (
          cell
        ) => {
          cell.fill =
            {
              type:
                "pattern",

              pattern:
                "solid",

              fgColor: {
                argb:
                  "1F3B64",
              },
            };
        }
      );

      totalRow.getCell(
        7
      ).numFmt =
        "₱#,##0.00";

      worksheet.autoFilter =
        {
          from:
            "A4",

          to:
            "L4",
        };

      worksheet.views =
        [
          {
            state:
              "frozen",

            ySplit:
              4,
          },
        ];

      worksheet.pageSetup =
        {
          orientation:
            "landscape",

          paperSize:
            9,

          fitToPage:
            true,

          fitToWidth:
            1,

          fitToHeight:
            0,
        };

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob =
        new Blob(
          [
            buffer,
          ],
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

      link.href =
        url;

      link.download =
        `${location.name.replace(
          /[^a-z0-9]/gi,
          "_"
        )}_Deposit_Slips.xlsx`;

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
        "Deposit Slip Excel successfully exported!"
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "Hindi ma-export ang Deposit Slip Excel."
      );
    } finally {
      setExporting(
        false
      );
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

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>

                <h1 className="text-3xl font-bold text-slate-900">
                  Deposit Slips
                </h1>

                <div className="flex items-center gap-3 mt-2">

                  <p className="text-gray-500">
                    {location?.name ||
                      "Location"}{" "}
                    - Bank Deposit Records
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

                {/* EXPORT */}

                <button
                  type="button"
                  onClick={
                    exportToExcel
                  }
                  disabled={
                    exporting ||
                    records.length ===
                      0
                  }
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-medium"
                >
                  {exporting
                    ? "Exporting..."
                    : "📊 Export Excel"}
                </button>

                {/* ADD - ADMIN ONLY */}

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
                      : "+ Add Deposit"}
                  </button>

                )}

              </div>

            </div>

          </div>

          {/* OFFICE STAFF NOTICE */}

          {!loadingRole &&
            !isAdmin && (

            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

              <p className="font-semibold text-blue-900">
                👤 Office Staff Access
              </p>

              <p className="text-sm text-blue-700 mt-1">
                You can view Deposit Slip records, open proof attachments, search, and export to Excel. Adding, editing, and deleting are restricted to Admin users.
              </p>

            </div>

          )}

          {/* FORM - ADMIN ONLY */}

          {showForm &&
            isAdmin && (

            <div className="bg-white rounded-xl shadow p-6 mb-8">

              <div className="mb-6">

                <h2 className="text-xl font-bold text-slate-900">
                  {editingId !==
                  null
                    ? "Edit Deposit Slip"
                    : "Add Deposit Slip"}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Enter the deposit details and attach a photo of the deposit slip or proof.
                </p>

              </div>

              <form
                onSubmit={
                  saveRecord
                }
              >

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                  {/* DATE */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Deposit Date *
                    </label>

                    <input
                      type="date"
                      value={
                        form.deposit_date
                      }
                      onChange={(e) =>
                        updateField(
                          "deposit_date",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* SLIP */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Deposit Slip No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.deposit_slip_no
                      }
                      onChange={(e) =>
                        updateField(
                          "deposit_slip_no",
                          e.target.value
                        )
                      }
                      placeholder="DS-0001"
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* BANK */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Bank *
                    </label>

                    <input
                      type="text"
                      value={
                        form.bank
                      }
                      onChange={(e) =>
                        updateField(
                          "bank",
                          e.target.value
                        )
                      }
                      placeholder="Example: BDO"
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* ACCOUNT NAME */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Account Name
                    </label>

                    <input
                      type="text"
                      value={
                        form.account_name
                      }
                      onChange={(e) =>
                        updateField(
                          "account_name",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* ACCOUNT NO */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Account No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.account_no
                      }
                      onChange={(e) =>
                        updateField(
                          "account_no",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* DEPOSITOR */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Depositor *
                    </label>

                    <input
                      type="text"
                      value={
                        form.depositor
                      }
                      onChange={(e) =>
                        updateField(
                          "depositor",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* AMOUNT */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Amount *
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
                      placeholder="0.00"
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* TYPE */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Deposit Type
                    </label>

                    <select
                      value={
                        form.deposit_type
                      }
                      onChange={(e) =>
                        updateField(
                          "deposit_type",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    >

                      <option value="Cash">
                        Cash
                      </option>

                      <option value="Check">
                        Check
                      </option>

                      <option value="Cash + Check">
                        Cash + Check
                      </option>

                      <option value="Online Transfer">
                        Online Transfer
                      </option>

                    </select>

                  </div>

                  {/* REFERENCE */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Reference No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.reference_no
                      }
                      onChange={(e) =>
                        updateField(
                          "reference_no",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* STATUS */}

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

                      <option value="Deposited">
                        Deposited
                      </option>

                      <option value="Verified">
                        Verified
                      </option>

                      <option value="Cancelled">
                        Cancelled
                      </option>

                    </select>

                  </div>

                  {/* ATTACHMENT */}

                  <div className="md:col-span-3">

                    <label className="block text-sm font-medium mb-2">
                      📎 Deposit Slip / Proof Photo
                    </label>

                    <div className="border rounded-xl p-4 bg-slate-50">

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handleFileChange
                        }
                        className="block w-full text-sm"
                      />

                      <p className="text-xs text-gray-500 mt-2">
                        Upload JPG, PNG, WEBP or another image. Maximum 5MB.
                      </p>

                      {attachmentFile && (

                        <div className="mt-3 bg-blue-50 border border-blue-100 p-3 rounded-lg">

                          <p className="text-sm text-blue-800 font-medium">
                            Selected:
                          </p>

                          <p className="text-sm text-blue-700">
                            {attachmentFile.name}
                          </p>

                        </div>

                      )}

                      {form.attachment_url && (

                        <button
                          type="button"
                          onClick={() =>
                            viewAttachment(
                              form.attachment_url
                            )
                          }
                          className="mt-3 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg"
                        >
                          👁 View Current Proof
                        </button>

                      )}

                    </div>

                  </div>

                  {/* REMARKS */}

                  <div className="md:col-span-3">

                    <label className="block text-sm font-medium mb-2">
                      Remarks
                    </label>

                    <textarea
                      value={
                        form.remarks
                      }
                      onChange={(e) =>
                        updateField(
                          "remarks",
                          e.target.value
                        )
                      }
                      rows={3}
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                </div>

                {/* BUTTONS */}

                <div className="flex gap-3 mt-6">

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      uploading
                    }
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium"
                  >
                    {uploading
                      ? "Uploading Photo..."
                      : saving
                      ? "Saving..."
                      : editingId !==
                        null
                      ? "Save Changes"
                      : "Save Deposit"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearForm
                    }
                    disabled={
                      saving ||
                      uploading
                    }
                    className="border px-6 py-3 rounded-lg hover:bg-gray-50"
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
              placeholder="🔎 Search slip no., bank, depositor, account..."
              className="w-full border rounded-lg p-3"
            />

          </div>

          {/* TABLE */}

          <div className="bg-white rounded-xl shadow overflow-hidden">

            <div className="p-6 border-b flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Deposit Slip Records
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {filteredRecords.length} record
                  {filteredRecords.length !==
                  1
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
                Loading deposit slips...
              </div>

            ) : filteredRecords.length ===
              0 ? (

              <div className="p-10 text-center text-gray-500">
                No deposit slip records found.
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[1650px]">

                  <thead>

                    <tr className="bg-[#1F3B64] text-white">

                      <th className="px-4 py-4 text-left">
                        Date
                      </th>

                      <th className="px-4 py-4 text-left">
                        Deposit Slip No.
                      </th>

                      <th className="px-4 py-4 text-left">
                        Bank
                      </th>

                      <th className="px-4 py-4 text-left">
                        Account Name
                      </th>

                      <th className="px-4 py-4 text-left">
                        Account No.
                      </th>

                      <th className="px-4 py-4 text-left">
                        Depositor
                      </th>

                      <th className="px-4 py-4 text-right">
                        Amount
                      </th>

                      <th className="px-4 py-4 text-left">
                        Deposit Type
                      </th>

                      <th className="px-4 py-4 text-left">
                        Reference No.
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
                      (
                        record
                      ) => (

                        <tr
                          key={
                            record.id
                          }
                          className="border-b hover:bg-slate-50"
                        >

                          <td className="px-4 py-4 whitespace-nowrap">
                            {formatDate(
                              record.deposit_date
                            )}
                          </td>

                          <td className="px-4 py-4 font-medium">
                            {record.deposit_slip_no ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.bank ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.account_name ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.account_no ||
                              "—"}
                          </td>

                          <td className="px-4 py-4">
                            {record.depositor ||
                              "—"}
                          </td>

                          <td className="px-4 py-4 text-right font-semibold">
                            {formatCurrency(
                              Number(
                                record.amount ||
                                  0
                              )
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {record.deposit_type ||
                              "Cash"}
                          </td>

                          <td className="px-4 py-4">
                            {record.reference_no ||
                              "—"}
                          </td>

                          <td className="px-4 py-4 text-center">

                            <span className="px-3 py-1 rounded-full bg-slate-100 text-sm">
                              {record.status ||
                                "Pending"}
                            </span>

                          </td>

                          {/* ATTACHMENT */}

                          <td className="px-4 py-4 text-center">

                            {record.attachment_url ? (

                              <button
                                type="button"
                                onClick={() =>
                                  viewAttachment(
                                    record.attachment_url!
                                  )
                                }
                                className="inline-flex bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                              >
                                📎 View Proof
                              </button>

                            ) : (

                              <span className="text-gray-400">
                                —
                              </span>

                            )}

                          </td>

                          {/* ACTION */}

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
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
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
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm"
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

                  <tfoot>

                    <tr className="bg-[#1F3B64] text-white font-bold">

                      <td
                        colSpan={
                          6
                        }
                        className="px-4 py-4 text-right"
                      >
                        OVERALL TOTAL
                      </td>

                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {formatCurrency(
                          overallTotal
                        )}
                      </td>

                      <td
                        colSpan={
                          5
                        }
                      />

                    </tr>

                  </tfoot>

                </table>

              </div>

            )}

          </div>

        </section>

      </div>

    </main>
  );
}