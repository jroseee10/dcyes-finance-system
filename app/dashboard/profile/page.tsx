"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type UserProfile = {
  id: number;
  name: string;
  email: string;
  position: string;
  status: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  async function loadProfile() {
    setLoading(true);

    try {
      // Kunin muna ang currently logged-in Supabase Auth user
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth error:", authError);

        alert(
          "Hindi makuha ang logged-in user: " +
            authError.message
        );

        return;
      }

      const authUser = authData.user;

      if (!authUser) {
        alert("Walang logged-in user.");
        return;
      }

      // Hanapin ang matching profile sa public.users table
      const {
        data: userData,
        error: userError,
      } = await supabase
        .from("users")
        .select(
          "id, name, email, position, status"
        )
        .eq("email", authUser.email)
        .maybeSingle();

      if (userError) {
        console.error(
          "Profile error:",
          userError
        );

        alert(
          "Hindi makuha ang profile: " +
            userError.message
        );

        return;
      }

      if (!userData) {
        alert(
          "Walang profile record na tumutugma sa logged-in email."
        );

        setProfile(null);
        return;
      }

      const user = userData as UserProfile;

      setProfile(user);

      setName(user.name || "");
      setEmail(user.email || "");
      setPosition(user.position || "");
    } catch (error) {
      console.error(
        "Unexpected profile error:",
        error
      );

      alert(
        "May error habang nilo-load ang profile."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function saveProfile(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!profile) {
      return;
    }

    if (!name.trim()) {
      alert("Ilagay ang pangalan.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("users")
        .update({
          name: name.trim(),
          position: position.trim(),
        })
        .eq("id", profile.id);

      if (error) {
        console.error(
          "Update profile error:",
          error
        );

        alert(
          "Hindi ma-save ang profile: " +
            error.message
        );

        return;
      }

      alert(
        "Profile successfully updated!"
      );

      setEditing(false);

      await loadProfile();
    } catch (error) {
      console.error(
        "Save profile error:",
        error
      );

      alert(
        "May error habang sine-save ang profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex">
      <Sidebar />

      <section className="flex-1 p-6 md:p-8 lg:p-10">
        <div className="max-w-4xl mx-auto">

          {/* HEADER */}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
              My Profile
            </h1>

            <p className="text-gray-500 mt-2">
              View and update your account information
            </p>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-gray-500">
              Loading profile...
            </div>
          ) : !profile ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
              <p className="text-lg font-semibold text-slate-900">
                Profile not found
              </p>

              <p className="text-gray-500 mt-2">
                Walang matching record sa users table para sa logged-in account.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* PROFILE TOP */}

              <div className="bg-slate-900 p-8 text-white">
                <div className="flex items-center gap-5">

                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold">
                    {profile.name
                      ? profile.name
                          .charAt(0)
                          .toUpperCase()
                      : "U"}
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold">
                      {profile.name}
                    </h2>

                    <p className="text-slate-300 mt-1">
                      {profile.email}
                    </p>

                    <div className="flex gap-2 mt-3">
                      <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-sm">
                        {profile.position || "No Position"}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          profile.status === "Active"
                            ? "bg-green-500/20 text-green-200"
                            : "bg-red-500/20 text-red-200"
                        }`}
                      >
                        {profile.status}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* PROFILE FORM */}

              <div className="p-8">
                <form onSubmit={saveProfile}>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* NAME */}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Full Name
                      </label>

                      <input
                        type="text"
                        value={name}
                        onChange={(e) =>
                          setName(
                            e.target.value
                          )
                        }
                        readOnly={!editing}
                        className={`w-full border rounded-lg p-3 ${
                          editing
                            ? "bg-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      />
                    </div>

                    {/* EMAIL */}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email
                      </label>

                      <input
                        type="email"
                        value={email}
                        readOnly
                        className="w-full border rounded-lg p-3 bg-gray-100 text-gray-500"
                      />

                      <p className="text-xs text-gray-400 mt-1">
                        Email comes from your login account.
                      </p>
                    </div>

                    {/* POSITION */}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Position
                      </label>

                      <input
                        type="text"
                        value={position}
                        onChange={(e) =>
                          setPosition(
                            e.target.value
                          )
                        }
                        readOnly={!editing}
                        className={`w-full border rounded-lg p-3 ${
                          editing
                            ? "bg-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      />
                    </div>

                    {/* STATUS */}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Status
                      </label>

                      <input
                        type="text"
                        value={profile.status}
                        readOnly
                        className="w-full border rounded-lg p-3 bg-gray-100 text-gray-500"
                      />
                    </div>

                  </div>

                  {/* BUTTONS */}

                  <div className="flex justify-end gap-3 mt-8">

                    {!editing ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing(true)
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                      >
                        ✏️ Edit Profile
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false);

                            setName(
                              profile.name || ""
                            );

                            setPosition(
                              profile.position || ""
                            );
                          }}
                          className="px-6 py-3 border rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
                        >
                          {saving
                            ? "Saving..."
                            : "Save Changes"}
                        </button>
                      </>
                    )}

                  </div>

                </form>
              </div>

            </div>
          )}

        </div>
      </section>
    </main>
  );
}