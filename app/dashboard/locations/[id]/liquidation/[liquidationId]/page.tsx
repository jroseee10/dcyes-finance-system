"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Liquidation = {
  id: number;
  location_id: number;
  liquidation_date: string;
  payee: string;
  address: string | null;
  tin: string | null;
  description: string | null;
  amount: number;
  tax_type: string;
  receipt_url: string | null;
  remarks: string | null;
  status: string;
};

export default function LiquidationDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const locationId = Number(params.id);
  const liquidationId = Number(params.liquidationId);

  const [locationName, setLocationName] = useState("");

  const [liquidation, setLiquidation] =
    useState<Liquidation | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // =====================================================
  // CURRENT USER / ROLE
  // =====================================================

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

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

  // =====================================================
  // LOAD
  // =====================================================

  useEffect(() => {
    if (
      !locationId ||
      !liquidationId
    ) {
      return;
    }

    loadCurrentUserRole();
    loadLocation();
    loadLiquidation();
  }, [
    locationId,
    liquidationId,
  ]);

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
        .select(
          "position, status"
        )
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
        String(
          profile?.status || ""
        )
          .trim()
          .toLowerCase() ===
        "active";

      const admin =
        String(
          profile?.position || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";

      setIsAdmin(
        active && admin
      );
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
  // LOAD LOCATION
  // =====================================================

  async function loadLocation() {
    const {
      data,
      error,
    } = await supabase
      .from("locations")
      .select("name")
      .eq(
        "id",
        locationId
      )
      .single();

    if (error) {
      console.error(
        error
      );

      return;
    }

    setLocationName(
      data.name
    );
  }

  // =====================================================
  // LOAD LIQUIDATION
  // =====================================================

  async function loadLiquidation() {
    setLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from("liquidations")
      .select("*")
      .eq(
        "id",
        liquidationId
      )
      .eq(
        "location_id",
        locationId
      )
      .single();

    if (error) {
      console.error(
        error
      );

      alert(
        "Hindi ma-load ang liquidation:\n" +
          error.message
      );

      setLoading(false);

      return;
    }

    setLiquidation(
      data
    );

    setForm({
      liquidation_date:
        data.liquidation_date ||
        "",

      payee:
        data.payee ||
        "",

      address:
        data.address ||
        "",

      tin:
        data.tin ||
        "",

      description:
        data.description ||
        "",

      amount:
        String(
          data.amount ||
            ""
        ),

      tax_type:
        data.tax_type ||
        "Non-Tax",

      receipt_url:
        data.receipt_url ||
        "",

      remarks:
        data.remarks ||
        "",

      status:
        data.status ||
        "Pending",
    });

    setLoading(false);
  }

  // =====================================================
  // FORM CHANGE
  // =====================================================

  function handleChange(
    e: React.ChangeEvent<
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    >
  ) {
    const {
      name,
      value,
    } = e.target;

    setForm(
      (prev) => ({
        ...prev,
        [name]:
          value,
      })
    );
  }

  // =====================================================
  // UPLOAD RECEIPT - ADMIN ONLY
  // =====================================================

  async function uploadReceipt(
    file: File
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pagpalit ng receipt."
      );

      return;
    }

    if (!file) {
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        "Maximum receipt size is 5MB."
      );

      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Please upload an image file."
      );

      return;
    }

    setUploading(true);

    try {
      const fileExt =
        file.name
          .split(".")
          .pop() ||
        "jpg";

      const fileName =
        `${locationId}-${liquidationId}-${Date.now()}.${fileExt}`;

      const filePath =
        `${locationId}/${fileName}`;

      const {
        error:
          uploadError,
      } = await supabase.storage
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
          }
        );

      if (
        uploadError
      ) {
        console.error(
          uploadError
        );

        alert(
          "Hindi ma-upload ang receipt:\n" +
            uploadError.message
        );

        return;
      }

      const {
        data,
      } = supabase.storage
        .from(
          "receipts"
        )
        .getPublicUrl(
          filePath
        );

      setForm(
        (prev) => ({
          ...prev,

          receipt_url:
            data.publicUrl,
        })
      );

      alert(
        "Bagong receipt uploaded! ✅"
      );
    } catch (error) {
      console.error(
        "Receipt upload error:",
        error
      );

      alert(
        "May error habang nag-u-upload ng receipt."
      );
    } finally {
      setUploading(false);
    }
  }

  // =====================================================
  // SAVE CHANGES - ADMIN ONLY
  // =====================================================

  async function saveChanges(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!isAdmin) {
      alert(
        "Admin only ang pag-edit ng liquidation."
      );

      return;
    }

    if (
      !form.liquidation_date
    ) {
      alert(
        "Ilagay ang date."
      );

      return;
    }

    if (
      !form.payee.trim()
    ) {
      alert(
        "Ilagay ang payee."
      );

      return;
    }

    if (
      !form.amount
    ) {
      alert(
        "Ilagay ang amount."
      );

      return;
    }

    setSaving(true);

    try {
      const {
        error,
      } = await supabase
        .from(
          "liquidations"
        )
        .update({
          liquidation_date:
            form.liquidation_date,

          payee:
            form.payee,

          address:
            form.address ||
            null,

          tin:
            form.tin ||
            null,

          description:
            form.description ||
            null,

          amount:
            Number(
              form.amount
            ),

          tax_type:
            form.tax_type,

          receipt_url:
            form.receipt_url ||
            null,

          remarks:
            form.remarks ||
            null,

          status:
            form.status,
        })
        .eq(
          "id",
          liquidationId
        )
        .eq(
          "location_id",
          locationId
        );

      if (error) {
        console.error(
          error
        );

        alert(
          "Hindi na-update ang record:\n" +
            error.message
        );

        return;
      }

      alert(
        "Liquidation updated successfully! ✅"
      );

      setEditing(
        false
      );

      await loadLiquidation();
    } catch (error) {
      console.error(
        "Update liquidation error:",
        error
      );

      alert(
        "May error habang ina-update ang liquidation."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // DELETE - ADMIN ONLY
  // =====================================================

  async function deleteLiquidation() {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-delete ng liquidation."
      );

      return;
    }

    const confirmed =
      confirm(
        "Sigurado ka bang gusto mong burahin ang liquidation record na ito?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from(
          "liquidations"
        )
        .delete()
        .eq(
          "id",
          liquidationId
        )
        .eq(
          "location_id",
          locationId
        );

      if (error) {
        console.error(
          error
        );

        alert(
          "Hindi mabura ang record:\n" +
            error.message
        );

        return;
      }

      alert(
        "Liquidation deleted successfully. ✅"
      );

      router.push(
        `/dashboard/locations/${locationId}/liquidation`
      );
    } catch (error) {
      console.error(
        "Delete liquidation error:",
        error
      );

      alert(
        "May error habang dine-delete ang liquidation."
      );
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex">

        <Sidebar />

        <section className="flex-1 p-8">

          <div className="bg-white rounded-xl shadow p-10 text-center">
            Loading liquidation...
          </div>

        </section>

      </main>
    );
  }

  // =====================================================
  // NOT FOUND
  // =====================================================

  if (
    !liquidation
  ) {
    return (
      <main className="min-h-screen bg-slate-100 flex">

        <Sidebar />

        <section className="flex-1 p-8">

          <div className="bg-white rounded-xl shadow p-10 text-center">

            <p className="text-xl font-bold">
              Liquidation not found
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/liquidation`
                )
              }
              className="mt-5 bg-blue-600 text-white px-5 py-2 rounded-lg"
            >
              Back to Liquidation
            </button>

          </div>

        </section>

      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <section className="flex-1 p-8">

        {/* HEADER */}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">

          <div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/locations/${locationId}/liquidation`
                )
              }
              className="text-sm text-blue-600 hover:underline mb-3"
            >
              ← Back to Liquidation
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Liquidation Details
            </h1>

            <div className="flex items-center gap-3 mt-2">

              <p className="text-slate-500">
                Location:{" "}
                <span className="font-semibold text-slate-700">
                  {locationName}
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

          {/* ACTIONS */}

          <div className="flex gap-3">

            {!loadingRole &&
            isAdmin ? (
              <>
                {!editing && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditing(
                        true
                      )
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium"
                  >
                    ✏️ Edit
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    deleteLiquidation
                  }
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg font-medium"
                >
                  🗑 Delete
                </button>
              </>
            ) : !loadingRole ? (
              <span className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium">
                👁️ View Only
              </span>
            ) : null}

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
                You can view the liquidation details and receipt. Editing and deleting are restricted to Admin users.
              </p>

            </div>

          )}

        {/* EDIT / VIEW */}

        {editing &&
        isAdmin ? (

          <form
            onSubmit={
              saveChanges
            }
            className="bg-white rounded-xl shadow p-6"
          >

            <h2 className="text-xl font-bold mb-6">
              Edit Liquidation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

              {/* DATE */}

              <div>

                <label className="block text-sm font-medium mb-2">
                  Date
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
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

              {/* PAYEE */}

              <div>

                <label className="block text-sm font-medium mb-2">
                  Payee
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
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

              {/* TIN */}

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
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

              {/* ADDRESS */}

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
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

              {/* DESCRIPTION */}

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
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

              {/* AMOUNT */}

              <div>

                <label className="block text-sm font-medium mb-2">
                  Amount
                </label>

                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={
                    form.amount
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

              {/* TAX */}

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
                  className="w-full border rounded-lg px-3 py-2"
                >

                  <option value="Non-Tax">
                    Non-Tax
                  </option>

                  <option value="With Tax">
                    With Tax
                  </option>

                </select>

              </div>

              {/* STATUS */}

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
                  className="w-full border rounded-lg px-3 py-2"
                >

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Approved">
                    Approved
                  </option>

                  <option value="Rejected">
                    Rejected
                  </option>

                </select>

              </div>

              {/* RECEIPT */}

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

                    if (
                      file
                    ) {
                      uploadReceipt(
                        file
                      );
                    }
                  }}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                />

                {uploading && (
                  <p className="text-sm text-blue-600 mt-2">
                    Uploading receipt...
                  </p>
                )}

                {form.receipt_url && (
                  <div className="mt-3">

                    <a
                      href={
                        form.receipt_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Current Receipt
                    </a>

                  </div>
                )}

              </div>

              {/* REMARKS */}

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
                  rows={
                    4
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />

              </div>

            </div>

            {/* SAVE BUTTONS */}

            <div className="flex justify-end gap-3 mt-6">

              <button
                type="button"
                onClick={() => {
                  setEditing(
                    false
                  );

                  loadLiquidation();
                }}
                className="px-5 py-2.5 rounded-lg border"
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
                  : "💾 Save Changes"}
              </button>

            </div>

          </form>

        ) : (

          /* =================================================
             VIEW DETAILS
          ================================================= */

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* INFORMATION */}

            <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">

              <h2 className="text-xl font-bold text-slate-800 mb-6">
                Transaction Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* DATE */}

                <div>

                  <p className="text-sm text-slate-500">
                    Date
                  </p>

                  <p className="font-semibold mt-1">
                    {new Date(
                      liquidation.liquidation_date +
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
                  </p>

                </div>

                {/* PAYEE */}

                <div>

                  <p className="text-sm text-slate-500">
                    Payee
                  </p>

                  <p className="font-semibold mt-1">
                    {liquidation.payee}
                  </p>

                </div>

                {/* TIN */}

                <div>

                  <p className="text-sm text-slate-500">
                    TIN
                  </p>

                  <p className="font-semibold mt-1">
                    {liquidation.tin ||
                      "-"}
                  </p>

                </div>

                {/* ADDRESS */}

                <div>

                  <p className="text-sm text-slate-500">
                    Address
                  </p>

                  <p className="font-semibold mt-1">
                    {liquidation.address ||
                      "-"}
                  </p>

                </div>

                {/* DESCRIPTION */}

                <div>

                  <p className="text-sm text-slate-500">
                    Description
                  </p>

                  <p className="font-semibold mt-1">
                    {liquidation.description ||
                      "-"}
                  </p>

                </div>

                {/* AMOUNT */}

                <div>

                  <p className="text-sm text-slate-500">
                    Amount
                  </p>

                  <p className="text-2xl font-bold text-green-600 mt-1">

                    ₱
                    {Number(
                      liquidation.amount
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}

                  </p>

                </div>

                {/* TAX TYPE */}

                <div>

                  <p className="text-sm text-slate-500">
                    Tax Type
                  </p>

                  <p className="font-semibold mt-1">
                    {liquidation.tax_type}
                  </p>

                </div>

                {/* STATUS */}

                <div>

                  <p className="text-sm text-slate-500">
                    Status
                  </p>

                  <span
                    className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                      liquidation.status ===
                      "Approved"
                        ? "bg-green-100 text-green-700"
                        : liquidation.status ===
                            "Rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {liquidation.status}
                  </span>

                </div>

              </div>

              {/* REMARKS */}

              <div className="mt-8">

                <p className="text-sm text-slate-500">
                  Remarks
                </p>

                <div className="mt-2 bg-slate-50 rounded-lg p-4">
                  {liquidation.remarks ||
                    "No remarks"}
                </div>

              </div>

            </div>

            {/* RECEIPT */}

            <div className="bg-white rounded-xl shadow p-6">

              <h2 className="text-xl font-bold text-slate-800 mb-6">
                Receipt
              </h2>

              {liquidation.receipt_url ? (

                <div>

                  <img
                    src={
                      liquidation.receipt_url
                    }
                    alt="Receipt"
                    className="w-full rounded-lg border object-contain max-h-[500px]"
                  />

                  <a
                    href={
                      liquidation.receipt_url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium"
                  >
                    🔍 Open Full Receipt
                  </a>

                </div>

              ) : (

                <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
                  No receipt uploaded.
                </div>

              )}

            </div>

          </div>

        )}

      </section>

    </main>
  );
}