"use client";

import { LayoutDashboard, MapPin, CalendarDays, FileChartColumn, CalendarRange, ChartNoAxesCombined, Images, Wallet, Users, Activity, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const lastLoggedPath = useRef<string | null>(null);
  const autoLogoutStarted = useRef(false);
  const lastActivityAt = useRef(Date.now());

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

  const canViewActivityLogs =
    !loadingProfile &&
    String(profile?.email || "").trim().toLowerCase() ===
      "jerosboty@gmail.com" &&
    isAdmin;


  // Record dashboard page visits for the current active user.
  useEffect(() => {
    if (loadingProfile || !profile?.email || !pathname) return;
    if (!pathname.startsWith("/dashboard")) return;
    if (lastLoggedPath.current === pathname) return;

    lastLoggedPath.current = pathname;

    const moduleName =
      pathname === "/dashboard" ? "Dashboard" :
      pathname.startsWith("/dashboard/activity-logs") ? "Activity Logs" :
      pathname.startsWith("/dashboard/daily-records") ? "Daily Records" :
      pathname.startsWith("/dashboard/receipt-gallery") ? "Receipt Gallery" :
      pathname.startsWith("/dashboard/payroll") ? "Payroll" :
      pathname.startsWith("/dashboard/locations") ? "Locations" :
      pathname.startsWith("/dashboard/daily-report") ? "Daily Report" :
      pathname.startsWith("/dashboard/weekly-report") ? "Weekly Report" :
      pathname.startsWith("/dashboard/monthly-report") ? "Monthly Report" :
      pathname.startsWith("/dashboard/expenses") ? "Expenses" :
      pathname.startsWith("/dashboard/liquidation") ? "Liquidation" :
      pathname.startsWith("/dashboard/telegraphic-transfer") ? "Telegraphic Transfer" :
      pathname.startsWith("/dashboard/deposit-slips") ? "Deposit Slips" :
      pathname.startsWith("/dashboard/users") ? "Users" :
      pathname.startsWith("/dashboard/settings") ? "Settings" :
      pathname.startsWith("/dashboard/profile") ? "Profile" :
      "Dashboard Module";

    void supabase.from("activity_logs").insert({
      user_email: profile.email,
      user_name: profile.name,
      user_position: profile.position,
      action: "View",
      module: moduleName,
      record_id: null,
      location_id: null,
      location_name: null,
      description: `Opened ${pathname}`,
    }).then(({ error }) => {
      if (error) console.error("Page-view activity log error:", error);
    });
  }, [pathname, profile, loadingProfile]);

  // Warn after 14 minutes idle; sign out after 15 minutes idle.
  useEffect(() => {
    if (loadingProfile || !profile?.email) return;

    let warningTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;

    const clearTimers = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
    };

    const resetTimers = () => {
      if (autoLogoutStarted.current) return;

      lastActivityAt.current = Date.now();
      setShowIdleWarning(false);
      clearTimers();

      warningTimer = setTimeout(() => {
        setShowIdleWarning(true);
      }, 14 * 60 * 1000);

      logoutTimer = setTimeout(async () => {
        if (autoLogoutStarted.current) return;
        autoLogoutStarted.current = true;
        setLoggingOut(true);

        try {
          const { error: logError } = await supabase
            .from("activity_logs")
            .insert({
              user_email: profile.email,
              user_name: profile.name,
              user_position: profile.position,
              action: "Auto Logout",
              module: "Authentication",
              record_id: null,
              location_id: null,
              location_name: null,
              description: "Automatic logout after 15 minutes of inactivity",
            });

          if (logError) {
            console.error("Auto-logout activity log error:", logError);
          }

          const { error: signOutError } = await supabase.auth.signOut();

          if (signOutError) {
            console.error("Automatic sign-out error:", signOutError);
          }

          router.replace("/login");
          router.refresh();
        } catch (error) {
          console.error("Automatic logout error:", error);
          autoLogoutStarted.current = false;
          setLoggingOut(false);
        }
      }, 15 * 60 * 1000);
    };

    const activityEvents = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimers, { passive: true });
    });

    resetTimers();

    return () => {
      clearTimers();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimers);
      });
    };
  }, [profile, loadingProfile, router]);
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
          
          <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Dashboard</span>
        </Link>

        <Link
          href="/dashboard/locations"
          className={linkClass("/dashboard/locations")}
        >
          
          <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Locations</span>
        </Link>

        <Link
          href="/dashboard/daily-records"
          className={linkClass("/dashboard/daily-records")}
        >
          
          <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Daily Records</span>
        </Link>

        <div className="my-3 border-t border-slate-700 pt-3">
          <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Reports</p>
          <Link href="/dashboard/daily-report" className={linkClass("/dashboard/daily-report")}>
            <FileChartColumn className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Daily Report</span>
          </Link>
          <Link href="/dashboard/weekly-report" className={linkClass("/dashboard/weekly-report")}>
            <CalendarRange className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Weekly Report</span>
          </Link>
          <Link href="/dashboard/monthly-report" className={linkClass("/dashboard/monthly-report")}>
            <ChartNoAxesCombined className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Monthly Report</span>
          </Link>
        </div>

        <Link
          href="/dashboard/receipt-gallery"
          className={linkClass("/dashboard/receipt-gallery")}
        >
          
          <Images className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Receipt / Proof Gallery</span>
        </Link>

        {/* ADMIN-ONLY NAVIGATION */}
        {!loadingProfile && isAdmin && (
          <>
            <Link
              href="/dashboard/payroll"
              className={linkClass("/dashboard/payroll")}
            >
              
              <Wallet className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Payroll</span>
            </Link>

            <Link
              href="/dashboard/users"
              className={linkClass("/dashboard/users")}
            >
              
              <Users className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Users</span>
            </Link>

            {canViewActivityLogs && (
              <Link
                href="/dashboard/activity-logs"
                className={linkClass("/dashboard/activity-logs")}
              >
                <Activity className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Activity Logs</span>
              </Link>
            )}

            <Link
              href="/dashboard/settings"
              className={linkClass("/dashboard/settings")}
            >
              
              <Settings className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Settings</span>
            </Link>
          </>
        )}
      </nav>

      {showIdleWarning && !loggingOut && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-warning-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-slate-900 shadow-xl">
            <h2 id="idle-warning-title" className="text-xl font-bold">
              Inactivity Warning
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Wala kang activity sa loob ng 14 minuto. Awtomatiko kang
              ila-log out sa ika-15 minuto kung mananatiling inactive.
            </p>
            <button
              type="button"
              onClick={() => {
                lastActivityAt.current = Date.now();
                setShowIdleWarning(false);
              }}
              className="mt-5 w-full rounded-lg bg-[#1F3B64] px-4 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Continue Working
            </button>
          </div>
        </div>
      )}
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
              : "ðŸ‘¤"}
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
          
          <span>{loggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}





