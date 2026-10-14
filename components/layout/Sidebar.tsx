
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CurrentProfile = {
  id: number;
  name: string;
  email: string;
  position: string;
  status: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  async function loadCurrentProfile() {
    setLoadingProfile(true);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        if (sessionError) {
          console.error("Session error:", sessionError);
        }

        setProfile(null);
        router.replace("/login");
        return;
      }

      const authUser = sessionData.session.user;

      if (!authUser.email) {
        setProfile(null);
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("users")
        .select("id, name, email, position, status")
        .eq("email", authUser.email)
        .maybeSingle();

      if (profileError) {
        console.error("Profile error:", profileError);
        setProfile(null);
        return;
      }

      if (!profileData) {
        console.error("No matching users record.");
        setProfile(null);
        return;
      }

      if (
        String(profileData.status || "")
          .trim()
          .toLowerCase() !== "active"
      ) {
        alert(
          "Your account is inactive. Please contact the administrator."
        );

        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
        return;
      }

      setProfile(profileData as CurrentProfile);
    } catch (error) {
      console.error("Load profile error:", error);
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    void loadCurrentProfile();
  }, []);

  const isAdmin =
    String(profile?.position || "").trim().toLowerCase() === "admin" &&
    String(profile?.status || "").trim().toLowerCase() === "active";

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function linkClass(href: string) {
    return [
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
      isActive(href)
        ? "bg-slate-700 text-white font-semibold"
        : "text-slate-300 hover:bg-slate-700 hover:text-white",
    ].join(" ");
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      // Log the logout event when possible.
      if (profile?.email) {
        const { error: activityError } = await supabase
          .from("activity_logs")
          .insert({
            user_email: profile.email,
            user_name: profile.name,
            user_position: profile.position,
            action: "Logout",
            module: "Authentication",
            record_id: null,
            location_id: null,
            location_name: null,
            description: "User logged out",
          });

        if (activityError) {
          console.error("Logout activity log error:", activityError);
        }
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout error:", error);
        alert("Hindi makapag-logout. Pakisubukan ulit.");
        setLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      alert("May error habang nagla-logout.");
      setLoggingOut(false);
    }
  }

  return (
    <aside className="flex min-h-screen w-64 flex-col bg-[#0f172a] text-white">
      {/* BRAND */}
      <div className="border-b border-slate-700 px-6 py-6">
        <h1 className="text-2xl font-bold tracking-wide">DCYES</h1>
        <p className="mt-1 text-xs text-slate-400">
          Finance Management System
        </p>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          <span className="text-xl" aria-hidden="true">📊</span>
          <span>Dashboard</span>
        </Link>

        <Link
          href="/dashboard/locations"
          className={linkClass("/dashboard/locations")}
        >
          <span className="text-xl" aria-hidden="true">📍</span>
          <span>Locations</span>
        </Link>

        <Link
          href="/dashboard/daily-records"
          className={linkClass("/dashboard/daily-records")}
        >
          <span className="text-xl" aria-hidden="true">🧾</span>
          <span>Daily Records</span>
        </Link>

        <div className="my-3 border-t border-slate-700 pt-3">
          <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Reports</p>
          <Link href="/dashboard/daily-report" className={linkClass("/dashboard/daily-report")}>
            <span className="text-xl" aria-hidden="true">📅</span><span>Daily Report</span>
          </Link>
          <Link href="/dashboard/weekly-report" className={linkClass("/dashboard/weekly-report")}>
            <span className="text-xl" aria-hidden="true">🗓️</span><span>Weekly Report</span>
          </Link>
          <Link href="/dashboard/monthly-report" className={linkClass("/dashboard/monthly-report")}>
            <span className="text-xl" aria-hidden="true">📈</span><span>Monthly Report</span>
          </Link>
        </div>

        <Link
          href="/dashboard/receipt-gallery"
          className={linkClass("/dashboard/receipt-gallery")}
        >
          <span className="text-xl" aria-hidden="true">🗂️</span>
          <span>Receipt / Proof Gallery</span>
        </Link>

        {/* ADMIN-ONLY NAVIGATION */}
        {!loadingProfile && isAdmin && (
          <>
            <Link
              href="/dashboard/users"
              className={linkClass("/dashboard/users")}
            >
              <span className="text-xl" aria-hidden="true">👥</span>
              <span>Users</span>
            </Link>

            <Link
              href="/dashboard/activity-logs"
              className={linkClass("/dashboard/activity-logs")}
            >
              <span className="text-xl" aria-hidden="true">📋</span>
              <span>Activity Logs</span>
            </Link>

            <Link
              href="/dashboard/settings"
              className={linkClass("/dashboard/settings")}
            >
              <span className="text-xl" aria-hidden="true">⚙️</span>
              <span>Settings</span>
            </Link>
          </>
        )}
      </nav>

      {/* USER AREA */}
      <div className="border-t border-slate-700 p-4">
        <Link
          href="/dashboard/profile"
          className={[
            "flex items-center gap-3 rounded-lg p-3 transition-colors",
            "hover:bg-slate-700",
            isActive("/dashboard/profile") ? "bg-slate-700" : "",
          ].join(" ")}
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold">
            {profile?.name
              ? profile.name.charAt(0).toUpperCase()
              : "👤"}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {loadingProfile ? "Loading..." : profile?.name || "User"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {loadingProfile
                ? "..."
                : profile?.position || "View Profile"}
            </p>
          </div>
        </Link>

        {/* LOGOUT */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={[
            "mt-3 flex w-full items-center gap-3 rounded-lg px-4 py-3",
            "text-red-300 transition-colors hover:bg-red-500/10",
            "hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          <span className="text-xl" aria-hidden="true">🚪</span>
          <span>{loggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}
