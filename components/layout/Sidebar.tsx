"use client";

import {
  LayoutDashboard,
  MapPin,
  CalendarDays,
  FileChartColumn,
  CalendarRange,
  ChartNoAxesCombined,
  Images,
  Wallet,
  Users,
  Activity,
  Settings,
  LogOut,
  Landmark,
  UserCircle,
} from "lucide-react";

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
    const active = isActive(href);

    return [
      "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5",
      "text-sm font-medium transition-colors duration-150",
      active
        ? "bg-[#244A78] text-white shadow-sm ring-1 ring-white/10"
        : "text-slate-300 hover:bg-white/10 hover:text-white",
    ].join(" ");
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
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

  const navigationItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/dashboard/locations",
      label: "Locations",
      icon: MapPin,
    },
    {
      href: "/dashboard/daily-records",
      label: "Daily Records",
      icon: CalendarDays,
    },
  ];

  const reportItems = [
    {
      href: "/dashboard/daily-report",
      label: "Daily Report",
      icon: FileChartColumn,
    },
    {
      href: "/dashboard/weekly-report",
      label: "Weekly Report",
      icon: CalendarRange,
    },
    {
      href: "/dashboard/monthly-report",
      label: "Monthly Report",
      icon: ChartNoAxesCombined,
    },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-hidden bg-[#102744] text-white shadow-xl">
      {/* BRAND */}
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#102744] shadow-md">
            <Landmark className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-[0.10em] text-white">
              DCYES
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-200">
              Finance Management
            </p>
            <p className="text-[11px] text-slate-400">
              System
            </p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav
        aria-label="Main navigation"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
      >
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Main Menu
        </p>

        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={linkClass(item.href)}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* REPORTS */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Reports
          </p>

          <div className="space-y-1">
            {reportItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={linkClass(item.href)}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* OTHER MODULES */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Management
          </p>

          <Link
            href="/dashboard/receipt-gallery"
            className={linkClass("/dashboard/receipt-gallery")}
          >
            <Images className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Receipt / Proof Gallery</span>
          </Link>

          {!loadingProfile && isAdmin && (
            <>
              <Link
                href="/dashboard/payroll"
                className={linkClass("/dashboard/payroll")}
              >
                <Wallet className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Payroll</span>
              </Link>

              <Link
                href="/dashboard/users"
                className={linkClass("/dashboard/users")}
              >
                <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Users</span>
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
                <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Settings</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* IDLE WARNING */}
      {showIdleWarning && !loggingOut && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-warning-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-7 text-slate-900 shadow-2xl">
            <h2
              id="idle-warning-title"
              className="text-xl font-bold"
            >
              Inactivity Warning
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Wala kang activity sa loob ng 14 minuto. Awtomatiko kang
              ila-log out sa ika-15 minuto kung mananatiling inactive.
            </p>

            <button
              type="button"
              onClick={() => {
                lastActivityAt.current = Date.now();
                setShowIdleWarning(false);
              }}
              className="mt-6 w-full rounded-xl bg-[#173B63] px-5 py-3 font-semibold text-white transition hover:bg-[#244A78]"
            >
              Continue Working
            </button>
          </div>
        </div>
      )}

      {/* USER PROFILE AND LOGOUT */}
      <div className="border-t border-white/10 bg-[#0B1E35] p-3">
        <Link
          href="/dashboard/profile"
          className={[
            "flex items-center gap-3 rounded-xl p-3 transition-colors",
            "hover:bg-white/10",
            isActive("/dashboard/profile") ? "bg-white/10" : "",
          ].join(" ")}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#244A78] text-white">
            {profile?.name ? (
              <span className="text-lg font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <UserCircle className="h-6 w-6" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {loadingProfile ? "Loading..." : profile?.name || "User"}
            </p>
            <p className="truncate text-xs capitalize text-slate-400">
              {loadingProfile
                ? "..."
                : profile?.position || "View Profile"}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={[
            "mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5",
            "text-sm font-semibold text-red-300 transition-colors",
            "hover:bg-red-500/10 hover:text-red-200",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{loggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}
