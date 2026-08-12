"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type ActivityLog = {
  id: number;
  user_email: string | null;
  user_name: string | null;
  user_position: string | null;
  action: string;
  module: string;
  record_id: number | null;
  location_id: number | null;
  location_name: string | null;
  description: string | null;
  created_at: string;
};

export default function ActivityLogsPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRole, setLoadingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [search, setSearch] = useState("");

  // =====================================================
  // CHECK ADMIN
  // =====================================================

  async function checkAdmin() {
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
        router.replace("/login");
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("users")
        .select("position, status")
        .eq("email", authData.user.email)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
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

      if (!active || !admin) {
        alert("Admin access only.");

        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Admin check error:", error);

      setIsAdmin(false);
      router.replace("/dashboard");
    } finally {
      setLoadingRole(false);
    }
  }

  // =====================================================
  // LOAD LOGS
  // =====================================================

  async function loadLogs() {
    setLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", {
          ascending: false,
        })
        .limit(500);

      if (error) {
        console.error("Activity logs error:", error);

        alert(
          "Hindi ma-load ang activity logs: " +
            error.message
        );

        return;
      }

      setLogs(
        (data || []) as ActivityLog[]
      );
    } catch (error) {
      console.error(
        "Load activity logs error:",
        error
      );

      alert(
        "May error habang nilo-load ang activity logs."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      await checkAdmin();
    }

    init();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
    }
  }, [isAdmin]);

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredLogs =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return logs;
      }

      return logs.filter((log) =>
        [
          log.user_email,
          log.user_name,
          log.user_position,
          log.action,
          log.module,
          log.location_name,
          log.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      );
    }, [logs, search]);

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString(
      "en-PH",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  }

  // =====================================================
  // ACTION STYLE
  // =====================================================

  function actionClass(action: string) {
    const normalized =
      String(action || "")
        .trim()
        .toLowerCase();

    if (
      normalized.includes("delete")
    ) {
      return "bg-red-100 text-red-700";
    }

    if (
      normalized.includes("edit") ||
      normalized.includes("update")
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      normalized.includes("add") ||
      normalized.includes("create") ||
      normalized.includes("insert")
    ) {
      return "bg-green-100 text-green-700";
    }

    if (
      normalized.includes("login")
    ) {
      return "bg-purple-100 text-purple-700";
    }

    if (
      normalized.includes("logout")
    ) {
      return "bg-orange-100 text-orange-700";
    }

    return "bg-slate-100 text-slate-700";
  }

  // =====================================================
  // PAGE
  // =====================================================

  if (loadingRole) {
    return (
      <main className="min-h-screen bg-slate-100 flex">
        <Sidebar />

        <section className="flex-1 p-8">
          <div className="bg-white rounded-xl shadow p-10 text-center">
            Checking admin access...
          </div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <section className="flex-1 p-8">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

          <div>

            <h1 className="text-3xl font-bold text-slate-900">
              Activity Logs
            </h1>

            <p className="text-gray-500 mt-2">
              Audit trail of important system activities
            </p>

          </div>

          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-lg disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>

        </div>

        {/* SUMMARY */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

          <div className="bg-white rounded-xl shadow p-5">

            <p className="text-sm text-gray-500">
              Total Logs
            </p>

            <p className="text-3xl font-bold mt-2">
              {logs.length}
            </p>

          </div>

          <div className="bg-white rounded-xl shadow p-5">

            <p className="text-sm text-gray-500">
              Showing
            </p>

            <p className="text-3xl font-bold mt-2">
              {filteredLogs.length}
            </p>

          </div>

          <div className="bg-white rounded-xl shadow p-5">

            <p className="text-sm text-gray-500">
              Access
            </p>

            <p className="text-xl font-bold mt-2 text-blue-700">
              👑 Admin Only
            </p>

          </div>

        </div>

        {/* SEARCH */}

        <div className="bg-white rounded-xl shadow p-5 mb-6">

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="🔎 Search user, action, module, location..."
            className="w-full border rounded-lg p-3"
          />

        </div>

        {/* TABLE */}

        <div className="bg-white rounded-xl shadow overflow-hidden">

          <div className="p-6 border-b">

            <h2 className="text-xl font-bold text-slate-900">
              System Activity
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Latest 500 activity records
            </p>

          </div>

          {loading ? (

            <div className="p-10 text-center text-gray-500">
              Loading activity logs...
            </div>

          ) : filteredLogs.length === 0 ? (

            <div className="p-10 text-center text-gray-500">
              No activity logs found yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1300px]">

                <thead>

                  <tr className="bg-[#1F3B64] text-white">

                    <th className="px-4 py-4 text-left">
                      Date / Time
                    </th>

                    <th className="px-4 py-4 text-left">
                      User
                    </th>

                    <th className="px-4 py-4 text-left">
                      Position
                    </th>

                    <th className="px-4 py-4 text-center">
                      Action
                    </th>

                    <th className="px-4 py-4 text-left">
                      Module
                    </th>

                    <th className="px-4 py-4 text-left">
                      Location
                    </th>

                    <th className="px-4 py-4 text-left">
                      Description
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredLogs.map(
                    (log) => (

                      <tr
                        key={log.id}
                        className="border-b hover:bg-slate-50"
                      >

                        <td className="px-4 py-4 whitespace-nowrap">
                          {formatDateTime(
                            log.created_at
                          )}
                        </td>

                        <td className="px-4 py-4">

                          <p className="font-semibold">
                            {log.user_name ||
                              "Unknown User"}
                          </p>

                          <p className="text-xs text-gray-500">
                            {log.user_email ||
                              "No email"}
                          </p>

                        </td>

                        <td className="px-4 py-4">
                          {log.user_position ||
                            "—"}
                        </td>

                        <td className="px-4 py-4 text-center">

                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${actionClass(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>

                        </td>

                        <td className="px-4 py-4 font-medium">
                          {log.module}
                        </td>

                        <td className="px-4 py-4">
                          {log.location_name ||
                            "—"}
                        </td>

                        <td className="px-4 py-4">
                          {log.description ||
                            "—"}
                        </td>

                      </tr>

                    )
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