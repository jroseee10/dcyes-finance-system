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
  // =====================================================
  // SELECTIVE EXPORT STATE
  // =====================================================

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<"whole" | "materials">("whole");
  const [exportScope, setExportScope] = useState<"all" | "selected">("selected");
  const [selectedExportPayees, setSelectedExportPayees] = useState<string[]>([]);
  const [selectedExportMaterials, setSelectedExportMaterials] = useState<string[]>([]);

  // =====================================================
  // CURRENT USER / ROLE
  // =====================================================

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  type CurrentUserProfile = {
    name: string;
    email: string;
    position: string;
  };

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
        !authData.user?.email
      ) {
        console.error(
          "Auth error:",
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
        .eq(
          "email",
          authData.user.email
        )
        .maybeSingle();

      if (profileError) {
        console.error(
          "Profile error:",
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
        "Role check error:",
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
          module: "Monthly Expenses",
          record_id: recordId,
          location_id: locationId,
          location_name: locationName,
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
  // EDIT MODE
  // =====================================================

  const [editingId, setEditingId] =
    useState<number | null>(null);

  // =====================================================
  // FORM
  // =====================================================

  const [date, setDate] = useState("");
  const [payee, setPayee] = useState("");
  const [address, setAddress] = useState("");
  const [reimburse, setReimburse] = useState("");
  const [refund, setRefund] = useState("");
  const [status, setStatus] = useState("Pending");
  const [remarks, setRemarks] = useState("");

  // =====================================================
  // ITEMS
  // =====================================================

  const [items, setItems] = useState<ExpenseItem[]>([
    {
      description: "",
      qty: 1,
      unit: "",
      price: 0,
      amount: 0,
    },
  ]);

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    setLoading(true);

    try {
      const locationResult =
        await supabase
          .from("locations")
          .select("name, address")
          .eq("id", locationId)
          .single();

      if (locationResult.error) {
        console.error(
          locationResult.error
        );

        alert(
          "Hindi makita ang location."
        );

        router.push(
          "/dashboard/locations"
        );

        return;
      }

      setLocationName(
        locationResult.data.name
      );

      const locationAddress = locationResult.data.address || null;

      const expenseResult =
        await supabase
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
          .eq(
            "location_id",
            locationId
          )
          .order(
            "expense_date",
            {
              ascending: false,
            }
          );

      if (expenseResult.error) {
        console.error(
          expenseResult.error
        );

        alert(
          "Hindi makuha ang expenses: " +
            expenseResult.error.message
        );

        return;
      }

      // Daily Records are a separate ledger. Only use their address when
      // an explicit daily_records.expense_id link points to this expense.
      // This enriches the existing row; it does not add or total another transaction.
      const expenseRows = expenseResult.data || [];
      const expenseIds = expenseRows.map((expense: any) => Number(expense.id)).filter(Number.isFinite);
      const dailyRecordAddressByExpenseId = new Map<number, string>();

      if (expenseIds.length > 0) {
        const { data: linkedRecords, error: linkedRecordsError } = await supabase
          .from("daily_records")
          .select("expense_id, address, record_date, id")
          .in("expense_id", expenseIds)
          .not("address", "is", null)
          .order("id", { ascending: false });

        if (linkedRecordsError) {
          // Keep the existing expense list available even if optional enrichment fails.
          console.warn("Linked Daily Record address lookup failed:", linkedRecordsError.message);
        } else {
          for (const record of linkedRecords || []) {
            const linkedExpenseId = Number(record.expense_id);
            const address = String(record.address || "").trim();
            if (linkedExpenseId && address && !dailyRecordAddressByExpenseId.has(linkedExpenseId)) {
              dailyRecordAddressByExpenseId.set(linkedExpenseId, address);
            }
          }
        }
      }

      const formattedExpenses: Expense[] =
        expenseRows.map(
          (expense: any) => ({
            id:
              expense.id,

            expense_date:
              expense.expense_date,

            payee:
              expense.payee,

            address:
              dailyRecordAddressByExpenseId.get(Number(expense.id)) ||
              expense.address ||
              locationAddress,

            amount:
              Number(
                expense.amount || 0
              ),

            reimburse:
              Number(
                expense.reimburse || 0
              ),

            refund:
              Number(
                expense.refund || 0
              ),

            balance:
              Number(
                expense.balance || 0
              ),

            status:
              expense.status ||
              "Pending",

            remarks:
              expense.remarks,

            expense_items:
              expense.expense_items?.map(
                (item: any) => ({
                  id:
                    item.id,

                  description:
                    item.description || "",

                  qty:
                    Number(
                      item.qty || 0
                    ),

                  unit:
                    item.unit || "",

                  price:
                    Number(
                      item.price || 0
                    ),

                  amount:
                    Number(
                      item.qty || 0
                    ) *
                    Number(
                      item.price || 0
                    ),
                })
              ) || [],
          })
        );

      setExpenses(
        formattedExpenses
      );
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
  // CALCULATIONS
  // =====================================================

  function calculateItemAmount(
    qty: number,
    price: number
  ) {
    return (
      Number(qty || 0) *
      Number(price || 0)
    );
  }

  const totalAmount =
    useMemo(() => {
      return items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.qty || 0
          ) *
            Number(
              item.price || 0
            ),
        0
      );
    }, [items]);

  const balance =
    useMemo(() => {
      return (
        totalAmount -
        Number(
          reimburse || 0
        ) -
        Number(
          refund || 0
        )
      );
    }, [
      totalAmount,
      reimburse,
      refund,
    ]);

  // =====================================================
  // ITEM FUNCTIONS
  // =====================================================

  function addItem() {
    setItems(
      (currentItems) => [
        ...currentItems,
        {
          description: "",
          qty: 1,
          unit: "",
          price: 0,
          amount: 0,
        },
      ]
    );
  }

  function removeItem(
    index: number
  ) {
    if (
      items.length === 1
    ) {
      alert(
        "Kailangan may kahit isang item."
      );

      return;
    }

    setItems(
      (currentItems) =>
        currentItems.filter(
          (
            _,
            itemIndex
          ) =>
            itemIndex !==
            index
        )
    );
  }

  function updateItem(
    index: number,
    field:
      | "description"
      | "qty"
      | "unit"
      | "price",
    value: string
  ) {
    setItems(
      (currentItems) => {
        const updatedItems = [
          ...currentItems,
        ];

        const currentItem =
          updatedItems[index];

        if (!currentItem) {
          return currentItems;
        }

        if (
          field ===
            "description" ||
          field ===
            "unit"
        ) {
          updatedItems[index] = {
            ...currentItem,
            [field]: value,
          };
        }

        if (
          field ===
          "qty"
        ) {
          const qty =
            Number(
              value || 0
            );

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

        if (
          field ===
          "price"
        ) {
          const price =
            Number(
              value || 0
            );

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
      }
    );
  }

  // =====================================================
  // CLEAR FORM
  // =====================================================

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

  // =====================================================
  // EDIT EXPENSE - ADMIN ONLY
  // =====================================================

  function editExpense(
    expense: Expense
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-edit ng expense."
      );

      return;
    }

    setEditingId(
      expense.id
    );

    setDate(
      expense.expense_date
    );

    setPayee(
      expense.payee
    );

    setAddress(
      expense.address || ""
    );

    setReimburse(
      String(
        expense.reimburse || 0
      )
    );

    setRefund(
      String(
        expense.refund || 0
      )
    );

    setStatus(
      expense.status ||
        "Pending"
    );

    setRemarks(
      expense.remarks || ""
    );

    const loadedItems =
      expense.expense_items ||
      [];

    if (
      loadedItems.length > 0
    ) {
      setItems(
        loadedItems.map(
          (item) => ({
            id:
              item.id,

            description:
              item.description || "",

            qty:
              Number(
                item.qty || 0
              ),

            unit:
              item.unit || "",

            price:
              Number(
                item.price || 0
              ),

            amount:
              Number(
                item.qty || 0
              ) *
              Number(
                item.price || 0
              ),
          })
        )
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

  // =====================================================
  // DELETE EXPENSE - ADMIN ONLY
  // =====================================================

  async function deleteExpense(
    expense: Expense
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-delete ng expense."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Sigurado ka bang gusto mong burahin ang expense ni "${expense.payee}" na nagkakahalaga ng ₱${Number(
          expense.amount || 0
        ).toLocaleString(
          "en-PH",
          {
            minimumFractionDigits: 2,
          }
        )}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("expenses")
        .delete()
        .eq(
          "id",
          expense.id
        );

      if (error) {
        console.error(
          error
        );

        alert(
          "Hindi mabura ang expense: " +
            error.message
        );

        return;
      }

      await addActivityLog({
        action: "Deleted",
        recordId: expense.id,
        description: `Deleted expense for ${expense.payee} - ₱${Number(
          expense.amount || 0
        ).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      });

      alert(
        "Expense successfully deleted!"
      );

      await loadData();
    } catch (error) {
      console.error(
        error
      );

      alert(
        "May error habang nagde-delete ng expense."
      );
    }
  }

  // =====================================================
  // SAVE / UPDATE EXPENSE
  // =====================================================

  async function saveExpense(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!date) {
      alert(
        "Kailangan ang Date."
      );

      return;
    }

    if (
      !payee.trim()
    ) {
      alert(
        "Kailangan ang Payee."
      );

      return;
    }

    const validItems =
      items.filter(
        (item) =>
          item.description
            .trim() !== "" &&
          Number(
            item.qty
          ) > 0 &&
          Number(
            item.price
          ) >= 0
      );

    if (
      validItems.length ===
      0
    ) {
      alert(
        "Maglagay ng kahit isang item na may description, quantity at price."
      );

      return;
    }

    setSaving(true);

    try {
      const calculatedTotal =
        validItems.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.qty
            ) *
              Number(
                item.price
              ),
          0
        );

      const calculatedBalance =
        calculatedTotal -
        Number(
          reimburse || 0
        ) -
        Number(
          refund || 0
        );

      // =================================================
      // UPDATE - ADMIN ONLY
      // =================================================

      if (
        editingId !==
        null
      ) {
        if (!isAdmin) {
          alert(
            "Admin only ang pag-update ng existing expense."
          );

          return;
        }

        const {
          error:
            expenseError,
        } = await supabase
          .from("expenses")
          .update({
            expense_date:
              date,

            payee:
              payee.trim(),

            address:
              address.trim() ||
              null,

            amount:
              calculatedTotal,

            reimburse:
              Number(
                reimburse || 0
              ),

            refund:
              Number(
                refund || 0
              ),

            balance:
              calculatedBalance,

            status,

            remarks:
              remarks.trim() ||
              null,
          })
          .eq(
            "id",
            editingId
          );

        if (
          expenseError
        ) {
          console.error(
            expenseError
          );

          alert(
            "Hindi ma-update ang expense: " +
              expenseError.message
          );

          return;
        }

        const {
          error:
            deleteItemsError,
        } = await supabase
          .from(
            "expense_items"
          )
          .delete()
          .eq(
            "expense_id",
            editingId
          );

        if (
          deleteItemsError
        ) {
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
              expense_id:
                editingId,

              description:
                item.description.trim(),

              qty:
                Number(
                  item.qty
                ),

              unit:
                item.unit.trim() ||
                null,

              price:
                Number(
                  item.price
                ),
            })
          );

        const {
          error:
            itemError,
        } = await supabase
          .from(
            "expense_items"
          )
          .insert(
            itemRows
          );

        if (
          itemError
        ) {
          console.error(
            itemError
          );

          alert(
            "Hindi ma-save ang updated items: " +
              itemError.message
          );

          return;
        }

        await addActivityLog({
          action: "Updated",
          recordId: editingId,
          description: `Updated expense for ${payee.trim()} - ₱${calculatedTotal.toLocaleString(
            "en-PH",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`,
        });

        alert(
          "Expense successfully updated!"
        );
      }

      // =================================================
      // ADD NEW
      // =================================================

      else {
        const {
          data:
            expenseData,

          error:
            expenseError,
        } = await supabase
          .from("expenses")
          .insert({
            location_id:
              locationId,

            expense_date:
              date,

            payee:
              payee.trim(),

            address:
              address.trim() ||
              null,

            amount:
              calculatedTotal,

            reimburse:
              Number(
                reimburse || 0
              ),

            refund:
              Number(
                refund || 0
              ),

            balance:
              calculatedBalance,

            // Office Staff always Pending
            status:
              isAdmin
                ? status
                : "Pending",

            remarks:
              remarks.trim() ||
              null,
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
              (
                expenseError?.message ||
                "Unknown error"
              )
          );

          return;
        }

        const itemRows =
          validItems.map(
            (item) => ({
              expense_id:
                expenseData.id,

              description:
                item.description.trim(),

              qty:
                Number(
                  item.qty
                ),

              unit:
                item.unit.trim() ||
                null,

              price:
                Number(
                  item.price
                ),
            })
          );

        const {
          error:
            itemError,
        } = await supabase
          .from(
            "expense_items"
          )
          .insert(
            itemRows
          );

        if (
          itemError
        ) {
          console.error(
            itemError
          );

          // Rollback expense
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

        await addActivityLog({
          action: "Added",
          recordId: expenseData.id,
          description: `Added expense for ${payee.trim()} - ₱${calculatedTotal.toLocaleString(
            "en-PH",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`,
        });

        alert(
          "Expense successfully saved!"
        );
      }

      clearForm();

      setShowForm(
        false
      );

      await loadData();
    } catch (error) {
      console.error(
        error
      );

      alert(
        "May unexpected error habang nagsa-save."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredExpenses =
    expenses.filter(
      (expense) => {
        const text =
          search
            .trim()
            .toLowerCase();

        const itemText =
          expense.expense_items
            ?.map(
              (item) =>
                item.description
            )
            .join(" ")
            .toLowerCase() ||
          "";

        return (
          formatExpenseNumber(expense.id).includes(text) ||
          expense.payee
            ?.toLowerCase()
            .includes(
              text
            ) ||
          expense.address
            ?.toLowerCase()
            .includes(
              text
            ) ||
          itemText.includes(
            text
          ) ||
          expense.status
            ?.toLowerCase()
            .includes(
              text
            )
        );
      }
    );

  // =====================================================
  // GRAND TOTAL
  // =====================================================

  const grandTotal =
    filteredExpenses.reduce(
      (
        sum,
        expense
      ) =>
        sum +
        Number(
          expense.amount ||
            0
        ),
      0
    );

  // =====================================================
  // SELECTIVE EXPORT DATA
  // =====================================================

  const exportPayeeOptions = useMemo(() => {
    return Array.from(
      new Set(
        expenses
          .map((expense) => String(expense.payee || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const exportMaterialOptions = useMemo(() => {
    const selectedPayees = new Set(selectedExportPayees);

    return Array.from(
      new Set(
        expenses
          .filter((expense) => selectedPayees.has(String(expense.payee || "").trim()))
          .flatMap((expense) =>
            (expense.expense_items || [])
              .map((item) => String(item.description || "").trim())
              .filter(Boolean)
          )
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [expenses, selectedExportPayees]);

  const exportPreviewRows = useMemo(() => {
    const selectedPayees = new Set(selectedExportPayees);
    const selectedMaterials = new Set(selectedExportMaterials);

    return expenses
      .filter((expense) =>
        exportScope === "all" || selectedPayees.has(String(expense.payee || "").trim())
      )
      .flatMap((expense) => {
        const expenseItems = expense.expense_items || [];

        if (exportMode === "materials") {
          const matchingItems = expenseItems.filter((item) =>
            selectedMaterials.has(String(item.description || "").trim())
          );

          return matchingItems.map((item, itemIndex) => ({
            expenseId: expense.id,
            expenseDate: expense.expense_date,
            payee: expense.payee,
            address: expense.address || "",
            description: item.description || "",
            qty: Number(item.qty || 0),
            unit: item.unit || "",
            price: Number(item.price || 0),
            amount: Number(item.qty || 0) * Number(item.price || 0),
            reimburse: 0,
            refund: 0,
            balance: 0,
            status: itemIndex === 0 ? expense.status || "" : "",
            remarks: itemIndex === 0 ? expense.remarks || "" : "",
          }));
        }

        if (expenseItems.length === 0) {
          return [{
            expenseId: expense.id,
            expenseDate: expense.expense_date,
            payee: expense.payee,
            address: expense.address || "",
            description: "",
            qty: 0,
            unit: "",
            price: 0,
            amount: Number(expense.amount || 0),
            reimburse: Number(expense.reimburse || 0),
            refund: Number(expense.refund || 0),
            balance: Number(expense.balance || 0),
            status: expense.status || "",
            remarks: expense.remarks || "",
          }];
        }

        return expenseItems.map((item, itemIndex) => ({
          expenseId: expense.id,
          expenseDate: expense.expense_date,
          payee: expense.payee,
          address: expense.address || "",
          description: item.description || "",
          qty: Number(item.qty || 0),
          unit: item.unit || "",
          price: Number(item.price || 0),
          amount: Number(item.qty || 0) * Number(item.price || 0),
          reimburse: itemIndex === 0 ? Number(expense.reimburse || 0) : 0,
          refund: itemIndex === 0 ? Number(expense.refund || 0) : 0,
          balance: itemIndex === 0 ? Number(expense.balance || 0) : 0,
          status: itemIndex === 0 ? expense.status || "" : "",
          remarks: itemIndex === 0 ? expense.remarks || "" : "",
        }));
      });
  }, [
    expenses,
    exportMode,
    exportScope,
    selectedExportPayees,
    selectedExportMaterials,
  ]);

  const exportPreviewTotals = useMemo(() => {
    return exportPreviewRows.reduce(
      (totals, row) => ({
        amount: totals.amount + row.amount,
        reimburse: totals.reimburse + row.reimburse,
        refund: totals.refund + row.refund,
        balance: totals.balance + row.amount - row.reimburse - row.refund,
      }),
      {
        amount: 0,
        reimburse: 0,
        refund: 0,
        balance: 0,
      }
    );
  }, [exportPreviewRows]);
  // =====================================================
  // EXCEL EXPORT
  // =====================================================

  function formatExpenseNumber(id: number) { return String(id).padStart(4, "0"); }

  async function exportToExcel() {
    if (
      (exportScope === "selected" && selectedExportPayees.length === 0) ||
      exportPreviewRows.length === 0 ||
      (exportMode === "materials" && selectedExportMaterials.length === 0)
    ) {
      alert("Please select payees and valid records before exporting.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "DCYES Finance Management System";
      workbook.created = new Date();
      workbook.modified = new Date();

      const pesoFormat = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
      const navy = "FF17365D";
      const headerNavy = "FF1F4E78";
      const white = "FFFFFFFF";
      const periodLabel = exportScope === "all"
        ? "ALL TRANSACTIONS - COMPLETE REPORT"
        : exportMode === "materials"
          ? "SELECTED MATERIALS ONLY - PARTIAL REPORT"
          : "SELECTED PAYEES - WHOLE TRANSACTIONS";

      // Both worksheets use the same layout as Daily Records.
      function buildSheet(
        name: string,
        headers: string[],
        rows: (string | number)[][],
        widths: number[],
        amountColumn: number,
        totalAmount: number,
        countColumn?: number,
        totalCount?: number
      ) {
        const sheet = workbook.addWorksheet(name);
        sheet.columns = headers.map((_header, index) => ({
          key: `column${index + 1}`,
          width: widths[index] || 18,
        }));

        sheet.mergeCells(1, 1, 1, headers.length);
        const systemTitle = sheet.getCell(1, 1);
        systemTitle.value = "DCYES FINANCE MANAGEMENT SYSTEM";
        systemTitle.font = {
          name: "Arial", size: 16, bold: true, color: { argb: white },
        };
        systemTitle.fill = {
          type: "pattern", pattern: "solid", fgColor: { argb: navy },
        };
        systemTitle.alignment = { horizontal: "center", vertical: "middle" };
        sheet.getRow(1).height = 30;

        sheet.mergeCells(2, 1, 2, headers.length);
        const reportTitle = sheet.getCell(2, 1);
        reportTitle.value = `${locationName.toUpperCase()} - ${name.toUpperCase()}`;
        reportTitle.font = {
          name: "Arial", size: 12, bold: true, color: { argb: navy },
        };
        reportTitle.alignment = { horizontal: "center", vertical: "middle" };
        sheet.getRow(2).height = 23;

        sheet.mergeCells(3, 1, 3, headers.length);
        const subtitle = sheet.getCell(3, 1);
        subtitle.value = `Period: ALL RECORDS | ${periodLabel} | Generated: ${new Date().toLocaleDateString("en-PH")}`;
        subtitle.font = {
          name: "Arial", size: 10, italic: true, color: { argb: "FF475569" },
        };
        subtitle.alignment = { horizontal: "center", vertical: "middle" };
        sheet.getRow(3).height = 21;

        sheet.getRow(4).height = 12;
        const headerRow = sheet.getRow(5);
        headerRow.height = 30;
        headers.forEach((header, index) => {
          const cell = headerRow.getCell(index + 1);
          cell.value = header;
          cell.font = {
            name: "Arial", size: 10, bold: true, color: { argb: white },
          };
          cell.fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: headerNavy },
          };
          cell.alignment = {
            horizontal: "center", vertical: "middle", wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFB4C6E7" } },
            bottom: { style: "thin", color: { argb: "FFB4C6E7" } },
            left: { style: "thin", color: { argb: "FFD9E2F3" } },
            right: { style: "thin", color: { argb: "FFD9E2F3" } },
          };
        });

        rows.forEach((values, index) => {
          const row = sheet.addRow(values);
          row.height = 22;
          row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = { vertical: "top", wrapText: true };
            if (index % 2 === 1) {
              cell.fill = {
                type: "pattern", pattern: "solid",
                fgColor: { argb: "FFF0F6FC" },
              };
            }
            cell.border = {
              bottom: { style: "hair", color: { argb: "FFD9E2F3" } },
            };
            if (columnNumber === amountColumn) {
              cell.numFmt = pesoFormat;
              cell.alignment = { horizontal: "right", vertical: "top" };
            }
          });
        });

        const totalValues: (string | number)[] = headers.map(() => "");
        totalValues[0] = "OVERALL TOTAL";
        totalValues[amountColumn - 1] = Number(totalAmount.toFixed(2));
        if (countColumn && typeof totalCount === "number") {
          totalValues[countColumn - 1] = totalCount;
        }
        const totalRow = sheet.addRow(totalValues);
        totalRow.height = 26;
        for (let column = 1; column <= headers.length; column++) {
          const cell = totalRow.getCell(column);
          cell.font = {
            name: "Arial", size: 10, bold: true, color: { argb: white },
          };
          cell.fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: navy },
          };
          cell.border = {
            top: { style: "medium", color: { argb: navy } },
          };
          if (column === amountColumn) {
            cell.numFmt = pesoFormat;
            cell.alignment = { horizontal: "right" };
          }
        }

        sheet.autoFilter = {
          from: { row: 5, column: 1 },
          to: { row: Math.max(5, 5 + rows.length), column: headers.length },
        };
        sheet.views = [{
          state: "frozen", xSplit: 0, ySplit: 5, showGridLines: false,
        }];
        sheet.pageSetup = {
          paperSize: 9, orientation: "landscape", fitToPage: true,
          fitToWidth: 1, fitToHeight: 0,
          margins: {
            left: 0.25, right: 0.25, top: 0.5, bottom: 0.5,
            header: 0.2, footer: 0.2,
          },
        };
        sheet.pageSetup.printArea = `A1:${sheet.getColumn(headers.length).letter}${totalRow.number}`;
        sheet.headerFooter.oddFooter =
          "&LDCYES Finance Management System&CPage &P of &N&RConfidential";
      }

      // Group only the already-selected preview rows. This preserves
      // partial material exports without counting unselected materials.
      const transactions = new Map<number, {
        date: string;
        payee: string;
        address: string;
        remarks: string;
        amount: number;
        itemCount: number;
      }>();
      for (const row of exportPreviewRows) {
        const existing = transactions.get(row.expenseId);
        if (existing) {
          existing.amount += Number(row.amount || 0);
          if (row.description) existing.itemCount += 1;
          if (!existing.remarks && row.remarks) existing.remarks = row.remarks;
        } else {
          transactions.set(row.expenseId, {
            date: row.expenseDate,
            payee: row.payee,
            address: row.address,
            remarks: row.remarks,
            amount: Number(row.amount || 0),
            itemCount: row.description ? 1 : 0,
          });
        }
      }

      // Number only the transactions in this export, ordered by the
      // actual expense date (oldest first). ID breaks same-date ties.
      const chronologicalTransactions = Array.from(transactions.entries()).sort(
        ([idA, a], [idB, b]) =>
          String(a.date || "").localeCompare(String(b.date || "")) || idA - idB
      );
      const exportNumbers = new Map<number, string>(
        chronologicalTransactions.map(([id], index) => [
          id,
          String(index + 1).padStart(4, "0"),
        ])
      );

      const summaryRows: (string | number)[][] = chronologicalTransactions
        .map(([expenseId, transaction]) => [
          exportNumbers.get(expenseId) || formatExpenseNumber(expenseId),
          transaction.date,
          transaction.payee,
          transaction.address,
          transaction.remarks,
          transaction.amount,
          transaction.itemCount,
        ]);

      const detailRows: (string | number)[][] = [...exportPreviewRows]
        .sort((a, b) =>
          String(a.expenseDate || "").localeCompare(String(b.expenseDate || "")) ||
          a.expenseId - b.expenseId
        )
        .map((row) => [
        exportNumbers.get(row.expenseId) || formatExpenseNumber(row.expenseId),
        row.expenseDate,
        row.payee,
        row.address,
        row.description,
        row.description ? row.qty : "",
        row.unit,
        row.description ? row.price : "",
        row.amount,
        row.remarks,
      ]);

      buildSheet(
        "Transaction Summary",
        ["Transaction No.", "Date", "Payee", "Address", "Remarks", "Total Amount", "Item Count"],
        summaryRows,
        [19, 18, 28, 32, 40, 20, 14],
        6,
        exportPreviewTotals.amount,
        7,
        exportPreviewRows.filter((row) => Boolean(row.description)).length
      );
      buildSheet(
        "Complete Item Details",
        ["Transaction No.", "Date", "Payee", "Address", "Description", "Qty", "Unit", "Price", "Amount", "Remarks"],
        detailRows,
        [19, 18, 28, 32, 42, 10, 12, 18, 20, 40],
        9,
        exportPreviewTotals.amount
      );

      // Quantity and unit price are numeric, with a peso format for price.
      const detailSheet = workbook.getWorksheet("Complete Item Details");
      if (detailSheet) {
        for (let rowNumber = 6; rowNumber < 6 + detailRows.length; rowNumber++) {
          detailSheet.getCell(rowNumber, 6).numFmt = "#,##0.##";
          detailSheet.getCell(rowNumber, 8).numFmt = pesoFormat;
          detailSheet.getCell(rowNumber, 8).alignment = { horizontal: "right" };
        }
      }

      const safeLocationName = locationName
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      const fileName = `${safeLocationName}_${exportScope === "all"
        ? "All_Monthly_Expenses"
        : exportMode === "materials"
          ? "Selected_Materials_Partial_Report"
          : "Monthly_Expenses"}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Keep the object URL alive briefly while the browser starts the download.
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("Monthly Expenses Excel export error:", error);
      alert("Excel export failed. Please check the browser console.");
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <section className="flex-1 p-8">

        {/* BACK */}

        <button
          type="button"
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

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">

          <div>

            <p className="text-sm text-gray-500">
              Location
            </p>

            <h1 className="text-3xl font-bold">
              📍 {locationName}
            </h1>

            <div className="flex items-center gap-3 mt-2">

              <p className="text-gray-500">
                Monthly Expenses
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
              type="button"
              onClick={() => { setExportScope("all"); setExportMode("whole"); setSelectedExportMaterials([]); setShowExportModal(true); }}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-lg font-medium"
            >
              📥 Export All
            </button>

            <button
              type="button"
              onClick={() => { setExportScope("selected"); setSelectedExportPayees([]); setSelectedExportMaterials([]); setExportMode("whole"); setShowExportModal(true); }}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-medium"
            >
              📥 Export Selected
            </button>

            <button
              type="button"
              onClick={() => {
                clearForm();

                setShowForm(
                  true
                );
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium"
            >
              + Add Expense
            </button>

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
                You can add, view, search, and export expenses. Existing records can only be edited or deleted by an Admin. New records are automatically saved as Pending.
              </p>

            </div>

          )}

        {/* SELECTIVE EXPORT PREVIEW MODAL */}

        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-[#1F3A5F] px-5 py-4 text-white sm:px-7">
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">Export Expenses</h2>
                  <p className="mt-1 text-sm text-blue-100">{exportScope === "all" ? "Review all transactions for this location before downloading." : "Select payees and review the report before downloading."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="rounded-lg px-3 py-2 text-xl font-bold text-white hover:bg-white/15"
                  aria-label="Close export preview"
                >
                  ×
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[300px_300px_minmax(0,1fr)] sm:p-7">
                <section className="rounded-xl border border-slate-200 p-4">
                  {exportScope === "all" ? (
                    <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
                      <p className="font-bold">Export All Transactions</p>
                      <p className="mt-2">Includes every loaded transaction for this location, even records without a payee. No selection required.</p>
                      <p className="mt-2">Both Excel worksheets will be generated.</p>
                    </div>
                  ) : <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">1. Select Payees</h3>
                    <span className="text-xs font-semibold text-slate-500">{selectedExportPayees.length} selected</span>
                  </div>

                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedExportPayees([...exportPayeeOptions])}
                      className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedExportPayees([]); setSelectedExportMaterials([]); }}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {exportPayeeOptions.map((payee) => (
                      <label key={payee} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 text-sm text-slate-800 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-blue-700"
                          checked={selectedExportPayees.includes(payee)}
                          onChange={(event) => {
                            const nextPayees = event.target.checked
                              ? [...selectedExportPayees, payee]
                              : selectedExportPayees.filter((value) => value !== payee);

                            setSelectedExportPayees(nextPayees);

                            const nextPayeeSet = new Set(nextPayees);
                            const availableMaterials = new Set(
                              expenses
                                .filter((expense) => nextPayeeSet.has(String(expense.payee || "").trim()))
                                .flatMap((expense) =>
                                  (expense.expense_items || []).map((item) => String(item.description || "").trim())
                                )
                                .filter(Boolean)
                            );

                            setSelectedExportMaterials((current) =>
                              current.filter((material) => availableMaterials.has(material))
                            );
                          }}
                        />
                        <span className="break-words font-medium">{payee}</span>
                      </label>
                    ))}
                    {exportPayeeOptions.length === 0 && (
                      <p className="py-5 text-center text-sm text-slate-500">No saved payees found.</p>
                    )}
                  </div>
                  </>}
                </section>

                {exportScope === "selected" && <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-base font-bold text-slate-900">2. Export Type</h3>

                  <div className="space-y-3">
                    <label className={`block cursor-pointer rounded-xl border p-4 ${exportMode === "whole" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="location-expense-export-mode"
                          checked={exportMode === "whole"}
                          onChange={() => setExportMode("whole")}
                          className="mt-1 h-4 w-4 accent-blue-700"
                        />
                        <span>
                          <span className="block font-bold text-slate-900">Whole Transactions</span>
                          <span className="mt-1 block text-sm text-slate-600">Include all materials and the full transaction details for selected payees.</span>
                        </span>
                      </span>
                    </label>

                    <label className={`block cursor-pointer rounded-xl border p-4 ${exportMode === "materials" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="location-expense-export-mode"
                          checked={exportMode === "materials"}
                          onChange={() => setExportMode("materials")}
                          className="mt-1 h-4 w-4 accent-blue-700"
                        />
                        <span>
                          <span className="block font-bold text-slate-900">Selected Materials Only</span>
                          <span className="mt-1 block text-sm text-slate-600">Include only the material descriptions you select. Totals will be partial.</span>
                        </span>
                      </span>
                    </label>
                  </div>

                  {exportMode === "materials" && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900">3. Select Materials</h4>
                        <span className="text-xs font-semibold text-slate-500">{selectedExportMaterials.length} selected</span>
                      </div>

                      <div className="mb-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedExportMaterials([...exportMaterialOptions])}
                          disabled={selectedExportPayees.length === 0}
                          className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedExportMaterials([])}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {exportMaterialOptions.map((material) => (
                          <label key={material} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 text-sm text-slate-800 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-blue-700"
                              checked={selectedExportMaterials.includes(material)}
                              onChange={(event) => {
                                setSelectedExportMaterials((current) =>
                                  event.target.checked
                                    ? [...current, material]
                                    : current.filter((value) => value !== material)
                                );
                              }}
                            />
                            <span className="break-words">{material}</span>
                          </label>
                        ))}
                        {selectedExportPayees.length === 0 && (
                          <p className="text-sm text-slate-500">Select at least one payee first.</p>
                        )}
                        {selectedExportPayees.length > 0 && exportMaterialOptions.length === 0 && (
                          <p className="text-sm text-slate-500">No material items found for the selected payees.</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>}

                <section className="min-w-0 rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Export Preview</h3>
                      <p className="mt-1 text-sm text-slate-500">{exportPreviewRows.length} row(s) · {locationName}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${exportMode === "materials" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                      {exportScope === "all" ? "ALL TRANSACTIONS" : exportMode === "materials" ? "PARTIAL MATERIAL REPORT" : "WHOLE TRANSACTIONS"}
                    </span>
                  </div>

                  {exportMode === "materials" && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Partial report only. Reimburse, refund, and full transaction balances are excluded.
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">Amount</p>
                      <p className="mt-1 break-all text-base font-bold text-slate-900">₱{exportPreviewTotals.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">Reimburse</p>
                      <p className="mt-1 break-all text-base font-bold text-slate-900">₱{exportPreviewTotals.reimburse.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500">Refund</p>
                      <p className="mt-1 break-all text-base font-bold text-slate-900">₱{exportPreviewTotals.refund.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-700">Balance / Subtotal</p>
                      <p className="mt-1 break-all text-base font-bold text-blue-900">₱{exportPreviewTotals.balance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="max-h-[42vh] overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 bg-[#1F3A5F] text-white">
                        <tr>
                          {["Date", "Payee", "Address", "Description", "Qty", "Unit", "Price", "Amount", "Reimburse", "Refund", "Balance", "Remarks"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-3 py-3 font-semibold">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {exportPreviewRows.map((row, index) => (
                          <tr key={`${row.expenseId}-${index}`} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                            <td className="whitespace-nowrap px-3 py-2">{row.expenseDate}</td>
                            <td className="px-3 py-2">{row.payee}</td>
                            <td className="px-3 py-2">{row.address}</td>
                            <td className="px-3 py-2">{row.description}</td>
                            <td className="px-3 py-2 text-right">{row.qty || ""}</td>
                            <td className="px-3 py-2">{row.unit}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">{row.price ? `₱${row.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">₱{row.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">₱{row.reimburse.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">₱{row.refund.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">₱{row.balance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2">{row.remarks}</td>
                          </tr>
                        ))}
                        {exportPreviewRows.length === 0 && (
                          <tr>
                              <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                              {exportScope === "all" ? "No transactions found for this location." : <>Select payees{exportMode === "materials" ? " and materials" : ""} to see the export preview.</>}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
                <p className="text-sm text-slate-600">Review the selected records before downloading.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      (exportScope === "selected" && selectedExportPayees.length === 0) ||
                      exportPreviewRows.length === 0 ||
                      (exportMode === "materials" && selectedExportMaterials.length === 0)
                    }
                    onClick={async () => {
                      await exportToExcel();
                      setShowExportModal(false);
                    }}
                    className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Download Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ADD / EDIT FORM */}

        {showForm && (

          <div className="bg-white rounded-xl shadow p-6 mb-8">

            <div className="flex items-center justify-between mb-6">

              <h2 className="text-xl font-bold">

                {editingId !==
                null
                  ? "Edit Monthly Expense"
                  : "Add Monthly Expense"}

              </h2>

              {editingId !==
                null && (

                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  Editing Record #{editingId}
                </span>

              )}

            </div>

            <form
              onSubmit={
                saveExpense
              }
            >

              {/* BASIC INFO */}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

                <div>

                  <label className="block text-sm font-medium mb-2">
                    Date *
                  </label>

                  <input
                    type="date"
                    value={
                      date
                    }
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
                    value={
                      payee
                    }
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
                    value={
                      address
                    }
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
                    onClick={
                      addItem
                    }
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
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "description",
                                    e.target.value
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
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "qty",
                                    e.target.value
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
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "unit",
                                    e.target.value
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
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "price",
                                    e.target.value
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

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

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
                    value={
                      refund
                    }
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

              </div>

              {/* REMARKS */}

              <div className="mt-5">

                <label className="block text-sm font-medium mb-2">
                  Remarks
                </label>

                <input
                  type="text"
                  value={
                    remarks
                  }
                  onChange={(e) =>
                    setRemarks(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full border rounded-lg p-3"
                />

              </div>

              {/* FORM BUTTONS */}

              <div className="flex justify-end gap-3 mt-6">

                <button
                  type="button"
                  onClick={() => {
                    clearForm();

                    setShowForm(
                      false
                    );
                  }}
                  className="px-5 py-3 border rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

          <div className="bg-white rounded-xl shadow p-5">

            <p className="text-gray-500 text-sm">
              Total Transactions
            </p>

            <p className="text-3xl font-bold mt-2">
              {filteredExpenses.length}
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
            value={
              search
            }
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

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-bold">
                Expense Records
              </h2>

              {!loadingRole && (
                <span className="text-sm text-gray-500">
                  {isAdmin
                    ? "Admin controls enabled"
                    : "View-only existing records"}
                </span>
              )}

            </div>

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
                      Transaction No.
                    </th>

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

                          {/* TRANSACTION NUMBER */}

                          <td className="p-4 font-semibold whitespace-nowrap">
                            {formatExpenseNumber(expense.id)}
                          </td>

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
                            {expense.payee}
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
                                    item,
                                    index
                                  ) => (

                                    <div
                                      key={
                                        item.id ??
                                        `desc-${index}`
                                      }
                                    >
                                      {item.description}
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
                                    item,
                                    index
                                  ) => (

                                    <div
                                      key={
                                        item.id ??
                                        `qty-${index}`
                                      }
                                    >
                                      {item.qty}
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
                                    item,
                                    index
                                  ) => (

                                    <div
                                      key={
                                        item.id ??
                                        `unit-${index}`
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
                                    item,
                                    index
                                  ) => (

                                    <div
                                      key={
                                        item.id ??
                                        `price-${index}`
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

                          {/* AMOUNT */}

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

                          {/* REMARKS */}

                          <td className="p-4">
                            {expense.remarks ||
                              "-"}
                          </td>

                          {/* ACTION */}

                          <td className="p-4">

                            {loadingRole ? (

                              <span className="text-gray-400 text-xs">
                                Checking...
                              </span>

                            ) : isAdmin ? (

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

                            ) : (

                              <span className="inline-flex px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium whitespace-nowrap">
                                👁️ View Only
                              </span>

                            )}

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
