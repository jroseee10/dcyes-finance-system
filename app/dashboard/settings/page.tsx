"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type SettingsRow = {
  id: number;
  system_name: string;
  company_name: string;
  support_email: string | null;
  created_at?: string;
  updated_at?: string;
};

export default function SettingsPage() {
  const [settingsId, setSettingsId] = useState<number | null>(null);

  const [systemName, setSystemName] = useState("DCYES");

  const [companyName, setCompanyName] = useState(
    "DCYES Financial Management System"
  );

  const [supportEmail, setSupportEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // =====================================================
  // LOAD SETTINGS
  // =====================================================

  async function loadSettings() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select(
          "id, system_name, company_name, support_email"
        )
        .order("id", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(
          "Load settings error:",
          error
        );

        setErrorMessage(
          "Hindi ma-load ang settings: " +
            error.message
        );

        return;
      }

      if (!data) {
        setSettingsId(null);

        setSystemName("DCYES");

        setCompanyName(
          "DCYES Financial Management System"
        );

        setSupportEmail("");

        return;
      }

      const row = data as SettingsRow;

      setSettingsId(row.id);

      setSystemName(
        row.system_name || "DCYES"
      );

      setCompanyName(
        row.company_name ||
          "DCYES Financial Management System"
      );

      setSupportEmail(
        row.support_email || ""
      );
    } catch (error) {
      console.error(
        "Unexpected settings error:",
        error
      );

      setErrorMessage(
        "May error habang nilo-load ang settings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  // =====================================================
  // SAVE SETTINGS
  // =====================================================

  async function saveSettings(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!systemName.trim()) {
      setErrorMessage(
        "Kailangan ang System Name."
      );

      return;
    }

    if (!companyName.trim()) {
      setErrorMessage(
        "Kailangan ang Company / Office Name."
      );

      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      // =================================================
      // UPDATE EXISTING SETTINGS
      // =================================================

      if (settingsId !== null) {
        const { error } = await supabase
          .from("system_settings")
          .update({
            system_name:
              systemName.trim(),

            company_name:
              companyName.trim(),

            support_email:
              supportEmail.trim() ||
              null,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", settingsId);

        if (error) {
          console.error(
            "Update settings error:",
            error
          );

          setErrorMessage(
            "Hindi ma-save ang settings: " +
              error.message
          );

          return;
        }
      }

      // =================================================
      // CREATE SETTINGS IF NONE EXISTS
      // =================================================

      else {
        const {
          data,
          error,
        } = await supabase
          .from("system_settings")
          .insert({
            system_name:
              systemName.trim(),

            company_name:
              companyName.trim(),

            support_email:
              supportEmail.trim() ||
              null,
          })
          .select("id")
          .single();

        if (error) {
          console.error(
            "Insert settings error:",
            error
          );

          setErrorMessage(
            "Hindi ma-save ang settings: " +
              error.message
          );

          return;
        }

        if (data) {
          setSettingsId(data.id);
        }
      }

      setMessage(
        "Settings successfully saved!"
      );

      await loadSettings();

      setMessage(
        "Settings successfully saved!"
      );
    } catch (error) {
      console.error(
        "Save settings error:",
        error
      );

      setErrorMessage(
        "May error habang sine-save ang settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // RESET FORM
  // =====================================================

  async function resetForm() {
    await loadSettings();
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <section className="flex-1 p-6 md:p-8 lg:p-10">

        <div className="max-w-6xl mx-auto">

          {/* HEADER */}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

            <div>

              <h1 className="text-3xl font-bold text-slate-900">
                Settings
              </h1>

              <p className="text-gray-500 mt-2">
                Manage system information and configuration
              </p>

            </div>

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading}
              className="w-fit bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium disabled:opacity-50"
            >
              {loading
                ? "Loading..."
                : "↻ Refresh"}
            </button>

          </div>

          {/* SUCCESS MESSAGE */}

          {message && (

            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">

              <p className="font-semibold">
                ✅ {message}
              </p>

            </div>

          )}

          {/* ERROR MESSAGE */}

          {errorMessage && (

            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">

              <p className="font-semibold">
                ⚠️ Notice
              </p>

              <p className="text-sm mt-1">
                {errorMessage}
              </p>

            </div>

          )}

          {loading ? (

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-gray-500">
              Loading settings...
            </div>

          ) : (

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* =================================================
                  SETTINGS FORM
              ================================================= */}

              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b border-slate-200">

                  <h2 className="text-xl font-bold text-slate-900">
                    System Information
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Configure the basic identity of your finance system
                  </p>

                </div>

                <form
                  onSubmit={saveSettings}
                  className="p-6"
                >

                  <div className="space-y-6">

                    {/* SYSTEM NAME */}

                    <div>

                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        System Name *
                      </label>

                      <input
                        type="text"
                        value={systemName}
                        onChange={(e) =>
                          setSystemName(
                            e.target.value
                          )
                        }
                        placeholder="DCYES"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <p className="text-xs text-gray-400 mt-2">
                        Short name of the system.
                      </p>

                    </div>

                    {/* COMPANY NAME */}

                    <div>

                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Company / Office Name *
                      </label>

                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) =>
                          setCompanyName(
                            e.target.value
                          )
                        }
                        placeholder="DCYES Financial Management System"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <p className="text-xs text-gray-400 mt-2">
                        Full company or office name.
                      </p>

                    </div>

                    {/* SUPPORT EMAIL */}

                    <div>

                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Support Email
                      </label>

                      <input
                        type="email"
                        value={supportEmail}
                        onChange={(e) =>
                          setSupportEmail(
                            e.target.value
                          )
                        }
                        placeholder="support@example.com"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <p className="text-xs text-gray-400 mt-2">
                        Optional contact email for the system.
                      </p>

                    </div>

                  </div>

                  {/* BUTTONS */}

                  <div className="flex justify-end gap-3 mt-8">

                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      className="px-6 py-3 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reset
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : "💾 Save Settings"}
                    </button>

                  </div>

                </form>

              </div>

              {/* =================================================
                  PREVIEW
              ================================================= */}

              <div className="space-y-6">

                {/* SYSTEM PREVIEW */}

                <div className="bg-slate-900 rounded-2xl shadow-sm p-6 text-white">

                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    System Preview
                  </p>

                  <h2 className="text-3xl font-bold mt-4">
                    {systemName || "DCYES"}
                  </h2>

                  <p className="text-slate-300 mt-2">
                    {companyName ||
                      "Financial Management System"}
                  </p>

                  <div className="border-t border-slate-700 mt-6 pt-5">

                    <p className="text-xs uppercase tracking-wider text-slate-400">
                      Support Email
                    </p>

                    <p className="text-sm mt-2 break-all">
                      {supportEmail ||
                        "Not configured"}
                    </p>

                  </div>

                </div>

                {/* INFO */}

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">

                  <h3 className="font-semibold text-blue-900">
                    ℹ️ About Settings
                  </h3>

                  <p className="text-sm text-blue-700 mt-2 leading-6">
                    These settings store the basic information of the DCYES Financial Management System.
                  </p>

                  <p className="text-sm text-blue-700 mt-3 leading-6">
                    Later, we can also connect the System Name here to the Sidebar and other pages automatically.
                  </p>

                </div>

              </div>

            </div>

          )}

        </div>

      </section>

    </main>
  );
}