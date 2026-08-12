import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabaseAdmin";

// =====================================================
// DELETE LOCATION + CONNECTED RECORDS
// ADMIN ONLY
// =====================================================

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =================================================
    // LOCATION ID
    // =================================================

    const {
      id,
    } = await context.params;

    const locationId =
      Number(id);

    if (
      !locationId ||
      Number.isNaN(locationId)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid location ID.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // GET ACCESS TOKEN
    // =================================================

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Login required.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken =
      authorization.replace(
        "Bearer ",
        ""
      );

    // =================================================
    // VERIFY AUTH USER
    // =================================================

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (
      authError ||
      !authData.user
    ) {
      console.error(
        "Auth verification error:",
        authError
      );

      return NextResponse.json(
        {
          error:
            "Invalid or expired login session.",
        },
        {
          status: 401,
        }
      );
    }

    const authUser =
      authData.user;

    if (!authUser.email) {
      return NextResponse.json(
        {
          error:
            "User email not found.",
        },
        {
          status: 401,
        }
      );
    }

    // =================================================
    // VERIFY ADMIN ROLE
    // =================================================

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
          authUser.email
        )
        .maybeSingle();

    if (profileError) {
      console.error(
        "Admin profile error:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify user role.",
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
          status: 403,
        }
      );
    }

    const isAdmin =
      String(
        profile.position || ""
      )
        .trim()
        .toLowerCase() ===
      "admin";

    const isActive =
      String(
        profile.status || ""
      )
        .trim()
        .toLowerCase() ===
      "active";

    if (
      !isAdmin ||
      !isActive
    ) {
      return NextResponse.json(
        {
          error:
            "Admin access required.",
        },
        {
          status: 403,
        }
      );
    }

    // =================================================
    // CHECK LOCATION
    // =================================================

    const {
      data: location,
      error: locationError,
    } =
      await supabaseAdmin
        .from("locations")
        .select(
          "id, name"
        )
        .eq(
          "id",
          locationId
        )
        .maybeSingle();

    if (locationError) {
      console.error(
        "Location lookup error:",
        locationError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check location.",
        },
        {
          status: 500,
        }
      );
    }

    if (!location) {
      return NextResponse.json(
        {
          error:
            "Location not found.",
        },
        {
          status: 404,
        }
      );
    }

    // =================================================
    // GET EXPENSE IDs FIRST
    // expense_items are connected to expenses
    // =================================================

    const {
      data: expenseRows,
      error: expenseLookupError,
    } =
      await supabaseAdmin
        .from("expenses")
        .select("id")
        .eq(
          "location_id",
          locationId
        );

    if (expenseLookupError) {
      console.error(
        "Expense lookup error:",
        expenseLookupError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check expense records.",
        },
        {
          status: 500,
        }
      );
    }

    const expenseIds =
      (expenseRows || []).map(
        (item) =>
          Number(item.id)
      );

    // =================================================
    // DELETE EXPENSE ITEMS
    // =================================================

    if (
      expenseIds.length > 0
    ) {
      const {
        error:
          expenseItemsError,
      } =
        await supabaseAdmin
          .from(
            "expense_items"
          )
          .delete()
          .in(
            "expense_id",
            expenseIds
          );

      if (expenseItemsError) {
        console.error(
          "Delete expense items error:",
          expenseItemsError
        );

        return NextResponse.json(
          {
            error:
              "Failed to delete expense items: " +
              expenseItemsError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    // =================================================
    // DELETE EXPENSES
    // =================================================

    const {
      error: expensesError,
    } =
      await supabaseAdmin
        .from("expenses")
        .delete()
        .eq(
          "location_id",
          locationId
        );

    if (expensesError) {
      console.error(
        "Delete expenses error:",
        expensesError
      );

      return NextResponse.json(
        {
          error:
            "Failed to delete expenses: " +
            expensesError.message,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // DELETE LIQUIDATIONS
    // =================================================

    const {
      error:
        liquidationsError,
    } =
      await supabaseAdmin
        .from("liquidations")
        .delete()
        .eq(
          "location_id",
          locationId
        );

    if (liquidationsError) {
      console.error(
        "Delete liquidations error:",
        liquidationsError
      );

      return NextResponse.json(
        {
          error:
            "Failed to delete liquidation records: " +
            liquidationsError.message,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // DELETE TELEGRAPHIC TRANSFERS
    // =================================================

    const {
      error:
        telegraphicError,
    } =
      await supabaseAdmin
        .from(
          "telegraphic_transfers"
        )
        .delete()
        .eq(
          "location_id",
          locationId
        );

    if (telegraphicError) {
      console.error(
        "Delete telegraphic error:",
        telegraphicError
      );

      return NextResponse.json(
        {
          error:
            "Failed to delete Telegraphic Transfer records: " +
            telegraphicError.message,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // DELETE DEPOSIT SLIPS
    // =================================================

    const {
      error:
        depositsError,
    } =
      await supabaseAdmin
        .from(
          "deposit_slips"
        )
        .delete()
        .eq(
          "location_id",
          locationId
        );

    if (depositsError) {
      console.error(
        "Delete deposit slips error:",
        depositsError
      );

      return NextResponse.json(
        {
          error:
            "Failed to delete Deposit Slip records: " +
            depositsError.message,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // DELETE LOCATION LAST
    // =================================================

    const {
      error:
        deleteLocationError,
    } =
      await supabaseAdmin
        .from("locations")
        .delete()
        .eq(
          "id",
          locationId
        );

    if (
      deleteLocationError
    ) {
      console.error(
        "Delete location error:",
        deleteLocationError
      );

      return NextResponse.json(
        {
          error:
            "Failed to delete location: " +
            deleteLocationError.message,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // SUCCESS
    // =================================================

    return NextResponse.json(
      {
        success: true,

        message:
          `"${location.name}" and all connected financial records were permanently deleted.`,

        location: {
          id:
            location.id,

          name:
            location.name,
        },

        deleted: {
          expenseRecords:
            expenseIds.length,

          liquidationRecords:
            "deleted",

          telegraphicRecords:
            "deleted",

          depositRecords:
            "deleted",
        },
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "Delete location API error:",
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