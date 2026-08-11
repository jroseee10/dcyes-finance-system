"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

type ExpenseItem = {
  id?: number;
  description: string;
  qty: number;
  unit: string;
  price: number;
  amount: number;
};

type Expense = {
  id: number;
  expense_date: string;
  payee: string;
  address: string | null;
  amount: number;
  reimburse: number;
  refund: number;
  balance: number;
  status: string;
  remarks: string | null;
  expense_items?: ExpenseItem[];
};

export default function LocationExpensesPage() {
  const params = useParams();
  const router = useRouter();

  const locationId = Number(params.id);

  const [locationName, setLocationName] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  // =========================
  // EDIT MODE
  // =========================

  const [editingId, setEditingId] = useState<number | null>(null);

  // =========================
  // FORM
  // =========================

  const [date, setDate] = useState("");
  const [payee, setPayee] = useState("");
  const [address, setAddress] = useState("");
  const [reimburse, setReimburse] = useState("");
  const [refund, setRefund] = useState("");
  const [status, setStatus] = useState("Pending");
  const [remarks, setRemarks] = useState("");

  // =========================
  // ITEMS
  // =========================

  const [items, setItems] = useState<ExpenseItem[]>([
    {
      description: "",
      qty: 1,
      unit: "",
      price: 0,
      amount: 0,
    },
  ]);

  // =========================
  // LOAD DATA
  // =========================

  async function loadData() {
    setLoading(true);

    try {
      // Get location
      const locationResult = await supabase
        .from("locations")
        .select("name")
        .eq("id", locationId)
        .single();

      if (locationResult.error) {
        console.error(locationResult.error);

        alert("Hindi makita ang location.");

        router.push("/dashboard/locations");
        return;
      }

      setLocationName(locationResult.data.name);

      // Get expenses + expense_items
      const expenseResult = await supabase
        .from("expenses")
        .select(`
          id,
          expense_date,
          payee,
          address,
          amount,
          reimburse,
          refund,
          balance,
          status,
          remarks,
          expense_items (
            id,
            description,
            qty,
            unit,
            price,
            amount
          )
        `)
        .eq("location_id", locationId)
        .order("expense_date", {
          ascending: false,
        });

      if (expenseResult.error) {
        console.error(expenseResult.error);

        alert(
          "Hindi makuha ang expenses: " +
            expenseResult.error.message
        );

        return;
      }

      const formattedExpenses: Expense[] =
        (expenseResult.data || []).map((expense: any) => ({
          id: expense.id,
          expense_date: expense.expense_date,
          payee: expense.payee,
          address: expense.address,
          amount: Number(expense.amount || 0),
          reimburse: Number(expense.reimburse || 0),
          refund: Number(expense.refund || 0),
          balance: Number(expense.balance || 0),
          status: expense.status || "Pending",
          remarks: expense.remarks,
          expense_items:
            expense.expense_items?.map(
              (item: any) => ({
                id: item.id,
                description:
                  item.description || "",
                qty: Number(item.qty || 0),
                unit: item.unit || "",
                price: Number(item.price || 0),
                amount:
                  Number(item.qty || 0) *
                  Number(item.price || 0),
              })
            ) || [],
        }));

      setExpenses(formattedExpenses);
    } catch (error) {
      console.error(error);

      alert(
        "May error habang kinukuha ang expenses."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!locationId || Number.isNaN(locationId)) {
      return;
    }

    loadData();
  }, [locationId]);

  // =========================
  // CALCULATE ITEM AMOUNT
  // =========================

  function calculateItemAmount(
    qty: number,
    price: number
  ) {
    return (
      Number(qty || 0) *
      Number(price || 0)
    );
  }

  // =========================
  // TOTAL AMOUNT
  // =========================

  const totalAmount = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total +
        Number(item.qty || 0) *
          Number(item.price || 0),
      0
    );
  }, [items]);

  // =========================
  // BALANCE
  // =========================

  const balance = useMemo(() => {
    return (
      totalAmount -
      Number(reimburse || 0) -
      Number(refund || 0)
    );
  }, [
    totalAmount,
    reimburse,
    refund,
  ]);

  // =========================
  // ADD ITEM
  // =========================

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        description: "",
        qty: 1,
        unit: "",
        price: 0,
        amount: 0,
      },
    ]);
  }

  // =========================
  // REMOVE ITEM
  // =========================

  function removeItem(index: number) {
    if (items.length === 1) {
      alert(
        "Kailangan may kahit isang item."
      );
      return;
    }

    setItems((currentItems) =>
      currentItems.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  }

  // =========================
  // UPDATE ITEM
  // =========================

  function updateItem(
    index: number,
    field: "description" | "qty" | "unit" | "price",
    value: string
  ) {
    setItems((currentItems) => {
      const updatedItems = [
        ...currentItems,
      ];

      const currentItem =
        updatedItems[index];

      if (!currentItem) {
        return currentItems;
      }

      if (
        field === "description" ||
        field === "unit"
      ) {
        updatedItems[index] = {
          ...currentItem,
          [field]: value,
        };
      }

      if (field === "qty") {
        const qty = Number(value || 0);

        updatedItems[index] = {
          ...currentItem,
          qty,
          amount:
            calculateItemAmount(
              qty,
              currentItem.price
            ),
        };
      }

      if (field === "price") {
        const price = Number(value || 0);

        updatedItems[index] = {
          ...currentItem,
          price,
          amount:
            calculateItemAmount(
              currentItem.qty,
              price
            ),
        };
      }

      return updatedItems;
    });
  }

  // =========================
  // CLEAR FORM
  // =========================

  function clearForm() {
    setEditingId(null);

    setDate("");
    setPayee("");
    setAddress("");
    setReimburse("");
    setRefund("");
    setStatus("Pending");
    setRemarks("");

    setItems([
      {
        description: "",
        qty: 1,
        unit: "",
        price: 0,
        amount: 0,
      },
    ]);
  }

  // =========================
  // EDIT EXPENSE
  // =========================

  function editExpense(
    expense: Expense
  ) {
    setEditingId(expense.id);

    setDate(expense.expense_date);
    setPayee(expense.payee);
    setAddress(expense.address || "");

    setReimburse(
      String(expense.reimburse || 0)
    );

    setRefund(
      String(expense.refund || 0)
    );

    setStatus(
      expense.status || "Pending"
    );

    setRemarks(
      expense.remarks || ""
    );

    const loadedItems =
      expense.expense_items || [];

    if (loadedItems.length > 0) {
      setItems(
        loadedItems.map((item) => ({
          id: item.id,
          description:
            item.description || "",
          qty: Number(item.qty || 0),
          unit: item.unit || "",
          price: Number(item.price || 0),
          amount:
            Number(item.qty || 0) *
            Number(item.price || 0),
        }))
      );
    } else {
      setItems([
        {
          description: "",
          qty: 1,
          unit: "",
          price: 0,
          amount: 0,
        },
      ]);
    }

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =========================
  // DELETE EXPENSE
  // =========================

  async function deleteExpense(
    expense: Expense
  ) {
    const confirmed =
      window.confirm(
        `Sigurado ka bang gusto mong burahin ang expense ni "${expense.payee}" na nagkakahalaga ng ₱${Number(
          expense.amount || 0
        ).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
        })}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      /*
       * Dahil naka ON DELETE CASCADE
       * ang expense_items.expense_id,
       * automatic mabubura ang items
       * kapag binura ang main expense.
       */

      const { error } =
        await supabase
          .from("expenses")
          .delete()
          .eq("id", expense.id);

      if (error) {
        console.error(error);

        alert(
          "Hindi mabura ang expense: " +
            error.message
        );

        return;
      }

      alert(
        "Expense successfully deleted!"
      );

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        "May error habang nagde-delete ng expense."
      );
    }
  }

  // =========================
  // SAVE / UPDATE EXPENSE
  // =========================

  async function saveExpense(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!date) {
      alert("Kailangan ang Date.");
      return;
    }

    if (!payee.trim()) {
      alert("Kailangan ang Payee.");
      return;
    }

    const validItems =
      items.filter(
        (item) =>
          item.description.trim() !==
            "" &&
          Number(item.qty) > 0 &&
          Number(item.price) >= 0
      );

    if (validItems.length === 0) {
      alert(
        "Maglagay ng kahit isang item na may description, quantity at price."
      );

      return;
    }

    setSaving(true);

    try {
      const calculatedTotal =
        validItems.reduce(
          (sum, item) =>
            sum +
            Number(item.qty) *
              Number(item.price),
          0
        );

      const calculatedBalance =
        calculatedTotal -
        Number(reimburse || 0) -
        Number(refund || 0);

      // =========================
      // UPDATE
      // =========================

      if (editingId !== null) {
        const {
          error: expenseError,
        } = await supabase
          .from("expenses")
          .update({
            expense_date: date,
            payee: payee.trim(),
            address:
              address.trim() || null,

            // Main expense total
            amount: calculatedTotal,

            reimburse: Number(
              reimburse || 0
            ),

            refund: Number(
              refund || 0
            ),

            balance: calculatedBalance,

            status,

            remarks:
              remarks.trim() || null,
          })
          .eq("id", editingId);

        if (expenseError) {
          console.error(
            expenseError
          );

          alert(
            "Hindi ma-update ang expense: " +
              expenseError.message
          );

          return;
        }

        // Delete old items.
        // Then insert the new/current items.
        const {
          error: deleteItemsError,
        } = await supabase
          .from("expense_items")
          .delete()
          .eq(
            "expense_id",
            editingId
          );

        if (deleteItemsError) {
          console.error(
            deleteItemsError
          );

          alert(
            "Hindi ma-update ang items: " +
              deleteItemsError.message
          );

          return;
        }

        const itemRows =
          validItems.map(
            (item) => ({
              expense_id: editingId,
              description:
                item.description.trim(),
              qty: Number(item.qty),
              unit:
                item.unit.trim() ||
                null,
              price: Number(
                item.price
              ),
              // IMPORTANT:
              // Supabase already has
              // generated amount.
              // Hindi na natin
              // kailangang i-insert.
            })
          );

        const {
          error: itemError,
        } = await supabase
          .from("expense_items")
          .insert(itemRows);

        if (itemError) {
          console.error(itemError);

          alert(
            "Hindi ma-save ang updated items: " +
              itemError.message
          );

          return;
        }

        alert(
          "Expense successfully updated!"
        );
      }

      // =========================
      // ADD NEW
      // =========================

      else {
        const {
          data: expenseData,
          error: expenseError,
        } = await supabase
          .from("expenses")
          .insert({
            location_id: locationId,

            expense_date: date,

            payee: payee.trim(),

            address:
              address.trim() || null,

            // Main total
            amount: calculatedTotal,

            reimburse: Number(
              reimburse || 0
            ),

            refund: Number(
              refund || 0
            ),

            balance:
              calculatedBalance,

            status,

            remarks:
              remarks.trim() || null,
          })
          .select("id")
          .single();

        if (
          expenseError ||
          !expenseData
        ) {
          console.error(
            expenseError
          );

          alert(
            "Hindi na-save ang expense: " +
              (expenseError?.message ||
                "Unknown error")
          );

          return;
        }

        // =========================
        // SAVE ITEMS
        // =========================

        const itemRows =
          validItems.map(
            (item) => ({
              expense_id:
                expenseData.id,

              description:
                item.description.trim(),

              qty: Number(item.qty),

              unit:
                item.unit.trim() ||
                null,

              price: Number(
                item.price
              ),

              // HUWAG maglagay ng amount.
              // Generated column ito sa database.
            })
          );

        const {
          error: itemError,
        } = await supabase
          .from("expense_items")
          .insert(itemRows);

        if (itemError) {
          console.error(itemError);

          // Rollback main expense
          await supabase
            .from("expenses")
            .delete()
            .eq(
              "id",
              expenseData.id
            );

          alert(
            "Hindi na-save ang mga items: " +
              itemError.message
          );

          return;
        }

        alert(
          "Expense successfully saved!"
        );
      }

      clearForm();
      setShowForm(false);

      await loadData();
    } catch (error) {
      console.error(error);

      alert(
        "May unexpected error habang nagsa-save."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // SEARCH
  // =========================

  const filteredExpenses =
    expenses.filter((expense) => {
      const text =
        search.toLowerCase();

      const itemText =
        expense.expense_items
          ?.map(
            (item) =>
              item.description
          )
          .join(" ")
          .toLowerCase() || "";

      return (
        expense.payee
          ?.toLowerCase()
          .includes(text) ||
        expense.address
          ?.toLowerCase()
          .includes(text) ||
        itemText.includes(text) ||
        expense.status
          ?.toLowerCase()
          .includes(text)
      );
    });

  // =========================
  // GRAND TOTAL
  // =========================

  const grandTotal =
    filteredExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.amount || 0
        ),
      0
    );

  // =========================
  // EXCEL EXPORT
  // =========================

  async function exportToExcel() {
    if (
      filteredExpenses.length === 0
    ) {
      alert(
        "Walang expense records na ie-export."
      );

      return;
    }

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      "DCYES Financial Management System";

    workbook.created = new Date();

    const sheet =
      workbook.addWorksheet(
        "Monthly Expenses"
      );

    sheet.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    sheet.views = [
      {
        state: "frozen",
        ySplit: 4,
        showGridLines: false,
      },
    ];

    const navy = "1F3A5F";
    const white = "FFFFFF";
    const black = "000000";

    // =========================
    // TITLE
    // =========================

    sheet.mergeCells("A1:M1");

    const title =
      sheet.getCell("A1");

    title.value =
      `${locationName.toUpperCase()} - MONTHLY EXPENSES`;

    title.font = {
      name: "Calibri",
      size: 16,
      bold: true,
      color: {
        argb: white,
      },
    };

    title.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: navy,
      },
    };

    title.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.getRow(1).height = 28;

    // =========================
    // SUBTITLE
    // =========================

    sheet.mergeCells("A2:M2");

    const subtitle =
      sheet.getCell("A2");

    subtitle.value = "DCYES";

    subtitle.font = {
      name: "Calibri",
      size: 11,
      italic: true,
      color: {
        argb: navy,
      },
    };

    subtitle.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // =========================
    // HEADER
    // =========================

    const headers = [
      "Date",
      "Payee",
      "Address",
      "Description",
      "Qty",
      "Unit",
      "Price",
      "Amount",
      "Reimburse",
      "Refund",
      "Balance",
      "Status",
      "Remarks",
    ];

    const headerRow =
      sheet.getRow(4);

    headers.forEach(
      (header, index) => {
        const cell =
          headerRow.getCell(
            index + 1
          );

        cell.value = header;

        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: {
            argb: white,
          },
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
              argb: black,
            },
          },
          bottom: {
            style: "thin",
            color: {
              argb: black,
            },
          },
          left: {
            style: "thin",
            color: {
              argb: black,
            },
          },
          right: {
            style: "thin",
            color: {
              argb: black,
            },
          },
        };
      }
    );

    headerRow.height = 35;

    // =========================
    // FORMAT ROW
    // =========================

    function formatExcelRow(
      row: ExcelJS.Row
    ) {
      row.eachCell((cell) => {
        cell.font = {
          name: "Calibri",
          size: 10,
        };

        cell.border = {
          top: {
            style: "thin",
            color: {
              argb: "B7B7B7",
            },
          },
          bottom: {
            style: "thin",
            color: {
              argb: "B7B7B7",
            },
          },
          left: {
            style: "thin",
            color: {
              argb: "B7B7B7",
            },
          },
          right: {
            style: "thin",
            color: {
              argb: "B7B7B7",
            },
          },
        };

        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };
      });

     const rawDate = String(row.getCell(1).value);

if (rawDate) {
  const [year, month, day] = rawDate.split("-").map(Number);

  row.getCell(1).value = new Date(
    Date.UTC(year, month - 1, day)
  );

  row.getCell(1).numFmt = "mmmm d, yyyy";
}

      [7, 8, 9, 10, 11].forEach(
        (column) => {
          row.getCell(
            column
          ).numFmt =
            '₱#,##0.00;[Red]-₱#,##0.00';

          row.getCell(
            column
          ).alignment = {
            horizontal: "right",
            vertical: "middle",
          };
        }
      );

      row.getCell(5).numFmt =
        "#,##0.##";

      [1, 5, 6, 12].forEach(
        (column) => {
          row.getCell(
            column
          ).alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        }
      );
    }

    // =========================
    // DATA
    // =========================

    filteredExpenses.forEach(
      (expense) => {
        const expenseItems =
          expense.expense_items || [];

        if (
          expenseItems.length === 0
        ) {
          const row =
            sheet.addRow([
              expense.expense_date,
              expense.payee,
              expense.address || "",
              "",
              "",
              "",
              "",
              Number(
                expense.amount || 0
              ),
              Number(
                expense.reimburse || 0
              ),
              Number(
                expense.refund || 0
              ),
              Number(
                expense.balance || 0
              ),
              expense.status || "",
              expense.remarks || "",
            ]);

          formatExcelRow(row);
        } else {
          expenseItems.forEach(
            (
              item,
              itemIndex
            ) => {
              const row =
                sheet.addRow([
                  expense.expense_date,
                  expense.payee,
                  expense.address ||
                    "",
                  item.description,
                  Number(
                    item.qty || 0
                  ),
                  item.unit || "",
                  Number(
                    item.price || 0
                  ),
                  Number(
                    item.amount || 0
                  ),

                  itemIndex === 0
                    ? Number(
                        expense.reimburse ||
                          0
                      )
                    : 0,

                  itemIndex === 0
                    ? Number(
                        expense.refund ||
                          0
                      )
                    : 0,

                  itemIndex === 0
                    ? Number(
                        expense.balance ||
                          0
                      )
                    : 0,

                  itemIndex === 0
                    ? expense.status ||
                      ""
                    : "",

                  itemIndex === 0
                    ? expense.remarks ||
                      ""
                    : "",
                ]);

              formatExcelRow(row);
            }
          );
        }
      }
    );

    // =========================
    // TOTAL
    // =========================

    const totalRowNumber =
      sheet.rowCount + 2;

    sheet.mergeCells(
      `A${totalRowNumber}:G${totalRowNumber}`
    );

    const totalLabel =
      sheet.getCell(
        `A${totalRowNumber}`
      );

    totalLabel.value =
      "OVERALL TOTAL";

    totalLabel.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: {
        argb: white,
      },
    };

    totalLabel.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: navy,
      },
    };

    totalLabel.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    const startRow = 5;

    const endRow =
      totalRowNumber - 2;

    const formulas = {
      8: `SUM(H${startRow}:H${endRow})`,
      9: `SUM(I${startRow}:I${endRow})`,
      10: `SUM(J${startRow}:J${endRow})`,
      11: `SUM(K${startRow}:K${endRow})`,
    };

    Object.entries(formulas).forEach(
      ([column, formula]) => {
        sheet.getCell(
          totalRowNumber,
          Number(column)
        ).value = {
          formula,
        };
      }
    );

    [8, 9, 10, 11].forEach(
      (column) => {
        const cell =
          sheet.getCell(
            totalRowNumber,
            column
          );

        cell.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: {
            argb: white,
          },
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: navy,
          },
        };

        cell.numFmt =
          '₱#,##0.00;[Red]-₱#,##0.00';

        cell.alignment = {
          horizontal: "right",
          vertical: "middle",
        };
      }
    );

    for (
      let column = 1;
      column <= 13;
      column++
    ) {
      const cell =
        sheet.getCell(
          totalRowNumber,
          column
        );

      cell.border = {
        top: {
          style: "thin",
          color: {
            argb: black,
          },
        },
        bottom: {
          style: "thin",
          color: {
            argb: black,
          },
        },
        left: {
          style: "thin",
          color: {
            argb: black,
          },
        },
        right: {
          style: "thin",
          color: {
            argb: black,
          },
        },
      };
    }

    // =========================
    // COLUMN WIDTHS
    // =========================

    const widths = [
      16,
      25,
      28,
      30,
      9,
      10,
      15,
      15,
      15,
      15,
      15,
      15,
      28,
    ];

    widths.forEach(
      (width, index) => {
        sheet.getColumn(
          index + 1
        ).width = width;
      }
    );

    // =========================
    // FILTER
    // =========================

    sheet.autoFilter = {
      from: "A4",
      to: "M4",
    };

    // =========================
    // FILE NAME
    // =========================

    const safeLocationName =
      locationName
        .replace(
          /[^a-zA-Z0-9-_ ]/g,
          ""
        )
        .trim()
        .replace(
          /\s+/g,
          "_"
        );

    const fileName =
      `${safeLocationName}_Monthly_Expenses.xlsx`;

    // =========================
    // DOWNLOAD
    // =========================

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
    link.download = fileName;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  }

  // =========================
  // PAGE
  // =========================

  return (
    <main className="min-h-screen bg-slate-100 flex">
      <Sidebar />

      <section className="flex-1 p-8">
        {/* BACK */}

        <button
          onClick={() =>
            router.push(
              `/dashboard/locations/${locationId}`
            )
          }
          className="text-gray-500 hover:text-black mb-5"
        >
          ← Back to Location
        </button>

        {/* HEADER */}

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-gray-500">
              Location
            </p>

            <h1 className="text-3xl font-bold">
              📍 {locationName}
            </h1>

            <p className="text-gray-500 mt-2">
              Monthly Expenses
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-medium"
            >
              📥 Export Excel
            </button>

            <button
              onClick={() => {
                clearForm();
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium"
            >
              + Add Expense
            </button>
          </div>
        </div>

        {/* ADD / EDIT FORM */}

        {showForm && (
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingId !== null
                  ? "Edit Monthly Expense"
                  : "Add Monthly Expense"}
              </h2>

              {editingId !== null && (
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  Editing Record #
                  {editingId}
                </span>
              )}
            </div>

            <form
              onSubmit={saveExpense}
            >
              {/* RECEIPT INFO */}

              <div className="grid grid-cols-3 gap-5 mb-8">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Date *
                  </label>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) =>
                      setDate(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Payee *
                  </label>

                  <input
                    type="text"
                    value={payee}
                    onChange={(e) =>
                      setPayee(
                        e.target.value
                      )
                    }
                    placeholder="Store / Supplier"
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Address
                  </label>

                  <input
                    type="text"
                    value={address}
                    onChange={(e) =>
                      setAddress(
                        e.target.value
                      )
                    }
                    placeholder="Address"
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              </div>

              {/* ITEMS */}

              <div className="border rounded-xl overflow-hidden mb-6">
                <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
                  <h3 className="font-bold">
                    Purchased Items
                  </h3>

                  <button
                    type="button"
                    onClick={addItem}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-3 text-left">
                          Description
                        </th>

                        <th className="p-3 text-right">
                          Qty
                        </th>

                        <th className="p-3 text-left">
                          Unit
                        </th>

                        <th className="p-3 text-right">
                          Price
                        </th>

                        <th className="p-3 text-right">
                          Amount
                        </th>

                        <th className="p-3 text-center">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map(
                        (
                          item,
                          index
                        ) => (
                          <tr
                            key={
                              item.id ??
                              `new-${index}`
                            }
                            className="border-t"
                          >
                            <td className="p-3">
                              <input
                                type="text"
                                value={
                                  item.description
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateItem(
                                    index,
                                    "description",
                                    e
                                      .target
                                      .value
                                  )
                                }
                                placeholder="e.g. Rice"
                                className="w-full border rounded-lg p-2"
                              />
                            </td>

                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.qty
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateItem(
                                    index,
                                    "qty",
                                    e
                                      .target
                                      .value
                                  )
                                }
                                className="w-24 border rounded-lg p-2 text-right"
                              />
                            </td>

                            <td className="p-3">
                              <input
                                type="text"
                                value={
                                  item.unit
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateItem(
                                    index,
                                    "unit",
                                    e
                                      .target
                                      .value
                                  )
                                }
                                placeholder="pcs"
                                className="w-24 border rounded-lg p-2"
                              />
                            </td>

                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  item.price
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateItem(
                                    index,
                                    "price",
                                    e
                                      .target
                                      .value
                                  )
                                }
                                className="w-32 border rounded-lg p-2 text-right"
                              />
                            </td>

                            <td className="p-3 text-right font-bold">
                              ₱
                              {Number(
                                item.amount
                              ).toLocaleString(
                                "en-PH",
                                {
                                  minimumFractionDigits: 2,
                                }
                              )}
                            </td>

                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(
                                    index
                                  )
                                }
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                🗑️ Remove
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* TOTAL */}

                <div className="bg-slate-50 border-t p-5 flex justify-end">
                  <div className="text-right">
                    <p className="text-gray-500">
                      Overall Total
                    </p>

                    <p className="text-3xl font-bold text-slate-900">
                      ₱
                      {totalAmount.toLocaleString(
                        "en-PH",
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* PAYMENT */}

              <div className="grid grid-cols-4 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Reimburse
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      reimburse
                    }
                    onChange={(e) =>
                      setReimburse(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Refund
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refund}
                    onChange={(e) =>
                      setRefund(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Balance
                  </label>

                  <input
                    type="text"
                    value={`₱${balance.toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}`}
                    readOnly
                    className="w-full border rounded-lg p-3 bg-gray-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Status
                  </label>

                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-lg p-3"
                  >
                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Paid">
                      Paid
                    </option>

                    <option value="Reimbursed">
                      Reimbursed
                    </option>

                    <option value="Refunded">
                      Refunded
                    </option>
                  </select>
                </div>
              </div>

              {/* REMARKS */}

              <div className="mt-5">
                <label className="block text-sm font-medium mb-2">
                  Remarks
                </label>

                <input
                  type="text"
                  value={remarks}
                  onChange={(e) =>
                    setRemarks(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full border rounded-lg p-3"
                />
              </div>

              {/* BUTTONS */}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    clearForm();
                    setShowForm(false);
                  }}
                  className="px-5 py-3 border rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId !==
                      null
                    ? "Update Expense"
                    : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SUMMARY */}

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Total Transactions
            </p>

            <p className="text-3xl font-bold mt-2">
              {
                filteredExpenses.length
              }
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Total Expenses
            </p>

            <p className="text-3xl font-bold mt-2">
              ₱
              {grandTotal.toLocaleString(
                "en-PH",
                {
                  minimumFractionDigits: 2,
                }
              )}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">
              Location
            </p>

            <p className="text-2xl font-bold mt-2">
              {locationName}
            </p>
          </div>
        </div>

        {/* SEARCH */}

        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="🔍 Search payee, address, product..."
            className="w-full border rounded-lg p-3"
          />
        </div>

        {/* TABLE */}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">
              Expense Records
            </h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading...
            </div>
          ) : filteredExpenses.length ===
            0 ? (
            <div className="p-10 text-center text-gray-500">
              No expenses found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-4 text-left">
                      Date
                    </th>

                    <th className="p-4 text-left">
                      Payee
                    </th>

                    <th className="p-4 text-left">
                      Address
                    </th>

                    <th className="p-4 text-left">
                      Description
                    </th>

                    <th className="p-4 text-right">
                      Qty
                    </th>

                    <th className="p-4 text-left">
                      Unit
                    </th>

                    <th className="p-4 text-right">
                      Price
                    </th>

                    <th className="p-4 text-right">
                      Amount
                    </th>

                    <th className="p-4 text-right">
                      Reimburse
                    </th>

                    <th className="p-4 text-right">
                      Refund
                    </th>

                    <th className="p-4 text-right">
                      Balance
                    </th>

                    <th className="p-4 text-center">
                      Status
                    </th>

                    <th className="p-4 text-left">
                      Remarks
                    </th>

                    <th className="p-4 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredExpenses.map(
                    (expense) => {
                      const expenseItems =
                        expense.expense_items ||
                        [];

                      return (
                        <tr
                          key={
                            expense.id
                          }
                          className="border-t hover:bg-slate-50 align-top"
                        >
                          {/* DATE */}

                          <td className="p-4">
                            {new Date(
                              expense.expense_date +
                                "T00:00:00"
                            ).toLocaleDateString(
                              "en-PH"
                            )}
                          </td>

                          {/* PAYEE */}

                          <td className="p-4 font-medium">
                            {
                              expense.payee
                            }
                          </td>

                          {/* ADDRESS */}

                          <td className="p-4">
                            {expense.address ||
                              "-"}
                          </td>

                          {/* DESCRIPTION */}

                          <td className="p-4">
                            {expenseItems.length >
                            0 ? (
                              <div className="space-y-1">
                                {expenseItems.map(
                                  (
                                    item
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                    >
                                      {
                                        item.description
                                      }
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>

                          {/* QTY */}

                          <td className="p-4 text-right">
                            {expenseItems.length >
                            0 ? (
                              <div className="space-y-1">
                                {expenseItems.map(
                                  (
                                    item
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                    >
                                      {
                                        item.qty
                                      }
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>

                          {/* UNIT */}

                          <td className="p-4">
                            {expenseItems.length >
                            0 ? (
                              <div className="space-y-1">
                                {expenseItems.map(
                                  (
                                    item
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                    >
                                      {item.unit ||
                                        "-"}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>

                          {/* PRICE */}

                          <td className="p-4 text-right">
                            {expenseItems.length >
                            0 ? (
                              <div className="space-y-1">
                                {expenseItems.map(
                                  (
                                    item
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                    >
                                      ₱
                                      {Number(
                                        item.price
                                      ).toLocaleString(
                                        "en-PH",
                                        {
                                          minimumFractionDigits: 2,
                                        }
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>

                          {/* TOTAL AMOUNT */}

                          <td className="p-4 text-right font-bold">
                            ₱
                            {Number(
                              expense.amount
                            ).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}
                          </td>

                          {/* REIMBURSE */}

                          <td className="p-4 text-right">
                            ₱
                            {Number(
                              expense.reimburse ||
                                0
                            ).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}
                          </td>

                          {/* REFUND */}

                          <td className="p-4 text-right">
                            ₱
                            {Number(
                              expense.refund ||
                                0
                            ).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}
                          </td>

                          {/* BALANCE */}

                          <td className="p-4 text-right font-bold">
                            ₱
                            {Number(
                              expense.balance ||
                                0
                            ).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}
                          </td>

                          {/* STATUS */}

                          <td className="p-4 text-center">
                            <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
                              {
                                expense.status
                              }
                            </span>
                          </td>

                          {/* REMARKS */}

                          <td className="p-4">
                            {expense.remarks ||
                              "-"}
                          </td>

                          {/* ACTION */}

                          <td className="p-4">
                            <div className="flex flex-col gap-2 min-w-[100px]">
                              <button
                                type="button"
                                onClick={() =>
                                  editExpense(
                                    expense
                                  )
                                }
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium"
                              >
                                ✏️ Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteExpense(
                                    expense
                                  )
                                }
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}