"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { supabase } from "@/lib/supabase";

type User = {
  id: number;
  name: string;
  email: string;
  position: string;
  status: string;
  created_at: string;
};

export default function UsersPage() {
  // =====================================================
  // USERS
  // =====================================================

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // =====================================================
  // CREATE ACCOUNT
  // =====================================================

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [newPosition, setNewPosition] = useState("Office Staff");

  // =====================================================
  // EDIT USER
  // =====================================================

  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("Office Staff");
  const [status, setStatus] = useState("Active");

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // =====================================================
  // LOAD USERS
  // =====================================================

  async function loadUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, position, status, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Users error:", error);

      alert(
        "Hindi makuha ang users: " +
          error.message
      );

      setUsers([]);
    } else {
      setUsers((data || []) as User[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // =====================================================
  // GET ACCESS TOKEN
  // =====================================================

  async function getAccessToken() {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        "Hindi makuha ang current login session."
      );
    }

    let session = sessionData.session;

    if (session) {
      const {
        data: refreshedData,
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (!refreshError && refreshedData.session) {
        session = refreshedData.session;
      }
    }

    if (!session?.access_token) {
      throw new Error(
        "Walang valid login session. Mag-logout at mag-login ulit bilang Admin."
      );
    }

    return session.access_token;
  }

  // =====================================================
  // CLEAR CREATE FORM
  // =====================================================

  function clearCreateForm() {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCreatePassword(false);
    setNewPosition("Office Staff");
  }

  // =====================================================
  // CREATE LOGIN ACCOUNT
  // =====================================================

  async function createLoginAccount(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!newName.trim()) {
      alert("Ilagay ang Full Name.");
      return;
    }

    if (!newEmail.trim()) {
      alert("Ilagay ang Email.");
      return;
    }

    if (newPassword.length < 8) {
      alert(
        "Ang password ay dapat at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      alert(
        "Hindi magkapareho ang Password at Confirm Password."
      );
      return;
    }

    setCreating(true);

    try {
      const accessToken = await getAccessToken();

      const response = await fetch(
        "/api/admin/users",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            name: newName.trim(),
            email: newEmail.trim().toLowerCase(),
            password: newPassword,
            position: newPosition,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(
          result.error ||
            "Hindi nagawa ang login account."
        );
        return;
      }

      alert(
        result.message ||
          "Login account successfully created!"
      );

      clearCreateForm();
      setShowCreateForm(false);

      await loadUsers();
    } catch (error) {
      console.error(
        "Create account error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "May error habang ginagawa ang login account."
      );
    } finally {
      setCreating(false);
    }
  }

  // =====================================================
  // EDIT USER
  // =====================================================

  function startEdit(user: User) {
    setShowCreateForm(false);
    closeResetPassword();

    setEditingId(user.id);

    setName(user.name || "");
    setEmail(user.email || "");
    setPosition(
      user.position || "Office Staff"
    );
    setStatus(
      user.status || "Active"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function clearEditForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPosition("Office Staff");
    setStatus("Active");
  }

  // =====================================================
  // SAVE EDIT
  // =====================================================

  async function saveChanges(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (editingId === null) {
      return;
    }

    if (!name.trim()) {
      alert("Ilagay ang pangalan.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        position,
        status,
      })
      .eq("id", editingId);

    if (error) {
      console.error(
        "Update user error:",
        error
      );

      alert(
        "Hindi ma-update ang user: " +
          error.message
      );

      setSaving(false);
      return;
    }

    alert(
      "User profile successfully updated!"
    );

    setSaving(false);

    clearEditForm();

    await loadUsers();
  }

  // =====================================================
  // OPEN RESET PASSWORD
  // =====================================================

  function openResetPassword(user: User) {
    setShowCreateForm(false);
    clearEditForm();

    setResetUser(user);
    setResetPassword("");
    setResetConfirmPassword("");
    setShowResetPassword(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================================
  // CLOSE RESET PASSWORD
  // =====================================================

  function closeResetPassword() {
    setResetUser(null);
    setResetPassword("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
  }

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  async function submitResetPassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!resetUser) {
      return;
    }

    if (resetPassword.length < 8) {
      alert(
        "Ang bagong password ay dapat at least 8 characters."
      );
      return;
    }

    if (
      resetPassword !==
      resetConfirmPassword
    ) {
      alert(
        "Hindi magkapareho ang New Password at Confirm Password."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Palitan ang password ni ${resetUser.name}?`
      );

    if (!confirmed) {
      return;
    }

    setResetting(true);

    try {
      const accessToken =
        await getAccessToken();

      const response =
        await fetch(
          "/api/admin/users",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body: JSON.stringify({
              email:
                resetUser.email,

              password:
                resetPassword,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        alert(
          result.error ||
            "Hindi mapalitan ang password."
        );
        return;
      }

      alert(
        result.message ||
          "Password successfully changed!"
      );

      closeResetPassword();
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "May error habang pinapalitan ang password."
      );
    } finally {
      setResetting(false);
    }
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredUsers =
    users.filter((user) => {
      const text =
        search
          .trim()
          .toLowerCase();

      return (
        user.name
          ?.toLowerCase()
          .includes(text) ||
        user.email
          ?.toLowerCase()
          .includes(text) ||
        user.position
          ?.toLowerCase()
          .includes(text) ||
        user.status
          ?.toLowerCase()
          .includes(text)
      );
    });

  // =====================================================
  // COUNTS
  // =====================================================

  const activeUsers =
    users.filter(
      (user) =>
        String(user.status)
          .trim()
          .toLowerCase() ===
        "active"
    ).length;

  const adminUsers =
    users.filter(
      (user) =>
        String(user.position)
          .trim()
          .toLowerCase() ===
        "admin"
    ).length;

  const officeStaffUsers =
    users.filter(
      (user) =>
        String(user.position)
          .trim()
          .toLowerCase() ===
        "office staff"
    ).length;

  // =====================================================
  // DATE
  // =====================================================

  function formatDate(date: string) {
    if (!date) {
      return "-";
    }

    return new Date(
      date
    ).toLocaleDateString(
      "en-PH",
      {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100 flex">

      <Sidebar />

      <section className="flex-1 p-6 md:p-8 lg:p-10">

        {/* HEADER */}

        <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Users
            </h1>

            <p className="text-gray-500 mt-2">
              View users and manage login access
            </p>
          </div>

          <div className="flex flex-wrap gap-3">

            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium disabled:opacity-50"
            >
              {loading
                ? "Loading..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              onClick={() => {
                clearEditForm();
                closeResetPassword();

                if (showCreateForm) {
                  clearCreateForm();
                }

                setShowCreateForm(
                  !showCreateForm
                );
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium"
            >
              {showCreateForm
                ? "✕ Close"
                : "+ Create Login Account"}
            </button>

          </div>

        </div>

        {/* =================================================
            CREATE ACCOUNT
        ================================================= */}

        {showCreateForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">

            <h2 className="text-xl font-bold text-slate-900">
              Create Login Account
            </h2>

            <p className="text-sm text-gray-500 mt-1 mb-6">
              Create an account that can sign in to the DCYES system.
            </p>

            <form
              onSubmit={createLoginAccount}
            >

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Full Name *
                  </label>

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) =>
                      setNewName(
                        e.target.value
                      )
                    }
                    placeholder="Juan Dela Cruz"
                    className="w-full border border-slate-300 rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email *
                  </label>

                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) =>
                      setNewEmail(
                        e.target.value
                      )
                    }
                    placeholder="staff@example.com"
                    className="w-full border border-slate-300 rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Temporary Password *
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showCreatePassword
                          ? "text"
                          : "password"
                      }
                      value={newPassword}
                      onChange={(e) =>
                        setNewPassword(
                          e.target.value
                        )
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full border border-slate-300 rounded-xl p-3 pr-20"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowCreatePassword(
                          !showCreatePassword
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-600"
                    >
                      {showCreatePassword
                        ? "Hide"
                        : "Show"}
                    </button>

                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confirm Password *
                  </label>

                  <input
                    type={
                      showCreatePassword
                        ? "text"
                        : "password"
                    }
                    value={
                      confirmPassword
                    }
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Retype password"
                    className="w-full border border-slate-300 rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Access / Position
                  </label>

                  <select
                    value={newPosition}
                    onChange={(e) =>
                      setNewPosition(
                        e.target.value
                      )
                    }
                    className="w-full border border-slate-300 rounded-xl p-3 bg-white"
                  >
                    <option value="Office Staff">
                      Office Staff
                    </option>

                    <option value="Admin">
                      Admin
                    </option>
                  </select>
                </div>

              </div>

              <p className="mt-3 text-xs text-gray-500">
                Password must contain at least 8 characters.
              </p>

              <div className="flex justify-end gap-3 mt-6">

                <button
                  type="button"
                  disabled={creating}
                  onClick={() => {
                    clearCreateForm();
                    setShowCreateForm(false);
                  }}
                  className="px-5 py-3 border rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
                >
                  {creating
                    ? "Creating..."
                    : "🔐 Create Account"}
                </button>

              </div>

            </form>

          </div>
        )}

        {/* =================================================
            RESET PASSWORD
        ================================================= */}

        {resetUser && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 mb-8">

            <div className="flex items-start justify-between gap-4 mb-6">

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  🔑 Reset Password
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Change the login password for this user.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeResetPassword
                }
                className="text-gray-400 hover:text-gray-800 text-xl"
              >
                ✕
              </button>

            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">

              <p className="font-bold text-slate-900">
                {resetUser.name}
              </p>

              <p className="text-sm text-gray-600 mt-1">
                {resetUser.email}
              </p>

              <span className="inline-flex mt-2 px-3 py-1 rounded-full border border-amber-200 bg-white text-amber-700 text-xs font-semibold">
                {resetUser.position}
              </span>

            </div>

            <form
              onSubmit={
                submitResetPassword
              }
            >

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div>

                  <label className="block text-sm font-medium mb-2">
                    New Password *
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showResetPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        resetPassword
                      }
                      onChange={(e) =>
                        setResetPassword(
                          e.target.value
                        )
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full border border-slate-300 rounded-xl p-3 pr-20"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowResetPassword(
                          !showResetPassword
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-600"
                    >
                      {showResetPassword
                        ? "Hide"
                        : "Show"}
                    </button>

                  </div>

                </div>

                <div>

                  <label className="block text-sm font-medium mb-2">
                    Confirm New Password *
                  </label>

                  <input
                    type={
                      showResetPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      resetConfirmPassword
                    }
                    onChange={(e) =>
                      setResetConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Retype new password"
                    className="w-full border border-slate-300 rounded-xl p-3"
                  />

                </div>

              </div>

              <p className="mt-3 text-xs text-gray-500">
                Minimum 8 characters. Pag na-save ito, hindi na gagana ang lumang password.
              </p>

              <div className="flex justify-end gap-3 mt-6">

                <button
                  type="button"
                  onClick={
                    closeResetPassword
                  }
                  disabled={resetting}
                  className="px-5 py-3 border rounded-xl hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={resetting}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
                >
                  {resetting
                    ? "Changing..."
                    : "🔑 Change Password"}
                </button>

              </div>

            </form>

          </div>
        )}

        {/* =================================================
            EDIT USER
        ================================================= */}

        {editingId !== null && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">

            <h2 className="text-xl font-bold text-slate-900">
              Edit User
            </h2>

            <p className="text-sm text-gray-500 mt-1 mb-6">
              Update user profile information
            </p>

            <form
              onSubmit={saveChanges}
            >

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                <div>
                  <label className="block text-sm font-medium mb-2">
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
                    className="w-full border rounded-xl p-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full border rounded-xl p-3 bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Position
                  </label>

                  <select
                    value={position}
                    onChange={(e) =>
                      setPosition(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-xl p-3 bg-white"
                  >
                    <option value="Admin">
                      Admin
                    </option>

                    <option value="Office Staff">
                      Office Staff
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Status
                  </label>

                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-xl p-3 bg-white"
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </div>

              </div>

              <div className="flex justify-end gap-3 mt-6">

                <button
                  type="button"
                  onClick={
                    clearEditForm
                  }
                  className="px-5 py-3 border rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </form>

          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

          {[
            [
              "Registered Users",
              users.length,
            ],
            [
              "Active Users",
              activeUsers,
            ],
            [
              "Admin",
              adminUsers,
            ],
            [
              "Office Staff",
              officeStaffUsers,
            ],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
            >
              <p className="text-sm text-gray-500">
                {label}
              </p>

              <p className="text-3xl font-bold mt-2">
                {value}
              </p>
            </div>
          ))}

        </div>

        {/* SEARCH */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="🔍 Search name, email, position, status..."
            className="w-full border rounded-xl p-3"
          />

        </div>

        {/* =================================================
            USERS TABLE
        ================================================= */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="px-6 py-5 border-b">

            <h2 className="text-xl font-bold">
              Registered Users
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Showing {filteredUsers.length} of {users.length} users
            </p>

          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      User
                    </th>

                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      Position
                    </th>

                    <th className="text-center px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      Status
                    </th>

                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      Created
                    </th>

                    <th className="text-center px-6 py-4 text-xs font-semibold uppercase text-slate-500">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredUsers.map(
                    (user) => (
                      <tr
                        key={user.id}
                        className="border-t hover:bg-slate-50"
                      >

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-3">

                            <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">

                              {user.name
                                ? user.name
                                    .charAt(0)
                                    .toUpperCase()
                                : "U"}

                            </div>

                            <div>
                              <p className="font-semibold text-slate-900">
                                {user.name}
                              </p>

                              <p className="text-sm text-gray-500">
                                {user.email}
                              </p>
                            </div>

                          </div>

                        </td>

                        <td className="px-6 py-4">

                          <span className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                            {user.position}
                          </span>

                        </td>

                        <td className="px-6 py-4 text-center">

                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                              user.status === "Active"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.status}
                          </span>

                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(
                            user.created_at
                          )}
                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-4">

                          <div className="flex flex-wrap items-center justify-center gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  user
                                )
                              }
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                            >
                              ✏️ Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openResetPassword(
                                  user
                                )
                              }
                              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                            >
                              🔑 Reset Password
                            </button>

                          </div>

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