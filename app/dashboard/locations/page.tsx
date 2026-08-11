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

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadLocations() {
    setLoading(true);

    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Hindi makuha ang locations: " + error.message);
    } else {
      setLocations(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLocations();
  }, []);

  async function saveLocation(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Ilagay muna ang pangalan ng location.");
      return;
    }

    setSaving(true);

    if (editingId !== null) {
      // EDIT
      const { error } = await supabase
        .from("locations")
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq("id", editingId);

      setSaving(false);

      if (error) {
        alert("Hindi na-update ang location: " + error.message);
        return;
      }

      alert("Location successfully updated!");
    } else {
      // ADD
      const { error } = await supabase
        .from("locations")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
        });

      setSaving(false);

      if (error) {
        alert("Hindi na-save ang location: " + error.message);
        return;
      }

      alert("Location successfully added!");
    }

    clearForm();
    loadLocations();
  }

  function startEdit(location: Location) {
    setEditingId(location.id);
    setName(location.name);
    setDescription(location.description || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  async function deleteLocation(location: Location) {
    const confirmed = window.confirm(
      `Sigurado ka bang gusto mong i-delete ang "${location.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", location.id);

    if (error) {
      alert(
        "Hindi ma-delete ang location.\n\n" +
        "Possible na may records na naka-connect dito.\n\n" +
        error.message
      );
      return;
    }

    alert("Location successfully deleted!");

    loadLocations();
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-8">

          {/* HEADER */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
              Locations
            </h1>

            <p className="text-gray-500 mt-2">
              Manage company locations and branches
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8">

            {/* ADD / EDIT FORM */}
            <div className="bg-white rounded-xl shadow p-6">

              <h2 className="text-xl font-bold mb-6">
                {editingId !== null
                  ? "Edit Location"
                  : "Add New Location"}
              </h2>

              <form onSubmit={saveLocation}>

                <div className="mb-5">
                  <label className="block text-sm font-medium mb-2">
                    Location Name *
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Example: Cavite"
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium mb-2">
                    Description
                  </label>

                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Example: Cavite Office"
                    rows={4}
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div className="flex gap-3">

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingId !== null
                      ? "Save Changes"
                      : "+ Save Location"}
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={clearForm}
                      className="px-5 py-3 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}

                </div>

              </form>
            </div>

            {/* LOCATIONS LIST */}
            <div className="col-span-2 bg-white rounded-xl shadow">

              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Registered Locations
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    {locations.length} location
                    {locations.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading locations...
                </div>
              ) : locations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No locations yet.
                </div>
              ) : (
                <div className="divide-y">

                  {locations.map((location) => (
                    <div
                      key={location.id}
                      className="p-6 hover:bg-slate-50"
                    >

                      <div className="flex items-center justify-between gap-4">

                        {/* LOCATION INFO */}
                        <div>
                          <h3 className="text-lg font-semibold">
                            📍 {location.name}
                          </h3>

                          <p className="text-gray-500 mt-1">
                            {location.description ||
                              "No description"}
                          </p>
                        </div>

                        {/* BUTTONS */}
                        <div className="flex gap-2">

                          <button
                            onClick={() => {
                              window.location.href =
                                `/dashboard/locations/${location.id}`;
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg"
                          >
                            Open
                          </button>

                          <button
                            onClick={() => startEdit(location)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              deleteLocation(location)
                            }
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                          >
                            Delete
                          </button>

                        </div>

                      </div>

                    </div>
                  ))}

                </div>
              )}

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}