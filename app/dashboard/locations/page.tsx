
"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type Location = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
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
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const isAdmin =
    String(profile?.position || "").trim().toLowerCase() === "admin" &&
    String(profile?.status || "").trim().toLowerCase() === "active";

  async function loadCurrentProfile() {
    setLoadingProfile(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user?.email) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, position, status")
        .eq("email", authData.user.email)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("Profile error:", error);
        setProfile(null);
        return;
      }

      setProfile(data as CurrentProfile);
    } catch (error) {
      console.error("Load current profile error:", error);
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function loadLocations() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, description, address, created_at")
        .order("name", { ascending: true });

      if (error) {
        console.error("Load locations error:", error);
        alert("Hindi makuha ang locations: " + error.message);
        setLocations([]);
        return;
      }

      setLocations((data || []) as Location[]);
    } catch (error) {
      console.error("Load locations error:", error);
      alert("May error habang kinukuha ang locations.");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentProfile();
    void loadLocations();
  }, []);

  async function saveLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isAdmin) {
      alert("Admin only ang pag-add o pag-edit ng location.");
      return;
    }

    if (!name.trim()) {
      alert("Ilagay muna ang pangalan ng location.");
      return;
    }

    setSaving(true);

    try {
      const locationData = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
      };

      if (editingId !== null) {
        const { error } = await supabase
          .from("locations")
          .update(locationData)
          .eq("id", editingId);

        if (error) {
          alert("Hindi na-update ang location: " + error.message);
          return;
        }

        alert("Location successfully updated!");
      } else {
        const { error } = await supabase
          .from("locations")
          .insert(locationData);

        if (error) {
          alert("Hindi na-save ang location: " + error.message);
          return;
        }

        alert("Location successfully added!");
      }

      clearForm();
      await loadLocations();
    } catch (error) {
      console.error("Save location error:", error);
      alert("May unexpected error habang nagse-save ng location.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(location: Location) {
    if (!isAdmin) {
      alert("Admin only ang pag-edit ng location.");
      return;
    }

    setEditingId(location.id);
    setName(location.name);
    setDescription(location.description || "");
    setAddress(location.address || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setAddress("");
  }

  async function deleteLocation(location: Location) {
    if (!isAdmin) {
      alert("Admin only ang pag-delete ng location.");
      return;
    }

    const confirmed = window.confirm(
      `WARNING: Permanent Delete\n\n` +
        `Location: ${location.name}\n\n` +
        `Maaaring maapektuhan ang connected financial records.\n\n` +
        `Siguraduhing tama ang location bago magpatuloy.\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    const typedName = window.prompt(
      `I-type ang eksaktong location name para mag-delete:\n\n${location.name}`
    );

    if (typedName === null) return;

    if (
      typedName.trim().toLowerCase() !==
      location.name.trim().toLowerCase()
    ) {
      alert("Hindi tugma ang location name. Cancelled ang deletion.");
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        alert("Walang active login session. Mag-login ulit.");
        return;
      }

      const response = await fetch(
        `/api/admin/location/${location.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Delete location API error:", result);
        alert(
          "Hindi ma-delete ang location.\n\n" +
            (result.error || "Unknown server error.")
        );
        return;
      }

      alert(`Location "${location.name}" successfully deleted.`);

      if (editingId === location.id) clearForm();

      await loadLocations();
    } catch (error) {
      console.error("Delete location error:", error);
      alert("May unexpected error habang dine-delete ang location.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="flex">
        <Sidebar />

        <section className="flex-1 p-6 md:p-8 lg:p-10">
          <div className="mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Locations
                </h1>
                <p className="mt-2 text-gray-500">
                  {isAdmin
                    ? "Manage company locations and branches"
                    : "View company locations and branches"}
                </p>
              </div>

              {!loadingProfile && (
                <div
                  className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                    isAdmin
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isAdmin ? "👑 Admin Access" : "👤 Office Staff Access"}
                </div>
              )}
            </div>
          </div>

          {!loadingProfile && isAdmin ? (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-2 text-xl font-bold text-slate-900">
                  {editingId !== null ? "Edit Location" : "Add New Location"}
                </h2>

                <p className="mb-6 text-sm text-gray-500">
                  Add the location details and its default address.
                </p>

                <form onSubmit={saveLocation}>
                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-medium">
                      Location Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={name}
                      disabled={saving}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Example: Cavite"
                      className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-medium">
                      Default Address
                    </label>
                    <textarea
                      value={address}
                      disabled={saving}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter the default project or office address"
                      rows={3}
                      maxLength={2000}
                      className="w-full resize-y rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      This address will be suggested when this location is
                      selected in Daily Records.
                    </p>
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      value={description}
                      disabled={saving}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Example: Cavite Office"
                      rows={4}
                      className="w-full resize-y rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
                        onClick={clearForm}
                        disabled={saving}
                        className="rounded-xl border border-slate-300 px-5 py-3 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-200 p-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Registered Locations
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {locations.length} location
                      {locations.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <LocationList
                  locations={locations}
                  loading={loading}
                  isAdmin
                  onEdit={startEdit}
                  onDelete={deleteLocation}
                />
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Registered Locations
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Select a location to view its financial records.
                </p>
              </div>

              <LocationList
                locations={locations}
                loading={loading}
                isAdmin={false}
                onEdit={startEdit}
                onDelete={deleteLocation}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

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
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
}) {
  if (loading) {
    return (
      <div className="p-10 text-center text-gray-500">
        Loading locations...
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500">
        No locations yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {locations.map((location) => (
        <div
          key={location.id}
          className="p-6 transition hover:bg-slate-50"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">
                📍 {location.name}
              </h3>

              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500">
                {location.description || "No description"}
              </p>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Default Address
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {location.address || "No default address set"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/dashboard/locations/${location.id}`;
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
              >
                Open
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(location)}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(location)}
                    className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
