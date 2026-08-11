"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);

      setError(
        "May error habang nagla-login. Pakisubukan ulit."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f0e3]">

      {/* =====================================================
          MAIN CREAM BACKGROUND
      ===================================================== */}

      <div
        className="
          absolute
          inset-0
          bg-gradient-to-br
          from-[#fffdf7]
          via-[#f5eedc]
          to-[#e7d8af]
        "
      />

      {/* =====================================================
          SOFT LIGHT LEFT
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          left-[-150px]
          top-[-150px]
          h-[500px]
          w-[500px]
          rounded-full
          bg-[#fff8d7]/70
          blur-[100px]
        "
      />

      {/* =====================================================
          DARK GREEN RIGHT BACKGROUND
      ===================================================== */}

      <div
        className="
          absolute
          -right-[17%]
          -top-[12%]
          h-[125%]
          w-[70%]
          rounded-l-[48%]
          bg-[#0b2b1c]
          shadow-[-20px_0_60px_rgba(0,0,0,0.12)]
        "
      />

      {/* =====================================================
          SECOND GREEN CURVE
      ===================================================== */}

      <div
        className="
          absolute
          right-[43%]
          top-[-15%]
          h-[130%]
          w-[13%]
          rotate-[5deg]
          rounded-[50%]
          bg-[#173e28]
        "
      />

      {/* =====================================================
          GOLD CURVED BORDER
      ===================================================== */}

      <div
        className="
          absolute
          right-[48.3%]
          top-[-12%]
          h-[125%]
          w-[5px]
          rotate-[5deg]
          rounded-full
          bg-gradient-to-b
          from-[#9c7618]
          via-[#e5c05a]
          to-[#b88b20]
          shadow-[0_0_15px_rgba(210,170,55,0.25)]
        "
      />

      {/* =====================================================
          AGRICULTURAL DECORATIONS
      ===================================================== */}

      <div className="pointer-events-none absolute bottom-[-45px] left-[-20px] z-[2]">

        <div className="text-[190px] opacity-[0.22]">
          🌾
        </div>

      </div>

      <div className="pointer-events-none absolute bottom-[-55px] left-[130px] z-[2]">

        <div className="text-[150px] opacity-[0.13]">
          🌾
        </div>

      </div>

      <div className="pointer-events-none absolute bottom-[-60px] left-[260px] z-[2]">

        <div className="text-[120px] opacity-[0.10]">
          🌾
        </div>

      </div>

      {/* =====================================================
          PAGE CONTENT
      ===================================================== */}

      <div
        className="
          relative
          z-10
          grid
          min-h-screen
          grid-cols-1
          lg:grid-cols-[48%_52%]
        "
      >

        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <section
          className="
            flex
            items-center
            justify-center
            px-6
            py-12
            lg:px-10
          "
        >

          <div className="w-full max-w-[590px] text-center">

            {/* LOGO */}

            <div
              className="
                relative
                mx-auto
                flex
                h-[280px]
                w-[280px]
                items-center
                justify-center

                sm:h-[320px]
                sm:w-[320px]

                lg:h-[350px]
                lg:w-[350px]
              "
            >

              <Image
                src="/dcyes.png"
                alt="DCYES Logo"
                width={500}
                height={500}
                priority
                className="
                  h-full
                  w-full
                  object-contain
                  drop-shadow-[0_12px_15px_rgba(0,0,0,0.10)]
                "
              />

            </div>

            {/* DCYES */}

            <h1
              className="
                mt-1
                font-serif
                text-6xl
                font-bold
                tracking-[0.09em]
                text-[#173b27]

                sm:text-7xl
                lg:text-[78px]
              "
            >
              DCYES
            </h1>

            {/* SUBTITLE */}

            <p
              className="
                mt-3
                text-base
                font-semibold
                tracking-[0.10em]
                text-[#39483c]

                sm:text-lg
              "
            >
              FINANCIAL MANAGEMENT SYSTEM
            </p>

            {/* GOLD DIVIDER */}

            <div
              className="
                mx-auto
                mt-8
                flex
                max-w-[440px]
                items-center
                gap-3
              "
            >

              <div
                className="
                  h-px
                  flex-1
                  bg-gradient-to-r
                  from-transparent
                  via-[#c29a35]
                  to-[#c29a35]
                "
              />

              <div
                className="
                  h-2
                  w-2
                  rotate-45
                  bg-[#c29a35]
                "
              />

              <div
                className="
                  h-px
                  flex-1
                  bg-gradient-to-l
                  from-transparent
                  via-[#c29a35]
                  to-[#c29a35]
                "
              />

            </div>

            {/* TAGLINE */}

            <div
              className="
                mt-6
                flex
                items-center
                justify-center
                gap-3
              "
            >

              <span className="text-xl text-[#66834c]">
                ❧
              </span>

              <p
                className="
                  font-serif
                  text-2xl
                  font-semibold
                  italic
                  text-[#3f533e]

                  sm:text-3xl
                "
              >
                Trust and Commitment
              </p>

              <span className="rotate-180 text-xl text-[#66834c]">
                ❧
              </span>

            </div>

          </div>

        </section>

        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}

        <section
          className="
            flex
            items-center
            justify-center
            px-5
            py-10

            lg:px-12
          "
        >

          {/* LOGIN CARD */}

          <div
            className="
              w-full
              max-w-[580px]
              rounded-[30px]
              border
              border-[#c9a846]/70
              bg-[#0c2a1c]/95
              p-7

              shadow-[0_30px_80px_rgba(0,0,0,0.30)]

              backdrop-blur-xl

              sm:p-10
              lg:p-12
            "
          >

            {/* =================================================
                SECURE ACCESS
            ================================================= */}

            <div className="flex items-center gap-4">

              <div
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-[#d4b34d]/30
                  bg-[#d4b34d]/10
                "
              >

                <span className="text-2xl text-[#d7b64c]">
                  🌿
                </span>

              </div>

              <div>

                <h2
                  className="
                    text-xl
                    font-semibold
                    tracking-wide
                    text-[#d9b84d]

                    sm:text-2xl
                  "
                >
                  Secure Access
                </h2>

              </div>

            </div>

            {/* INTRO */}

            <div className="mt-8">

              <h3
                className="
                  font-serif
                  text-3xl
                  font-bold
                  text-white

                  sm:text-4xl
                "
              >
                Sign in to continue
              </h3>

              <p
                className="
                  mt-3
                  text-sm
                  leading-6
                  text-[#d7e4da]/60
                "
              >
                Access the DCYES Financial Management System
                using your authorized account.
              </p>

            </div>

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
              <div
                className="
                  mt-6
                  rounded-xl
                  border
                  border-red-400/20
                  bg-red-500/10
                  px-4
                  py-3
                "
              >

                <p className="text-sm font-medium text-red-300">
                  {error}
                </p>

              </div>
            )}

            {/* =================================================
                LOGIN FORM
            ================================================= */}

            <form
              onSubmit={handleLogin}
              className="mt-8 space-y-6"
            >

              {/* EMAIL */}

              <div>

                <label
                  htmlFor="email"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-white
                  "
                >
                  Email Address
                </label>

                <div className="relative">

                  <div
                    className="
                      pointer-events-none
                      absolute
                      inset-y-0
                      left-0
                      flex
                      items-center
                      pl-5
                      text-lg
                      text-[#d1b04b]/70
                    "
                  >
                    ✉
                  </div>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-white/20
                      bg-[#092116]/80

                      py-4
                      pl-14
                      pr-4

                      text-white

                      outline-none

                      placeholder:text-[#dce7df]/30

                      transition-all
                      duration-200

                      focus:border-[#d2ad42]
                      focus:ring-4
                      focus:ring-[#d2ad42]/10

                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  />

                </div>

              </div>

              {/* PASSWORD */}

              <div>

                <label
                  htmlFor="password"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-white
                  "
                >
                  Password
                </label>

                <div className="relative">

                  <div
                    className="
                      pointer-events-none
                      absolute
                      inset-y-0
                      left-0
                      flex
                      items-center
                      pl-5
                      text-lg
                    "
                  >
                    🔒
                  </div>

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-white/20
                      bg-[#092116]/80

                      py-4
                      pl-14
                      pr-20

                      text-white

                      outline-none

                      placeholder:text-[#dce7df]/30

                      transition-all
                      duration-200

                      focus:border-[#d2ad42]
                      focus:ring-4
                      focus:ring-[#d2ad42]/10

                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (prev) => !prev
                      )
                    }
                    disabled={loading}
                    className="
                      absolute
                      inset-y-0
                      right-0
                      flex
                      items-center
                      px-5

                      text-xs
                      font-bold
                      tracking-wide
                      text-[#dce7df]/50

                      transition

                      hover:text-[#e0bd50]
                    "
                  >
                    {showPassword
                      ? "HIDE"
                      : "SHOW"}
                  </button>

                </div>

              </div>

              {/* =================================================
                  REMEMBER ME ONLY
              ================================================= */}

              <div className="flex items-center">

                <label
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-3
                    text-sm
                    text-[#edf5ef]/80
                  "
                >

                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) =>
                      setRememberMe(
                        e.target.checked
                      )
                    }
                    className="
                      h-5
                      w-5
                      cursor-pointer
                      accent-[#d6af3e]
                    "
                  />

                  <span>
                    Remember me
                  </span>

                </label>

              </div>

              {/* =================================================
                  SIGN IN BUTTON
              ================================================= */}

              <button
                type="submit"
                disabled={loading}
                className="
                  group
                  flex
                  w-full
                  items-center
                  justify-center
                  rounded-xl

                  bg-gradient-to-r
                  from-[#d3a52f]
                  via-[#f0ca5b]
                  to-[#d5a52b]

                  py-4

                  text-lg
                  font-bold
                  text-[#17351f]

                  shadow-[0_12px_30px_rgba(214,170,55,0.25)]

                  transition-all
                  duration-300

                  hover:-translate-y-0.5
                  hover:brightness-105
                  hover:shadow-[0_16px_40px_rgba(214,170,55,0.35)]

                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  disabled:hover:translate-y-0
                "
              >

                {loading ? (

                  <span className="flex items-center gap-3">

                    <span
                      className="
                        h-5
                        w-5
                        animate-spin
                        rounded-full
                        border-2
                        border-[#17351f]/30
                        border-t-[#17351f]
                      "
                    />

                    Signing in...

                  </span>

                ) : (

                  <span className="flex items-center gap-4">

                    SIGN IN

                    <span
                      className="
                        text-xl
                        transition-transform
                        duration-200
                        group-hover:translate-x-1
                      "
                    >
                      →
                    </span>

                  </span>

                )}

              </button>

            </form>

            {/* =================================================
                AUTHORIZED PERSONNEL
            ================================================= */}

            <div
              className="
                mt-8
                border-t
                border-white/10
                pt-6
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  text-sm
                  text-[#dce7df]/55
                "
              >

                <span className="text-[#d6af3e]">
                  🔒
                </span>

                <span>
                  Authorized personnel only
                </span>

              </div>

            </div>

          </div>

        </section>

      </div>

      {/* =====================================================
          BOTTOM COPYRIGHT
      ===================================================== */}

      <div
        className="
          absolute
          bottom-4
          left-1/2
          z-20
          hidden
          -translate-x-1/2
          text-xs
          text-[#526256]/60

          lg:block
        "
      >
        © 2026 DCYES Financial Management System
      </div>

    </main>
  );
}