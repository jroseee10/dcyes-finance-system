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

  const [profile, setProfile] =
    useState<CurrentProfile | null>(null);

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  // =====================================================
  // LOAD CURRENT USER PROFILE
  // =====================================================

  async function loadCurrentProfile() {
    setLoadingProfile(true);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Session error:",
          sessionError
        );

        setProfile(null);
        router.replace("/login");
        return;
      }

      if (!sessionData.session) {
        setProfile(null);
        router.replace("/login");
        return;
      }

      const authUser =
        sessionData.session.user;

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
        .select(
          "id, name, email, position, status"
        )
        .eq("email", authUser.email)
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
        console.error(
          "No matching users record."
        );

        setProfile(null);
        return;
      }

      // ===============================================
      // BLOCK INACTIVE USER
      // ===============================================

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

      setProfile(
        profileData as CurrentProfile
      );

    } catch (error) {
      console.error(
        "Load profile error:",
        error
      );

      setProfile(null);

    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  // =====================================================
  // ROLE
  // =====================================================

  const isAdmin =
    String(profile?.position || "")
      .trim()
      .toLowerCase() === "admin";

  // =====================================================
  // ACTIVE LINK
  // =====================================================

  const isActive = (
    href: string
  ) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname.startsWith(href);
  };

  // =====================================================
  // LINK CLASS
  // =====================================================

  const linkClass = (
    href: string
  ) => {
    return `
      flex items-center gap-3
      px-4 py-3
      rounded-lg
      transition
      ${
        isActive(href)
          ? "bg-slate-700 text-white font-semibold"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }
    `;
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {

      // =================================================
      // ACTIVITY LOG - LOGOUT
      // =================================================

      try {

        if (profile?.email) {

          const { error: activityError } =
            await supabase
              .from("activity_logs")
              .insert({
                user_email: profile.email,

                user_name: profile.name,

                user_position:
                  profile.position,

                action: "Logout",

                module: "Authentication",

                record_id: null,

                location_id: null,

                location_name: null,

                description: "User logged out",
              });

          if (activityError) {
            console.error(
              "Logout activity log error:",
              activityError
            );
          }
        }

      } catch (activityError) {

        console.error(
          "Logout activity log unexpected error:",
          activityError
        );

      }

      // =================================================
      // SUPABASE LOGOUT
      // =================================================

      const { error } =
        await supabase.auth.signOut();

      if (error) {

        console.error(
          "Logout error:",
          error
        );

        alert(
          "Hindi makapag-logout. Pakisubukan ulit."
        );

        setLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

      alert(
        "May error habang nagla-logout."
      );

      setLoggingOut(false);
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <aside className="w-64 min-h-screen bg-[#0f172a] text-white flex flex-col">

      {/* =================================================
          BRAND
      ================================================= */}

      <div className="px-6 py-6 border-b border-slate-700">

        <h1 className="text-2xl font-bold tracking-wide">
          DCYES
        </h1>

        <p className="text-xs text-slate-400 mt-1">
          Finance Management System
        </p>

      </div>

      {/* =================================================
          NAVIGATION
      ================================================= */}

      <nav className="flex-1 px-4 py-6 space-y-2">

        {/* DASHBOARD */}

        <Link
          href="/dashboard"
          className={
            linkClass("/dashboard")
          }
        >
          <span className="text-xl">
            🏠
          </span>

          <span>
            Dashboard
          </span>
        </Link>

        {/* LOCATIONS */}

        <Link
          href="/dashboard/locations"
          className={
            linkClass(
              "/dashboard/locations"
            )
          }
        >
          <span className="text-xl">
            📍
          </span>

          <span>
            Locations
          </span>
        </Link>

        {/* =================================================
            ADMIN ONLY
        ================================================= */}

        {!loadingProfile &&
          isAdmin && (
            <>

              {/* USERS */}

              <Link
                href="/dashboard/users"
                className={
                  linkClass(
                    "/dashboard/users"
                  )
                }
              >
                <span className="text-xl">
                  👥
                </span>

                <span>
                  Users
                </span>
              </Link>

              {/* ACTIVITY LOGS */}

              <Link
                href="/dashboard/activity-logs"
                className={
                  linkClass(
                    "/dashboard/activity-logs"
                  )
                }
              >
                <span className="text-xl">
                  📋
                </span>

                <span>
                  Activity Logs
                </span>
              </Link>

              {/* SETTINGS */}

              <Link
                href="/dashboard/settings"
                className={
                  linkClass(
                    "/dashboard/settings"
                  )
                }
              >
                <span className="text-xl">
                  ⚙️
                </span>

                <span>
                  Settings
                </span>
              </Link>

            </>
          )}

      </nav>

      {/* =================================================
          USER AREA
      ================================================= */}

      <div className="border-t border-slate-700 p-4">

        {/* PROFILE */}

        <Link
          href="/dashboard/profile"
          className="
            flex
            items-center
            gap-3
            p-3
            rounded-lg
            hover:bg-slate-700
            transition
          "
        >

          {/* AVATAR */}

          <div
            className="
              w-10
              h-10
              rounded-full
              bg-slate-700
              flex
              items-center
              justify-center
              text-lg
              flex-shrink-0
            "
          >
            {profile?.name
              ? profile.name
                  .charAt(0)
                  .toUpperCase()
              : "👤"}
          </div>

          {/* USER INFO */}

          <div className="flex-1 min-w-0">

            <p className="text-sm font-semibold text-white truncate">
              {loadingProfile
                ? "Loading..."
                : profile?.name ||
                  "User"}
            </p>

            <p className="text-xs text-slate-400 truncate">
              {loadingProfile
                ? "..."
                : profile?.position ||
                  "View Profile"}
            </p>

          </div>

        </Link>

        {/* LOGOUT */}

        <button
          type="button"
          onClick={
            handleLogout
          }
          disabled={
            loggingOut
          }
          className="
            w-full
            mt-3
            flex
            items-center
            gap-3
            px-4
            py-3
            rounded-lg
            text-red-300
            hover:bg-red-500/10
            hover:text-red-200
            transition
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >

          <span className="text-xl">
            🚪
          </span>

          <span>
            {loggingOut
              ? "Logging out..."
              : "Logout"}
          </span>

        </button>

      </div>

    </aside>
  );
}