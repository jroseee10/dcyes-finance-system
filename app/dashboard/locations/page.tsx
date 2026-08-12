"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Location = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

type CurrentProfile = {
  id: number;
  name: string;
  email: string;
  position: string;
  status: string;
};

export default function LocationsPage() {
  // =====================================================
  // LOCATION DATA
  // =====================================================

  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  // =====================================================
  // CURRENT USER / ROLE
  // =====================================================

  const [profile, setProfile] =
    useState<CurrentProfile | null>(null);

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  const isAdmin =
    String(profile?.position || "")
      .trim()
      .toLowerCase() === "admin";

  // =====================================================
  // LOAD CURRENT PROFILE
  // =====================================================

  async function loadCurrentProfile() {
    setLoadingProfile(true);

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
        setProfile(null);
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("users")
        .select(
          "id, name, email, position, status"
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

        setProfile(null);
        return;
      }

      if (!profileData) {
        setProfile(null);
        return;
      }

      setProfile(
        profileData as CurrentProfile
      );
    } catch (error) {
      console.error(
        "Load current profile error:",
        error
      );

      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  // =====================================================
  // LOAD LOCATIONS
  // =====================================================

  async function loadLocations() {
    setLoading(true);

    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error(error);

      alert(
        "Hindi makuha ang locations: " +
          error.message
      );

      setLocations([]);
    } else {
      setLocations(
        (data || []) as Location[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCurrentProfile();
    loadLocations();
  }, []);

  // =====================================================
  // SAVE LOCATION
  // =====================================================

  async function saveLocation(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!isAdmin) {
      alert(
        "Admin only ang pag-add o pag-edit ng location."
      );
      return;
    }

    if (!name.trim()) {
      alert(
        "Ilagay muna ang pangalan ng location."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId !== null) {
        // ===============================================
        // EDIT LOCATION
        // ===============================================

        const { error } = await supabase
          .from("locations")
          .update({
            name: name.trim(),
            description:
              description.trim() || null,
          })
          .eq(
            "id",
            editingId
          );

        if (error) {
          alert(
            "Hindi na-update ang location: " +
              error.message
          );
          return;
        }

        alert(
          "Location successfully updated!"
        );
      } else {
        // ===============================================
        // ADD LOCATION
        // ===============================================

        const { error } = await supabase
          .from("locations")
          .insert({
            name: name.trim(),
            description:
              description.trim() || null,
          });

        if (error) {
          alert(
            "Hindi na-save ang location: " +
              error.message
          );
          return;
        }

        alert(
          "Location successfully added!"
        );
      }

      clearForm();

      await loadLocations();
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // START EDIT
  // =====================================================

  function startEdit(
    location: Location
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-edit ng location."
      );
      return;
    }

    setEditingId(
      location.id
    );

    setName(
      location.name
    );

    setDescription(
      location.description || ""
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================================
  // CLEAR FORM
  // =====================================================

  function clearForm() {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  // =====================================================
  // DELETE LOCATION
  // =====================================================

  async function deleteLocation(
    location: Location
  ) {
    if (!isAdmin) {
      alert(
        "Admin only ang pag-delete ng location."
      );
      return;
    }

    const firstConfirm =
      window.confirm(
        `WARNING: Permanent Delete\n\n` +
          `Location: ${location.name}\n\n` +
          `Kapag ipinagpatuloy mo ito, permanently deleted ang location at lahat ng connected records nito:\n\n` +
          `• Monthly Expenses\n` +
          `• Expense Items\n` +
          `• Liquidations\n` +
          `• Telegraphic Transfers\n` +
          `• Deposit Slips\n\n` +
          `Hindi na ito mare-recover.\n\n` +
          `Continue?`
      );

    if (!firstConfirm) {
      return;
    }

    const typedName =
      window.prompt(
        `Final confirmation.\n\n` +
          `I-type ang eksaktong location name para mag-delete:\n\n` +
          `${location.name}`
      );

    if (typedName === null) {
      return;
    }

    if (
      typedName.trim().toLowerCase() !==
      location.name.trim().toLowerCase()
    ) {
      alert(
        "Hindi tugma ang location name.\n\n" +
          "Cancelled ang deletion."
      );
      return;
    }

    try {
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionData.session
      ) {
        alert(
          "Walang active login session. Mag-login ulit."
        );
        return;
      }

      const accessToken =
        sessionData.session.access_token;

      const response =
        await fetch(
          `/api/admin/location/${location.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        console.error(
          "Delete location API error:",
          result
        );

        alert(
          "Hindi ma-delete ang location.\n\n" +
            (result.error ||
              "Unknown server error.")
        );
        return;
      }

      alert(
        `Location "${location.name}" successfully deleted.\n\n` +
          "Kasama ang lahat ng connected financial records nito."
      );

      if (
        editingId ===
        location.id
      ) {
        clearForm();
      }

      await loadLocations();
    } catch (error) {
      console.error(
        "Delete location error:",
        error
      );

      alert(
        "May unexpected error habang dine-delete ang location."
      );
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">

      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-6 md:p-8 lg:p-10">

          {/* =================================================
              HEADER
          ================================================= */}

          <div className="mb-8">

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">

              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Locations
                </h1>

                <p className="text-gray-500 mt-2">
                  {isAdmin
                    ? "Manage company locations and branches"
                    : "View company locations and branches"}
                </p>
              </div>

              {!loadingProfile && (
                <div
                  className={`w-fit px-4 py-2 rounded-full text-sm font-semibold ${
                    isAdmin
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isAdmin
                    ? "👑 Admin Access"
                    : "👤 Office Staff Access"}
                </div>
              )}

            </div>

          </div>

          {/* =================================================
              ADMIN VIEW
          ================================================= */}

          {!loadingProfile &&
          isAdmin ? (

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

              {/* =============================================
                  ADD / EDIT FORM
              ============================================= */}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

                <h2 className="text-xl font-bold mb-2 text-slate-900">
                  {editingId !== null
                    ? "Edit Location"
                    : "Add New Location"}
                </h2>

                <p className="text-sm text-gray-500 mb-6">
                  {editingId !== null
                    ? "Update the selected company location."
                    : "Create a new company location or branch."}
                </p>

                <form
                  onSubmit={
                    saveLocation
                  }
                >

                  <div className="mb-5">

                    <label className="block text-sm font-medium mb-2">
                      Location Name *
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target.value
                        )
                      }
                      placeholder="Example: Cavite"
                      className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                  </div>

                  <div className="mb-5">

                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>

                    <textarea
                      value={description}
                      onChange={(e) =>
                        setDescription(
                          e.target.value
                        )
                      }
                      placeholder="Example: Cavite Office"
                      rows={5}
                      className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />

                  </div>

                  <div className="flex gap-3">

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : editingId !== null
                        ? "💾 Save Changes"
                        : "+ Save Location"}
                    </button>

                    {editingId !== null && (
                      <button
                        type="button"
                        onClick={
                          clearForm
                        }
                        disabled={saving}
                        className="px-5 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}

                  </div>

                </form>

              </div>

              {/* =============================================
                  LOCATION LIST
              ============================================= */}

              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="p-6 border-b border-slate-200 flex items-center justify-between">

                  <div>

                    <h2 className="text-xl font-bold text-slate-900">
                      Registered Locations
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      {locations.length} location
                      {locations.length !== 1
                        ? "s"
                        : ""}
                    </p>

                  </div>

                </div>

                <LocationList
                  locations={
                    locations
                  }
                  loading={
                    loading
                  }
                  isAdmin={
                    true
                  }
                  onEdit={
                    startEdit
                  }
                  onDelete={
                    deleteLocation
                  }
                />

              </div>

            </div>

          ) : (

            /* =================================================
                OFFICE STAFF VIEW
            ================================================= */

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              <div className="p-6 border-b border-slate-200">

                <h2 className="text-xl font-bold text-slate-900">
                  Registered Locations
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Select a location to view its financial records.
                </p>

              </div>

              <LocationList
                locations={
                  locations
                }
                loading={
                  loading
                }
                isAdmin={
                  false
                }
                onEdit={
                  startEdit
                }
                onDelete={
                  deleteLocation
                }
              />

            </div>

          )}

        </section>

      </div>

    </main>
  );
}

// =====================================================
// LOCATION LIST
// =====================================================

function LocationList({
  locations,
  loading,
  isAdmin,
  onEdit,
  onDelete,
}: {
  locations: Location[];
  loading: boolean;
  isAdmin: boolean;
  onEdit: (
    location: Location
  ) => void;
  onDelete: (
    location: Location
  ) => void;
}) {
  if (loading) {
    return (
      <div className="p-10 text-center text-gray-500">
        Loading locations...
      </div>
    );
  }

  if (
    locations.length === 0
  ) {
    return (
      <div className="p-10 text-center text-gray-500">
        No locations yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">

      {locations.map(
        (location) => (

          <div
            key={location.id}
            className="p-6 hover:bg-slate-50 transition"
          >

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              {/* LOCATION */}

              <div>

                <h3 className="text-lg font-semibold text-slate-900">
                  📍 {location.name}
                </h3>

                <p className="text-gray-500 mt-1">
                  {location.description ||
                    "No description"}
                </p>

              </div>

              {/* ACTIONS */}

              <div className="flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      `/dashboard/locations/${location.id}`;
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Open
                </button>

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onEdit(
                          location
                        )
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDelete(
                          location
                        )
                      }
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Delete
                    </button>
                  </>
                )}

              </div>

            </div>

          </div>
        )
      )}

    </div>
  );
}