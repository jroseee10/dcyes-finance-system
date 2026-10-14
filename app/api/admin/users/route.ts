import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// =====================================================
// VERIFY ADMIN
// =====================================================

async function verifyAdmin(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Unauthorized. Mag-login ulit bilang Admin.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const token = authorization
    .slice(7)
    .trim();

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Missing login token.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const {
    data: authData,
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    authError ||
    !authData.user?.email
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Invalid or expired login session.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const currentEmail =
    authData.user.email
      .trim()
      .toLowerCase();

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseAdmin
      .from("users")
      .select(
        "id, email, position, status"
      )
      .eq(
        "email",
        currentEmail
      )
      .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Admin profile not found.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  const position =
    String(
      profile.position || ""
    )
      .trim()
      .toLowerCase();

  const status =
    String(
      profile.status || ""
    )
      .trim()
      .toLowerCase();

  if (
    position !== "admin" ||
    status !== "active"
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Admin access required.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    ok: true as const,
  };
}

// =====================================================
// FIND AUTH USER BY EMAIL
// =====================================================

async function findAuthUserByEmail(
  email: string
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  let page = 1;
  const perPage = 1000;

  while (true) {
    const {
      data,
      error,
    } =
      await supabaseAdmin.auth.admin.listUsers(
        {
          page,
          perPage,
        }
      );

    if (error) {
      return {
        user: null,
        error,
      };
    }

    const user =
      data.users.find(
        (item) =>
          item.email
            ?.trim()
            .toLowerCase() ===
          normalizedEmail
      );

    if (user) {
      return {
        user,
        error: null,
      };
    }

    if (
      data.users.length <
      perPage
    ) {
      break;
    }

    page++;
  }

  return {
    user: null,
    error: null,
  };
}

// =====================================================
// POST
// CREATE LOGIN ACCOUNT
// =====================================================

export async function POST(
  request: Request
) {
  try {
    const adminCheck =
      await verifyAdmin(request);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body =
      await request.json();

    const name =
      String(
        body.name || ""
      ).trim();

    const email =
      String(
        body.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body.password || ""
      );

    const position =
      String(
        body.position ||
          "Office Staff"
      ).trim();

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Full Name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      position !== "Admin" &&
      position !== "Office Staff"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid position.",
        },
        {
          status: 400,
        }
      );
    }

    // Check public.users

    const {
      data: existingProfile,
      error: profileCheckError,
    } =
      await supabaseAdmin
        .from("users")
        .select(
          "id, email"
        )
        .eq(
          "email",
          email
        )
        .maybeSingle();

    if (profileCheckError) {
      return NextResponse.json(
        {
          error:
            profileCheckError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            "May existing user na gamit ang email na ito.",
        },
        {
          status: 409,
        }
      );
    }

    // Check Supabase Auth

    const {
      user: existingAuthUser,
      error: authLookupError,
    } =
      await findAuthUserByEmail(
        email
      );

    if (authLookupError) {
      return NextResponse.json(
        {
          error:
            authLookupError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (existingAuthUser) {
      return NextResponse.json(
        {
          error:
            "May existing login account na sa Authentication para sa email na ito.",
        },
        {
          status: 409,
        }
      );
    }

    // Create Auth account

    const {
      data: authCreateData,
      error: authCreateError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password,
          email_confirm: true,

          user_metadata: {
            name,
            position,
          },
        }
      );

    if (
      authCreateError ||
      !authCreateData.user
    ) {
      return NextResponse.json(
        {
          error:
            authCreateError?.message ||
            "Could not create login account.",
        },
        {
          status: 400,
        }
      );
    }

    // Create profile

    const {
      data: newProfile,
      error: insertError,
    } =
      await supabaseAdmin
        .from("users")
        .insert({
          name,
          email,
          position,
          status: "Active",
        })
        .select(
          "id, name, email, position, status, created_at"
        )
        .single();

    if (
      insertError ||
      !newProfile
    ) {
      // rollback Auth user

      await supabaseAdmin.auth.admin.deleteUser(
        authCreateData.user.id
      );

      return NextResponse.json(
        {
          error:
            "Profile creation failed. Login account was rolled back. " +
            (insertError?.message ||
              ""),
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Login account successfully created.",
        user:
          newProfile,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST admin users error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// PATCH
// RESET EXISTING PASSWORD
// =====================================================

export async function PATCH(
  request: Request
) {
  try {
    const adminCheck =
      await verifyAdmin(request);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body =
      await request.json();

    const email =
      String(
        body.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body.password || ""
      );

    if (!email) {
      return NextResponse.json(
        {
          error:
            "User email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "New password must be at least 8 characters.",
        },
        {
          status: 400,
        }
      );
    }

    // Check profile exists

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from("users")
        .select(
          "id, name, email, position, status"
        )
        .eq(
          "email",
          email
        )
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          error:
            profileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "User profile not found.",
        },
        {
          status: 404,
        }
      );
    }

    // Find matching Auth user

    const {
      user: authUser,
      error: authLookupError,
    } =
      await findAuthUserByEmail(
        email
      );

    if (authLookupError) {
      return NextResponse.json(
        {
          error:
            authLookupError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!authUser) {
      return NextResponse.json(
        {
          error:
            "No Supabase Authentication account found for this email.",
        },
        {
          status: 404,
        }
      );
    }

    // Change password

    const {
      error: updateError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        {
          password,
        }
      );

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          `Password successfully changed for ${profile.name}.`,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "PATCH admin users error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      {
        status: 500,
      }
    );
  }
}