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

type TelegraphicTransfer = {
  id: number;
  location_id: number;
  transfer_date: string;

  tt_ref_no: string | null;

  applicant_sender: string | null;

  beneficiary_name: string | null;

  beneficiary_bank: string | null;

  beneficiary_account_no:
    | string
    | null;

  swift_branch_code:
    | string
    | null;

  amount: number | null;

  currency: string | null;

  charges: number | null;

  total_debited: number | null;

  purpose_of_payment:
    | string
    | null;

  status: string | null;

  remarks: string | null;

  attachment_url:
    | string
    | null;

  created_at: string;
};

type Location = {
  id: number;
  name: string;
};

const emptyForm = {
  transfer_date:
    new Date()
      .toISOString()
      .slice(0, 10),

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
};

export default function TelegraphicTransferPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const locationId =
    Number(params.id);

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
    useState<
      TelegraphicTransfer[]
    >([]);

  const [
    form,
    setForm,
  ] =
    useState(emptyForm);

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

  const [
    attachmentFile,
    setAttachmentFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    setLoading(true);

    const {
      data: locationData,
      error: locationError,
    } =
      await supabase
        .from("locations")
        .select("id, name")
        .eq(
          "id",
          locationId
        )
        .single();

    if (locationError) {
      console.error(
        locationError
      );

      alert(
        "Hindi ma-load ang location: " +
          locationError.message
      );

      setLoading(false);

      return;
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
          "telegraphic_transfers"
        )
        .select("*")
        .eq(
          "location_id",
          locationId
        )
        .order(
          "transfer_date",
          {
            ascending:
              false,
          }
        );

    if (error) {
      console.error(
        error
      );

      alert(
        "Hindi makuha ang Telegraphic Transfers: " +
          error.message
      );

      setLoading(false);

      return;
    }

    setRecords(
      (data || []) as TelegraphicTransfer[]
    );

    setLoading(false);
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

    loadData();
  }, [locationId]);

  // =====================================================
  // UPDATE FIELD
  // =====================================================

  function updateField(
    field:
      keyof typeof emptyForm,
    value: string
  ) {
    setForm(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
  }

  // =====================================================
  // CLEAR FORM
  // =====================================================

  function clearForm() {
    setForm(
      emptyForm
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
  // CALCULATE TOTAL
  // =====================================================

  function calculateTotal() {
    const amount =
      Number(
        form.amount
      ) || 0;

    const charges =
      Number(
        form.charges
      ) || 0;

    return (
      amount +
      charges
    );
  }

  // =====================================================
  // FILE SELECT
  // =====================================================

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) {
      setAttachmentFile(
        null
      );

      return;
    }

    // Image only
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

    // Maximum 5 MB
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
  // UPLOAD ATTACHMENT
  // =====================================================

  async function uploadAttachment(
    file: File
  ) {
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
          .slice(2, 8)}.${safeExtension}`;

      const filePath =
        `telegraphic/${locationId}/${fileName}`;

      const {
        error: uploadError,
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

      if (
        uploadError
      ) {
        console.error(
          "TT attachment upload error:",
          uploadError
        );

        throw new Error(
          uploadError.message
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

      return (
        data.publicUrl
      );
    } finally {
      setUploading(
        false
      );
    }
  }

  // =====================================================
  // VIEW ATTACHMENT WITH SIGNED URL
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
        alert("Invalid attachment URL.");
        return;
      }

      const filePath =
        decodeURIComponent(
          url.substring(
            markerIndex + marker.length
          )
        );

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
  // SAVE RECORD
  // =====================================================

  async function saveRecord(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (
      !form.transfer_date
    ) {
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
      Number(
        form.amount
      ) || 0;

    const charges =
      Number(
        form.charges
      ) || 0;

    const totalDebited =
      amount +
      charges;

    setSaving(
      true
    );

    try {
      let finalAttachmentUrl =
        form.attachment_url ||
        null;

      // Upload only when a new file is selected
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
              "telegraphic_transfers"
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

        if (
          error
        ) {
          alert(
            "Hindi ma-update ang record: " +
              error.message
          );

          return;
        }

        alert(
          "Telegraphic Transfer successfully updated!"
        );
      } else {
        // =================================================
        // INSERT
        // =================================================

        const {
          error,
        } =
          await supabase
            .from(
              "telegraphic_transfers"
            )
            .insert(
              payload
            );

        if (
          error
        ) {
          alert(
            "Hindi ma-save ang record: " +
              error.message
          );

          return;
        }

        alert(
          "Telegraphic Transfer successfully saved!"
        );
      }

      setForm(
        emptyForm
      );

      setAttachmentFile(
        null
      );

      setEditingId(
        null
      );

      setShowForm(
        false
      );

      await loadData();
    } catch (error) {
      console.error(
        "Save TT error:",
        error
      );

      alert(
        "Hindi ma-save ang Telegraphic Transfer: " +
          (error instanceof Error
            ? error.message
            : "Unknown error")
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
  // EDIT
  // =====================================================

  function startEdit(
    record: TelegraphicTransfer
  ) {
    setEditingId(
      record.id
    );

    setAttachmentFile(
      null
    );

    setForm({
      transfer_date:
        record.transfer_date ||
        "",

      tt_ref_no:
        record.tt_ref_no ||
        "",

      applicant_sender:
        record.applicant_sender ||
        "",

      beneficiary_name:
        record.beneficiary_name ||
        "",

      beneficiary_bank:
        record.beneficiary_bank ||
        "",

      beneficiary_account_no:
        record.beneficiary_account_no ||
        "",

      swift_branch_code:
        record.swift_branch_code ||
        "",

      amount:
        record.amount?.toString() ||
        "",

      currency:
        record.currency ||
        "PHP",

      charges:
        record.charges?.toString() ||
        "",

      purpose_of_payment:
        record.purpose_of_payment ||
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
  // DELETE RECORD
  // =====================================================

  async function deleteRecord(
    record: TelegraphicTransfer
  ) {
    const confirmed =
      window.confirm(
        `Sigurado ka bang gusto mong i-delete ang TT record${
          record.tt_ref_no
            ? ` "${record.tt_ref_no}"`
            : ""
        }?

Note: Hindi mabubura ang uploaded attachment sa Storage.`
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
          "telegraphic_transfers"
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

    if (
      error
    ) {
      alert(
        "Hindi ma-delete ang record: " +
          error.message
      );

      return;
    }

    alert(
      "Telegraphic Transfer successfully deleted! Attachment remains in Storage."
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
  // OVERALL TOTAL
  // =====================================================

  const overallTotal =
    filteredRecords.reduce(
      (
        sum,
        record
      ) =>
        sum +
        Number(
          record.total_debited ||
            0
        ),
      0
    );

  // =====================================================
  // CURRENCY
  // =====================================================

  const formatCurrency = (
    amount: number,
    currency = "PHP"
  ) => {
    try {
      return new Intl.NumberFormat(
        "en-PH",
        {
          style:
            "currency",

          currency:
            currency ||
            "PHP",

          minimumFractionDigits:
            2,
        }
      ).format(
        amount
      );
    } catch {
      return `${currency} ${amount.toFixed(
        2
      )}`;
    }
  };

  // =====================================================
  // DATE
  // =====================================================

  function formatDate(
    date: string
  ) {
    if (
      !date
    ) {
      return "";
    }

    // Avoid timezone shift
    const parts =
      date.split("-");

    if (
      parts.length !==
      3
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
  // EXCEL EXPORT
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
        "Walang Telegraphic Transfer records na ie-export."
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

      workbook.lastModifiedBy =
        "DCYES Finance System";

      workbook.created =
        new Date();

      workbook.modified =
        new Date();

      const worksheet =
        workbook.addWorksheet(
          "Telegraphic Transfer"
        );

      worksheet.columns =
        [
          {
            header:
              "Date",

            key:
              "date",

            width: 20,
          },

          {
            header:
              "TT Ref. No.",

            key:
              "ref",

            width: 18,
          },

          {
            header:
              "Applicant / Sender",

            key:
              "sender",

            width: 25,
          },

          {
            header:
              "Beneficiary Name",

            key:
              "beneficiary",

            width: 25,
          },

          {
            header:
              "Beneficiary Bank",

            key:
              "bank",

            width: 25,
          },

          {
            header:
              "Account No.",

            key:
              "account",

            width: 22,
          },

          {
            header:
              "SWIFT / Branch Code",

            key:
              "swift",

            width: 22,
          },

          {
            header:
              "Amount",

            key:
              "amount",

            width: 18,
          },

          {
            header:
              "Currency",

            key:
              "currency",

            width: 12,
          },

          {
            header:
              "Charges",

            key:
              "charges",

            width: 18,
          },

          {
            header:
              "Total Debited",

            key:
              "total",

            width: 20,
          },

          {
            header:
              "Purpose of Payment",

            key:
              "purpose",

            width: 28,
          },

          {
            header:
              "Status",

            key:
              "status",

            width: 15,
          },

          {
            header:
              "Remarks",

            key:
              "remarks",

            width: 28,
          },

          {
            header:
              "Attachment",

            key:
              "attachment",

            width: 45,
          },
        ];

      // TITLE

      worksheet.mergeCells(
        "A1:O1"
      );

      const titleCell =
        worksheet.getCell(
          "A1"
        );

      titleCell.value =
        `${location.name.toUpperCase()} - TELEGRAPHIC TRANSFER`;

      titleCell.font =
        {
          name:
            "Calibri",

          size: 16,

          bold: true,

          color: {
            argb:
              "FFFFFFFF",
          },
        };

      titleCell.fill =
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

      titleCell.alignment =
        {
          horizontal:
            "center",

          vertical:
            "middle",
        };

      worksheet.getRow(
        1
      ).height = 30;

      // SUBTITLE

      worksheet.mergeCells(
        "A2:O2"
      );

      const subtitle =
        worksheet.getCell(
          "A2"
        );

      subtitle.value =
        "DCYES";

      subtitle.font =
        {
          name:
            "Calibri",

          size: 11,

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

          vertical:
            "middle",
        };

      worksheet.getRow(
        2
      ).height = 22;

      worksheet.getRow(
        3
      ).height = 8;

      // HEADER

      const headerRow =
        worksheet.getRow(
          4
        );

      headerRow.values =
        [
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

      headerRow.height =
        34;

      headerRow.eachCell(
        (cell) => {
          cell.font =
            {
              name:
                "Calibri",

              size: 10,

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
        }
      );

      // RECORDS

      records.forEach(
        (record) => {
          const dateParts =
            record.transfer_date
              ?.split(
                "-"
              ) || [];

          let excelDate:
            | Date
            | null =
            null;

          if (
            dateParts.length ===
            3
          ) {
            excelDate =
              new Date(
                Number(
                  dateParts[0]
                ),

                Number(
                  dateParts[1]
                ) - 1,

                Number(
                  dateParts[2]
                )
              );
          }

          const row =
            worksheet.addRow(
              [
                excelDate,

                record.tt_ref_no ||
                  "",

                record.applicant_sender ||
                  "",

                record.beneficiary_name ||
                  "",

                record.beneficiary_bank ||
                  "",

                record.beneficiary_account_no ||
                  "",

                record.swift_branch_code ||
                  "",

                Number(
                  record.amount ||
                    0
                ),

                record.currency ||
                  "PHP",

                Number(
                  record.charges ||
                    0
                ),

                Number(
                  record.total_debited ||
                    0
                ),

                record.purpose_of_payment ||
                  "",

                record.status ||
                  "Pending",

                record.remarks ||
                  "",

                record.attachment_url ||
                  "",
              ]
            );

          row.height =
            24;

          row.eachCell(
            (
              cell,
              index
            ) => {
              cell.font =
                {
                  name:
                    "Calibri",

                  size: 10,
                };

              cell.alignment =
                {
                  vertical:
                    "middle",

                  horizontal:
                    index ===
                      8 ||
                    index ===
                      10 ||
                    index ===
                      11
                      ? "right"
                      : index ===
                        1
                      ? "center"
                      : "left",

                  wrapText:
                    true,
                };

              cell.border =
                {
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

          // Make Attachment clickable in Excel
          if (
            record.attachment_url
          ) {
            row.getCell(
              15
            ).value =
              {
                text:
                  "View Attachment",

                hyperlink:
                  record.attachment_url,
              };
          }
        }
      );

      // OVERALL TOTAL

      const totalRow =
        worksheet.addRow(
          [
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
            overallTotal,
            "",
            "",
            "",
            "",
          ]
        );

      totalRow.height =
        30;

      totalRow.eachCell(
        (cell) => {
          cell.font =
            {
              name:
                "Calibri",

              size: 11,

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
            };

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
        }
      );

      totalRow.getCell(
        11
      ).numFmt =
        "₱#,##0.00";

      worksheet.autoFilter =
        {
          from:
            "A4",

          to:
            "O4",
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

      worksheet.pageSetup.printTitlesRow =
        "1:4";

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
      console.error(
        error
      );

      alert(
        "Hindi ma-export ang Telegraphic Transfer Excel."
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
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}`
                )
              }
              className="text-blue-600 hover:underline mb-4"
            >
              ← Back to Location
            </button>

            <div className="flex items-center justify-between gap-4">

              <div>

                <h1 className="text-3xl font-bold text-slate-900">
                  Telegraphic Transfer
                </h1>

                <p className="text-gray-500 mt-2">
                  {location?.name ||
                    "Location"}{" "}
                  - Manage TT application records
                </p>

              </div>

              <div className="flex gap-3">

                <button
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

                <button
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

              </div>

            </div>

          </div>

          {/* FORM */}

          {showForm && (

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

                  {/* DATE */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Transfer Date *
                    </label>

                    <input
                      type="date"
                      value={
                        form.transfer_date
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "transfer_date",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* TT REF */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      TT Ref. No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.tt_ref_no
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "tt_ref_no",
                          e.target.value
                        )
                      }
                      placeholder="TT-0001"
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
                      onChange={(
                        e
                      ) =>
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

                  {/* SENDER */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Applicant / Sender *
                    </label>

                    <input
                      type="text"
                      value={
                        form.applicant_sender
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "applicant_sender",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* BENEFICIARY */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Beneficiary Name *
                    </label>

                    <input
                      type="text"
                      value={
                        form.beneficiary_name
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "beneficiary_name",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                      required
                    />

                  </div>

                  {/* BANK */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Beneficiary Bank
                    </label>

                    <input
                      type="text"
                      value={
                        form.beneficiary_bank
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "beneficiary_bank",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* ACCOUNT */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Account No.
                    </label>

                    <input
                      type="text"
                      value={
                        form.beneficiary_account_no
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "beneficiary_account_no",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* SWIFT */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      SWIFT / Branch Code
                    </label>

                    <input
                      type="text"
                      value={
                        form.swift_branch_code
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "swift_branch_code",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* CURRENCY */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Currency
                    </label>

                    <select
                      value={
                        form.currency
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "currency",
                          e.target.value
                        )
                      }
                      className="w-full border rounded-lg p-3"
                    >

                      <option value="PHP">
                        PHP
                      </option>

                      <option value="USD">
                        USD
                      </option>

                      <option value="EUR">
                        EUR
                      </option>

                      <option value="GBP">
                        GBP
                      </option>

                      <option value="JPY">
                        JPY
                      </option>

                      <option value="SGD">
                        SGD
                      </option>

                    </select>

                  </div>

                  {/* AMOUNT */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Amount
                    </label>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        form.amount
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "amount",
                          e.target.value
                        )
                      }
                      placeholder="0.00"
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* CHARGES */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Charges
                    </label>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        form.charges
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "charges",
                          e.target.value
                        )
                      }
                      placeholder="0.00"
                      className="w-full border rounded-lg p-3"
                    />

                  </div>

                  {/* TOTAL */}

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Total Debited
                    </label>

                    <div className="w-full border rounded-lg p-3 bg-slate-100 font-bold text-slate-900">
                      {formatCurrency(
                        calculateTotal(),
                        form.currency
                      )}
                    </div>

                  </div>

                  {/* ATTACHMENT */}

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
                        className="block w-full text-sm"
                      />

                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG, WEBP or other image format. Maximum 5MB.
                      </p>

                      {attachmentFile && (

                        <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3">

                          <p className="text-sm font-medium text-blue-800">
                            New attachment selected:
                          </p>

                          <p className="text-sm text-blue-700 mt-1 break-all">
                            {
                              attachmentFile.name
                            }
                          </p>

                        </div>

                      )}

                      {form.attachment_url && (

                        <div className="mt-4">

                          <p className="text-sm text-gray-500 mb-2">
                            Current attachment
                          </p>

                          <div className="flex flex-wrap gap-3">

                            <button
                              type="button"
                              onClick={() =>
                                viewAttachment(
                                  form.attachment_url
                                )
                              }
                              className="inline-flex items-center bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm"
                            >
                              👁 View Current Attachment
                            </button>

                            {attachmentFile && (

                              <span className="text-xs text-orange-600 self-center">
                                The new image will replace the attachment link in this record after saving. The old Storage file will remain.
                              </span>

                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  </div>

                  {/* PURPOSE */}

                  <div className="md:col-span-3">

                    <label className="block text-sm font-medium mb-2">
                      Purpose of Payment
                    </label>

                    <textarea
                      value={
                        form.purpose_of_payment
                      }
                      onChange={(
                        e
                      ) =>
                        updateField(
                          "purpose_of_payment",
                          e.target.value
                        )
                      }
                      rows={3}
                      className="w-full border rounded-lg p-3"
                    />

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
                      onChange={(
                        e
                      ) =>
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
                      ? "Uploading Attachment..."
                      : saving
                      ? "Saving..."
                      : editingId !==
                        null
                      ? "Save Changes"
                      : "Save Transfer"}
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
                    className="border px-6 py-3 rounded-lg hover:bg-gray-50 disabled:opacity-50"
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
              onChange={(
                e
              ) =>
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

                <h2 className="text-xl font-bold text-slate-900">
                  Telegraphic Transfer Records
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
                Loading records...
              </div>

            ) : filteredRecords.length ===
              0 ? (

              <div className="p-10 text-center text-gray-500">
                No Telegraphic Transfer records found.
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[1750px]">

                  <thead>

                    <tr className="bg-[#1F3B64] text-white">

                      <th className="px-4 py-4 text-left text-sm">
                        Date
                      </th>

                      <th className="px-4 py-4 text-left text-sm">
                        TT Ref. No.
                      </th>

                      <th className="px-4 py-4 text-left text-sm">
                        Applicant / Sender
                      </th>

                      <th className="px-4 py-4 text-left text-sm">
                        Beneficiary
                      </th>

                      <th className="px-4 py-4 text-left text-sm">
                        Bank
                      </th>

                      <th className="px-4 py-4 text-left text-sm">
                        Account No.
                      </th>

                      <th className="px-4 py-4 text-right text-sm">
                        Amount
                      </th>

                      <th className="px-4 py-4 text-right text-sm">
                        Charges
                      </th>

                      <th className="px-4 py-4 text-right text-sm">
                        Total Debited
                      </th>

                      <th className="px-4 py-4 text-left text-sm">
                        Status
                      </th>

                      <th className="px-4 py-4 text-center text-sm">
                        Attachment
                      </th>

                      <th className="px-4 py-4 text-center text-sm">
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

                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            {formatCurrency(
                              Number(
                                record.amount ||
                                  0
                              ),
                              record.currency ||
                                "PHP"
                            )}
                          </td>

                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            {formatCurrency(
                              Number(
                                record.charges ||
                                  0
                              ),
                              record.currency ||
                                "PHP"
                            )}
                          </td>

                          <td className="px-4 py-4 text-right font-semibold whitespace-nowrap">
                            {formatCurrency(
                              Number(
                                record.total_debited ||
                                  0
                              ),
                              record.currency ||
                                "PHP"
                            )}
                          </td>

                          <td className="px-4 py-4">

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

                          {/* ACTIONS */}

                          <td className="px-4 py-4">

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

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                  <tfoot>

                    <tr className="bg-[#1F3B64] text-white font-bold">

                      <td
                        colSpan={
                          8
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
                          3
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