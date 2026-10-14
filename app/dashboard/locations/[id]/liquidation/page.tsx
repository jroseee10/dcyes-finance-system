"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

type Liquidation = {
  id: number;
  location_id: number;
  liquidation_date: string;
  payee: string;
  address: string | null;
  tin: string | null;
  description: string | null;
  amount: number;
  tax_type: string | null;
  receipt_url: string | null;
  remarks: string | null;
  status: string | null;
};

type CurrentUserProfile = {
  name: string;
  email: string;
  position: string;
};

export default function LiquidationPage() {
  const params = useParams();
  const router = useRouter();

  const locationId = Number(params.id);

  const [locationName, setLocationName] = useState("");
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  const [currentProfile, setCurrentProfile] =
    useState<CurrentUserProfile | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    liquidation_date: "",
    payee: "",
    address: "",
    tin: "",
    description: "",
    amount: "",
    tax_type: "Non-Tax",
    receipt_url: "",
    remarks: "",
    status: "Pending",
  });

  useEffect(() => {
    if (!locationId) return;

    loadCurrentUserRole();
    loadLocation();
    loadLiquidations();
  }, [locationId]);

  async function loadCurrentUserRole() {
    setLoadingRole(true);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user?.email) {
        console.error("Auth error:", authError);
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
        console.error("Profile error:", profileError);
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
        email: profile?.email || authData.user.email,
        position: profile?.position || "",
      });
    } catch (error) {
      console.error("Role check error:", error);
      setIsAdmin(false);
    } finally {
      setLoadingRole(false);
    }
  }

  async function loadLocation() {
    const { data, error } = await supabase
      .from("locations")
      .select("name")
      .eq("id", locationId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setLocationName(data?.name || "");
  }

  async function loadLiquidations() {
    setLoading(true);

    const { data, error } = await supabase
      .from("liquidations")
      .select("*")
      .eq("location_id", locationId)
      .order("liquidation_date", {
        ascending: false,
      });

    if (error) {
      console.error(error);

      alert(
        "Hindi ma-load ang liquidation records: " +
          error.message
      );

      setLoading(false);
      return;
    }

    setLiquidations(data || []);
    setLoading(false);
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
          module: "Liquidation",
          record_id: recordId,
          location_id: locationId,
          location_name: locationName,
          description,
        });

      if (error) {
        console.error("Activity log error:", error);
      }
    } catch (error) {
      console.error(
        "Activity log unexpected error:",
        error
      );
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function clearForm() {
    setEditingId(null);

    setForm({
      liquidation_date: "",
      payee: "",
      address: "",
      tin: "",
      description: "",
      amount: "",
      tax_type: "Non-Tax",
      receipt_url: "",
      remarks: "",
      status: "Pending",
    });
  }

  async function uploadReceipt(file: File) {
    if (!isAdmin) {
      alert("Admin only ang pag-upload o pagpalit ng receipt.");
      return;
    }

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Maximum receipt size is 5MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    setUploading(true);

    const fileExt =
      file.name.split(".").pop() || "jpg";

    const fileName =
      `${locationId}-${Date.now()}.${fileExt}`;

    const filePath =
      `${locationId}/${fileName}`;

    const { error: uploadError } =
      await supabase.storage
        .from("receipts")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

    if (uploadError) {
      console.error(uploadError);

      alert(
        "Hindi ma-upload ang receipt:\n" +
          uploadError.message
      );

      setUploading(false);
      return;
    }

    const { data } =
      supabase.storage
        .from("receipts")
        .getPublicUrl(filePath);

    setForm((prev) => ({
      ...prev,
      receipt_url: data.publicUrl,
    }));

    setUploading(false);

    alert("Receipt uploaded successfully! ✅");
  }

  async function saveLiquidation(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!isAdmin) {
      alert("Admin only ang pag-add o pag-edit ng liquidation.");
      return;
    }

    if (!form.liquidation_date) {
      alert("Ilagay ang date.");
      return;
    }

    if (!form.payee.trim()) {
      alert("Ilagay ang payee.");
      return;
    }

    if (!form.amount) {
      alert("Ilagay ang amount.");
      return;
    }

    setSaving(true);

    const payload = {
      location_id: locationId,
      liquidation_date:
        form.liquidation_date,
      payee: form.payee.trim(),
      address:
        form.address.trim() || null,
      tin:
        form.tin.trim() || null,
      description:
        form.description.trim() || null,
      amount: Number(form.amount),
      tax_type: form.tax_type,
      receipt_url:
        form.receipt_url || null,
      remarks:
        form.remarks.trim() || null,
      status: form.status || "Pending",
    };

    if (editingId !== null) {
      const { error } = await supabase
        .from("liquidations")
        .update(payload)
        .eq("id", editingId)
        .eq("location_id", locationId);

      if (error) {
        console.error(error);
        alert(
          "Hindi na-update ang liquidation:\n" +
            error.message
        );
        setSaving(false);
        return;
      }

      await addActivityLog({
        action: "Updated",
        recordId: editingId,
        description: `Updated liquidation for ${form.payee.trim()} - ₱${Number(
          form.amount
        ).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      });

      alert("Liquidation successfully updated! ✅");
    } else {
      const { data: insertedData, error } = await supabase
        .from("liquidations")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert(
          "Hindi na-save ang liquidation:\n" +
            error.message
        );
        setSaving(false);
        return;
      }

      await addActivityLog({
        action: "Added",
        recordId: insertedData.id,
        description: `Added liquidation for ${form.payee.trim()} - ₱${Number(
          form.amount
        ).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      });

      alert("Liquidation successfully saved! ✅");
    }

    clearForm();
    setShowForm(false);

    await loadLiquidations();

    setSaving(false);
  }

  function startEdit(item: Liquidation) {
    if (!isAdmin) {
      alert("Admin only ang pag-edit ng liquidation.");
      return;
    }

    setEditingId(item.id);

    setForm({
      liquidation_date:
        item.liquidation_date || "",
      payee: item.payee || "",
      address: item.address || "",
      tin: item.tin || "",
      description: item.description || "",
      amount:
        item.amount !== null &&
        item.amount !== undefined
          ? String(item.amount)
          : "",
      tax_type:
        item.tax_type || "Non-Tax",
      receipt_url:
        item.receipt_url || "",
      remarks:
        item.remarks || "",
      status:
        item.status || "Pending",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteLiquidation(
    item: Liquidation
  ) {
    if (!isAdmin) {
      alert("Admin only ang pag-delete ng liquidation.");
      return;
    }

    const confirmed = window.confirm(
      `Sigurado ka bang gusto mong i-delete ang liquidation record ni "${item.payee}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("liquidations")
      .delete()
      .eq("id", item.id)
      .eq("location_id", locationId);

    if (error) {
      console.error(error);

      alert(
        "Hindi ma-delete ang record:\n\n" +
          error.message
      );

      return;
    }

    await addActivityLog({
      action: "Deleted",
      recordId: item.id,
      description: `Deleted liquidation for ${item.payee} - ₱${Number(
        item.amount || 0
      ).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    });

    await loadLiquidations();

    alert(
      "Liquidation successfully deleted! ✅"
    );
  }

  const totalAmount =
    liquidations.reduce(
      (total, item) =>
        total + Number(item.amount || 0),
      0
    );

  // =====================================================
  // SAFE EXCEL DATE - NO TIMEZONE SHIFT
  // =====================================================

  function excelDateSerial(dateString: string) {
    if (!dateString) {
      return null;
    }

    const [year, month, day] =
      dateString.split("-").map(Number);

    if (!year || !month || !day) {
      return null;
    }

    const milliseconds = Date.UTC(
      year,
      month - 1,
      day
    );

    return (
      milliseconds /
        (24 * 60 * 60 * 1000) +
      25569
    );
  }

  async function exportToExcel() {
    if (liquidations.length === 0) {
      alert(
        "Walang liquidation records na ie-export."
      );
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();

      workbook.creator =
        "DCYES Finance System";

      workbook.created = new Date();

      const worksheet =
        workbook.addWorksheet(
          "Liquidation",
          {
            pageSetup: {
              orientation: "landscape",
              paperSize: 9,
              fitToPage: true,
              fitToWidth: 1,
              fitToHeight: 0,
            },
          }
        );

      const navy = "FF1E3A8A";
      const blue = "FF2563EB";
      const lightGray = "FFF1F5F9";
      const gray = "FF64748B";
      const dark = "FF0F172A";
      const white = "FFFFFFFF";
      const green = "FF15803D";
      const lightGreen = "FFDCFCE7";

      worksheet.mergeCells("A1:J1");

      const title =
        worksheet.getCell("A1");

      title.value =
        "LIQUIDATION REPORT";

      title.font = {
        bold: true,
        size: 20,
        color: {
          argb: white,
        },
      };

      title.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      title.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: navy,
        },
      };

      worksheet.getRow(1).height = 35;

      worksheet.mergeCells("A2:J2");

      const locationCell =
        worksheet.getCell("A2");

      locationCell.value =
        `Location: ${locationName}`;

      locationCell.font = {
        bold: true,
        size: 13,
        color: {
          argb: dark,
        },
      };

      locationCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.getRow(2).height = 24;

      worksheet.mergeCells("A3:J3");

      const generatedCell =
        worksheet.getCell("A3");

      generatedCell.value =
        `Generated: ${new Date().toLocaleDateString(
          "en-US",
          {
            month: "long",
            day: "numeric",
            year: "numeric",
          }
        )}`;

      generatedCell.font = {
        italic: true,
        size: 10,
        color: {
          argb: gray,
        },
      };

      generatedCell.alignment = {
        horizontal: "center",
      };

      worksheet.addRow([]);

      const headers = [
        "Date",
        "Payee",
        "Address",
        "TIN",
        "Description",
        "Amount",
        "Tax / Non-Tax",
        "Status",
        "Remarks",
        "Receipt",
      ];

      worksheet.addRow(headers);

      const headerRow =
        worksheet.getRow(5);

      headerRow.height = 28;

      headerRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: {
            argb: white,
          },
          size: 11,
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: navy,
          },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };

        cell.border = {
          top: {
            style: "thin",
            color: {
              argb: white,
            },
          },
          bottom: {
            style: "thin",
            color: {
              argb: white,
            },
          },
          left: {
            style: "thin",
            color: {
              argb: white,
            },
          },
          right: {
            style: "thin",
            color: {
              argb: white,
            },
          },
        };
      });

      liquidations.forEach(
        (item, index) => {
          const row =
            worksheet.addRow([
              excelDateSerial(
                item.liquidation_date
              ),
              item.payee || "",
              item.address || "",
              item.tin || "",
              item.description || "",
              Number(item.amount || 0),
              item.tax_type ||
                "Non-Tax",
              item.status ||
                "Pending",
              item.remarks || "",
              item.receipt_url
                ? "View Receipt"
                : "",
            ]);

          row.getCell(1).numFmt =
            "mmmm d, yyyy";

          row.getCell(6).numFmt =
            '₱#,##0.00';

          if (item.receipt_url) {
            row.getCell(10).value = {
              text: "View Receipt",
              hyperlink:
                item.receipt_url,
            };

            row.getCell(10).font = {
              color: {
                argb: blue,
              },
              underline: true,
              bold: true,
            };
          }

          if (index % 2 === 1) {
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: lightGray,
                },
              };
            });
          }

          row.eachCell((cell) => {
            cell.border = {
              top: {
                style: "thin",
                color: {
                  argb: "FFD1D5DB",
                },
              },
              bottom: {
                style: "thin",
                color: {
                  argb: "FFD1D5DB",
                },
              },
              left: {
                style: "thin",
                color: {
                  argb: "FFD1D5DB",
                },
              },
              right: {
                style: "thin",
                color: {
                  argb: "FFD1D5DB",
                },
              },
            };

            cell.alignment = {
              vertical: "middle",
              wrapText: true,
            };
          });

          row.getCell(1).alignment = {
            horizontal: "center",
            vertical: "middle",
          };

          row.getCell(6).alignment = {
            horizontal: "right",
            vertical: "middle",
          };

          row.getCell(7).alignment = {
            horizontal: "center",
            vertical: "middle",
          };

          row.getCell(8).alignment = {
            horizontal: "center",
            vertical: "middle",
          };

          row.getCell(10).alignment = {
            horizontal: "center",
            vertical: "middle",
          };

          if (
            item.tax_type ===
            "With Tax"
          ) {
            row.getCell(7).font = {
              bold: true,
              color: {
                argb: green,
              },
            };

            row.getCell(7).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: lightGreen,
              },
            };
          }
        }
      );

      const totalRowNumber =
        worksheet.rowCount + 2;

      worksheet.mergeCells(
        `A${totalRowNumber}:E${totalRowNumber}`
      );

      const totalLabel =
        worksheet.getCell(
          `A${totalRowNumber}`
        );

      totalLabel.value =
        "OVERALL TOTAL";

      totalLabel.font = {
        bold: true,
        size: 13,
        color: {
          argb: white,
        },
      };

      totalLabel.alignment = {
        horizontal: "right",
        vertical: "middle",
      };

      totalLabel.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: navy,
        },
      };

      const totalCell =
        worksheet.getCell(
          `F${totalRowNumber}`
        );

      totalCell.value = totalAmount;

      totalCell.numFmt =
        '₱#,##0.00';

      totalCell.font = {
        bold: true,
        size: 13,
        color: {
          argb: white,
        },
      };

      totalCell.alignment = {
        horizontal: "right",
        vertical: "middle",
      };

      totalCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: green,
        },
      };

      for (
        let col = 1;
        col <= 10;
        col++
      ) {
        const cell =
          worksheet.getCell(
            totalRowNumber,
            col
          );

        cell.border = {
          top: {
            style: "medium",
            color: {
              argb: navy,
            },
          },
          bottom: {
            style: "medium",
            color: {
              argb: navy,
            },
          },
          left: {
            style: "thin",
            color: {
              argb: white,
            },
          },
          right: {
            style: "thin",
            color: {
              argb: white,
            },
          },
        };
      }

      worksheet.getRow(
        totalRowNumber
      ).height = 28;

      const summaryRowNumber =
        totalRowNumber + 2;

      worksheet.mergeCells(
        `A${summaryRowNumber}:E${summaryRowNumber}`
      );

      worksheet.getCell(
        `A${summaryRowNumber}`
      ).value =
        "TOTAL TRANSACTIONS";

      worksheet.getCell(
        `A${summaryRowNumber}`
      ).font = {
        bold: true,
      };

      worksheet.getCell(
        `F${summaryRowNumber}`
      ).value =
        liquidations.length;

      worksheet.getCell(
        `F${summaryRowNumber}`
      ).font = {
        bold: true,
      };

      worksheet.getColumn(1).width =
        20;

      worksheet.getColumn(2).width =
        28;

      worksheet.getColumn(3).width =
        32;

      worksheet.getColumn(4).width =
        20;

      worksheet.getColumn(5).width =
        32;

      worksheet.getColumn(6).width =
        18;

      worksheet.getColumn(7).width =
        18;

      worksheet.getColumn(8).width =
        16;

      worksheet.getColumn(9).width =
        32;

      worksheet.getColumn(10).width =
        18;

      worksheet.views = [
        {
          state: "frozen",
          ySplit: 5,
        },
      ];

      worksheet.autoFilter = {
        from: "A5",
        to: "J5",
      };

      worksheet.pageSetup.printTitlesRow =
        "1:5";

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob = new Blob(
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
        document.createElement("a");

      link.href = url;

      const safeLocationName =
        locationName
          .replace(
            /[^a-z0-9]/gi,
            "_"
          )
          .replace(
            /_+/g,
            "_"
          );

      const currentDate =
        new Date()
          .toISOString()
          .slice(0, 10);

      link.download =
        `Liquidation_${safeLocationName}_${currentDate}.xlsx`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      alert(
        "Excel file successfully exported! ✅"
      );
    } catch (error) {
      console.error(
        "Excel export error:",
        error
      );

      alert(
        "Hindi ma-export ang Excel file.\n\n" +
          "Check the browser console for details."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <section className="flex-1 p-8">

        {/* HEADER */}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">

          <div>

            <button
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}`
                )
              }
              className="text-sm text-blue-600 hover:underline mb-3"
            >
              ← Back to Location
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Liquidation
            </h1>

            <div className="flex items-center gap-3 mt-1">

              <p className="text-slate-500">
                Location:{" "}
                <span className="font-semibold text-slate-700">
                  {locationName || "Loading..."}
                </span>
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

          <div className="flex flex-wrap gap-3">

            <button
              onClick={exportToExcel}
              disabled={
                liquidations.length === 0
              }
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-5 py-3 rounded-lg font-medium shadow-sm"
            >
              📊 Export Excel
            </button>

            {!loadingRole && isAdmin && (
              <button
                onClick={() => {
                  if (showForm) {
                    clearForm();
                  }

                  setShowForm(!showForm);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium shadow-sm"
              >
                {showForm
                  ? "✕ Close Form"
                  : "+ Add Liquidation"}
              </button>
            )}

          </div>

        </div>

        {!loadingRole &&
          !isAdmin && (

          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

            <p className="font-semibold text-blue-900">
              👤 Office Staff Access
            </p>

            <p className="text-sm text-blue-700 mt-1">
              You can view liquidation records, open receipts, refresh the list, and export to Excel. Adding, editing, and deleting are restricted to Admin users.
            </p>

          </div>

        )}

        {showForm &&
          isAdmin && (

          <form
            onSubmit={
              saveLiquidation
            }
            className="bg-white rounded-xl shadow p-6 mb-8"
          >

            <div className="flex items-center justify-between mb-6">

              <h2 className="text-xl font-bold text-slate-800">
                {editingId !== null
                  ? "Edit Liquidation"
                  : "New Liquidation"}
              </h2>

              {editingId !== null && (
                <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                  Editing Record
                </span>
              )}

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

              <div>
                <label className="block text-sm font-medium mb-2">
                  Date *
                </label>

                <input
                  type="date"
                  name="liquidation_date"
                  value={
                    form.liquidation_date
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Payee *
                </label>

                <input
                  type="text"
                  name="payee"
                  value={
                    form.payee
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Payee name"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Address
                </label>

                <input
                  type="text"
                  name="address"
                  value={
                    form.address
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Complete address"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  TIN
                </label>

                <input
                  type="text"
                  name="tin"
                  value={
                    form.tin
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="000-000-000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>

                <input
                  type="text"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Gas, Foods, Toll Fees..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount *
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="amount"
                  value={
                    form.amount
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tax
                </label>

                <select
                  name="tax_type"
                  value={
                    form.tax_type
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Non-Tax">
                    Non-Tax
                  </option>

                  <option value="With Tax">
                    With Tax
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Status
                </label>

                <select
                  name="status"
                  value={
                    form.status
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Approved">
                    Approved
                  </option>

                  <option value="Completed">
                    Completed
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Receipt Photo
                </label>

                <input
                  type="file"
                  accept="image/*"
                  disabled={
                    uploading
                  }
                  onChange={(e) => {
                    const file =
                      e.target.files?.[0];

                    if (file) {
                      uploadReceipt(
                        file
                      );
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                />

                <p className="text-xs text-slate-400 mt-1">
                  JPG, PNG or other image files. Maximum 5MB.
                </p>

                {uploading && (
                  <p className="text-sm text-blue-600 mt-2">
                    Uploading receipt...
                  </p>
                )}

                {form.receipt_url && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">

                    <p className="text-sm text-green-700 font-medium mb-2">
                      ✓ Receipt uploaded
                    </p>

                    <a
                      href={
                        form.receipt_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      👁 View Receipt
                    </a>

                  </div>
                )}

              </div>

              <div className="lg:col-span-3">

                <label className="block text-sm font-medium mb-2">
                  Remarks
                </label>

                <textarea
                  name="remarks"
                  value={
                    form.remarks
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Optional remarks..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                type="button"
                onClick={() => {
                  clearForm();

                  setShowForm(
                    false
                  );
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  uploading
                }
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-medium"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Save Changes"
                  : "Save Liquidation"}
              </button>

            </div>

          </form>

        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

            <p className="text-sm text-slate-500">
              Total Transactions
            </p>

            <p className="text-3xl font-bold mt-2 text-slate-900">
              {liquidations.length}
            </p>

          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

            <p className="text-sm text-slate-500">
              Overall Total
            </p>

            <p className="text-3xl font-bold mt-2 text-green-600">
              ₱
              {totalAmount.toLocaleString(
                "en-PH",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </p>

          </div>

        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Liquidation Records
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {liquidations.length} record
                {liquidations.length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>

            <button
              onClick={
                loadLiquidations
              }
              className="border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium"
            >
              ↻ Refresh
            </button>

          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">
              Loading records...
            </div>
          ) : liquidations.length ===
            0 ? (
            <div className="p-12 text-center">

              <div className="text-5xl mb-4">
                📄
              </div>

              <p className="text-lg font-medium text-slate-700">
                No liquidation records yet.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-800 text-white">

                  <tr>

                    <th className="px-4 py-3 text-left whitespace-nowrap">
                      Date
                    </th>

                    <th className="px-4 py-3 text-left">
                      Payee
                    </th>

                    <th className="px-4 py-3 text-left">
                      Address
                    </th>

                    <th className="px-4 py-3 text-left">
                      TIN
                    </th>

                    <th className="px-4 py-3 text-left">
                      Description
                    </th>

                    <th className="px-4 py-3 text-right">
                      Amount
                    </th>

                    <th className="px-4 py-3 text-center">
                      Tax
                    </th>

                    <th className="px-4 py-3 text-center">
                      Receipt
                    </th>

                    <th className="px-4 py-3 text-center">
                      Status
                    </th>

                    <th className="px-4 py-3 text-center">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {liquidations.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-200 hover:bg-slate-50"
                      >

                        <td className="px-4 py-3 whitespace-nowrap">

                          {new Date(
                            item.liquidation_date +
                              "T00:00:00"
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
                          )}

                        </td>

                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.payee}
                        </td>

                        <td className="px-4 py-3">
                          {item.address ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.tin ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {item.description ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          ₱
                          {Number(
                            item.amount ||
                              0
                          ).toLocaleString(
                            "en-PH",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">

                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.tax_type ===
                              "With Tax"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.tax_type ||
                              "Non-Tax"}
                          </span>

                        </td>

                        <td className="px-4 py-3 text-center">

                          {item.receipt_url ? (
                            <a
                              href={
                                item.receipt_url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              👁 View
                            </a>
                          ) : (
                            <span className="text-slate-400">
                              None
                            </span>
                          )}

                        </td>

                        <td className="px-4 py-3 text-center">

                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              item.status ===
                              "Approved"
                                ? "bg-green-100 text-green-700"
                                : item.status ===
                                  "Completed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {item.status ||
                              "Pending"}
                          </span>

                        </td>

                        <td className="px-4 py-3 text-center">

                          {loadingRole ? (
                            <span className="text-slate-400 text-xs">
                              Checking...
                            </span>
                          ) : isAdmin ? (
                            <div className="flex items-center justify-center gap-2">

                              <button
                                onClick={() =>
                                  startEdit(
                                    item
                                  )
                                }
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  deleteLiquidation(
                                    item
                                  )
                                }
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                Delete
                              </button>

                            </div>
                          ) : (
                            <span className="inline-flex px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium whitespace-nowrap">
                              👁 View Only
                            </span>
                          )}

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

                <tfoot>

                  <tr className="bg-slate-100 font-bold">

                    <td
                      colSpan={5}
                      className="px-4 py-4 text-right text-slate-800"
                    >
                      OVERALL TOTAL
                    </td>

                    <td className="px-4 py-4 text-right text-green-700 whitespace-nowrap">
                      ₱
                      {totalAmount.toLocaleString(
                        "en-PH",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td colSpan={4}></td>

                  </tr>

                </tfoot>

              </table>

            </div>
          )}

        </div>

      </section>

    </main>
  );
}