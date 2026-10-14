
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_DESTINATIONS = new Set([
  "expenses",
  "liquidation",
  "telegraphic_transfer",
  "deposit_slips",
]);

type DailyRecordItemInput = {
  description?: unknown;
  amount?: unknown;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

async function verifyAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized. Please log in again as Admin." },
        { status: 401 }
      ),
    };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Missing login token." },
        { status: 401 }
      ),
    };
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user?.email) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid or expired login session." },
        { status: 401 }
      ),
    };
  }

  const email = authData.user.email.trim().toLowerCase();

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("users")
      .select("id, name, email, position, status")
      .eq("email", email)
      .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Admin profile not found." },
        { status: 403 }
      ),
    };
  }

  const position = String(profile.position || "").trim().toLowerCase();
  const status = String(profile.status || "").trim().toLowerCase();

  if (position !== "admin" || status !== "active") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Active Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, email, profile };
}

export async function POST(request: Request) {
  try {
    const adminCheck = await verifyAdmin(request);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const submissionKey = String(body.submission_key || "").trim();
    const recordDate = String(body.record_date || "").trim();
    const payee = String(body.payee || "").trim();
    const employeeName = String(body.employee_name || "").trim();
    const receiptNo = String(body.receipt_no || "").trim();
    const address = String(body.address ?? "").trim();
    const remarks = String(body.remarks || "").trim();
    const destination = String(body.destination || "").trim();
    const locationId = Number(body.location_id);
    const rawItems = body.items;

    if (!isValidUuid(submissionKey)) {
      return NextResponse.json(
        { error: "Invalid submission key." },
        { status: 400 }
      );
    }

    if (!isValidDate(recordDate)) {
      return NextResponse.json(
        { error: "Please provide a valid date." },
        { status: 400 }
      );
    }

    if (!payee) {
      return NextResponse.json(
        { error: "Payee is required." },
        { status: 400 }
      );
    }

    if (address.length > 2000) {
      return NextResponse.json(
        { error: "Address must not exceed 2,000 characters." },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(locationId) || locationId <= 0) {
      return NextResponse.json(
        { error: "Valid project location is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_DESTINATIONS.has(destination)) {
      return NextResponse.json(
        { error: "Invalid destination." },
        { status: 400 }
      );
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required." },
        { status: 400 }
      );
    }

    if (rawItems.length > 100) {
      return NextResponse.json(
        { error: "Too many items in one Daily Record." },
        { status: 400 }
      );
    }

    const items = rawItems.map((rawItem: DailyRecordItemInput) => ({
      description: String(rawItem?.description || "").trim(),
      amount: Number(rawItem?.amount),
    }));

    const invalidItem = items.some(
      (item) =>
        !item.description ||
        !Number.isFinite(item.amount) ||
        item.amount <= 0
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          error:
            "Every item must have a description and an amount greater than zero.",
        },
        { status: 400 }
      );
    }

    const { data: location, error: locationError } =
      await supabaseAdmin
        .from("locations")
        .select("id")
        .eq("id", locationId)
        .maybeSingle();

    if (locationError || !location) {
      return NextResponse.json(
        { error: "Project location not found." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "create_daily_record_with_items",
      {
        p_submission_key: submissionKey,
        p_record_date: recordDate,
        p_payee: payee,
        p_employee_name: employeeName || null,
        p_receipt_no: receiptNo || null,
        p_remarks: remarks || null,
        p_location_id: locationId,
        p_destination: destination,
        p_created_by_email: adminCheck.email,
        p_items: items,
        p_address: address || null,
      }
    );

    if (error) {
      console.error("Create Daily Record error:", error);

      return NextResponse.json(
        {
          error:
            error.message || "Unable to save Daily Record.",
        },
        { status: 400 }
      );
    }

    const createdRecord = Array.isArray(data) ? data[0] : data;

    if (!createdRecord?.id || !createdRecord?.transaction_no) {
      console.error("Unexpected Daily Record RPC result:", data);

      return NextResponse.json(
        {
          error:
            "Daily Record was not returned correctly after saving.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        record: {
          id: createdRecord.id,
          transaction_no: createdRecord.transaction_no,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Daily Records POST error:", error);

    return NextResponse.json(
      {
        error:
          "Unexpected server error while saving Daily Record.",
      },
      { status: 500 }
    );
  }
}


export async function PATCH(request: Request) {
  try {
    const adminCheck = await verifyAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const id = Number(body.id);
    const recordDate = String(body.record_date || "").trim();
    const payee = String(body.payee || "").trim();
    const employeeName = String(body.employee_name || "").trim();
    const receiptNo = String(body.receipt_no || "").trim();
    const address = String(body.address ?? "").trim();
    const remarks = String(body.remarks || "").trim();
    const destination = String(body.destination || "").trim();
    const locationId = Number(body.location_id);
    const rawItems = body.items;

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "Valid Daily Record ID is required." }, { status: 400 });
    }
    if (!isValidDate(recordDate)) {
      return NextResponse.json({ success: false, error: "Please provide a valid date." }, { status: 400 });
    }
    if (!payee) {
      return NextResponse.json({ success: false, error: "Payee is required." }, { status: 400 });
    }
    if (address.length > 2000) {
      return NextResponse.json({ success: false, error: "Address must not exceed 2,000 characters." }, { status: 400 });
    }
    if (!Number.isSafeInteger(locationId) || locationId <= 0) {
      return NextResponse.json({ success: false, error: "Valid project location is required." }, { status: 400 });
    }
    if (!ALLOWED_DESTINATIONS.has(destination)) {
      return NextResponse.json({ success: false, error: "Invalid destination." }, { status: 400 });
    }
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) {
      return NextResponse.json({ success: false, error: "A record must have 1 to 100 items." }, { status: 400 });
    }

    const items = rawItems.map((raw: DailyRecordItemInput & { id?: unknown }, index) => ({
      id: raw.id === undefined || raw.id === null ? null : Number(raw.id),
      description: String(raw.description || "").trim(),
      amount: Number(raw.amount),
      item_order: index + 1,
    }));
    if (items.some((item) => !item.description || !Number.isFinite(item.amount) || item.amount <= 0)) {
      return NextResponse.json({ success: false, error: "Every item needs a description and an amount greater than zero." }, { status: 400 });
    }

    const { data: existingRecord, error: existingError } = await supabaseAdmin
      .from("daily_records").select("id, transaction_no").eq("id", id).maybeSingle();
    if (existingError) {
      console.error("Edit Daily Record lookup error:", existingError);
      return NextResponse.json({ success: false, error: "Unable to verify this Daily Record." }, { status: 500 });
    }
    if (!existingRecord) {
      return NextResponse.json({ success: false, error: "Daily Record not found." }, { status: 404 });
    }

    const { data: location, error: locationError } = await supabaseAdmin
      .from("locations").select("id").eq("id", locationId).maybeSingle();
    if (locationError || !location) {
      return NextResponse.json({ success: false, error: "Project location not found." }, { status: 400 });
    }

    const { data: existingItems, error: itemsLookupError } = await supabaseAdmin
      .from("daily_record_items").select("id").eq("daily_record_id", id);
    if (itemsLookupError) {
      console.error("Edit Daily Record items lookup error:", itemsLookupError);
      return NextResponse.json({ success: false, error: "Unable to verify existing record items." }, { status: 500 });
    }

    const existingIds = new Set<number>((existingItems || []).map((item: { id: number }) => Number(item.id)));
    const submittedIds = items.filter((item) => item.id !== null).map((item) => item.id as number);
    if (submittedIds.some((itemId) => !Number.isSafeInteger(itemId) || !existingIds.has(itemId)) ||
        new Set(submittedIds).size !== submittedIds.length) {
      return NextResponse.json({ success: false, error: "One or more item IDs do not belong to this Daily Record." }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("daily_records")
      .update({
        record_date: recordDate,
        payee,
        employee_name: employeeName || null,
        receipt_no: receiptNo || null,
        address: address || null,
        remarks: remarks || null,
        location_id: locationId,
        destination,
      })
      .eq("id", id);
    if (updateError) {
      console.error("Update Daily Record error:", updateError);
      return NextResponse.json({ success: false, error: updateError.message || "Unable to update Daily Record." }, { status: 400 });
    }

    for (const item of items) {
      if (item.id !== null) {
        const { error } = await supabaseAdmin
          .from("daily_record_items")
          .update({ description: item.description, amount: item.amount, item_order: item.item_order })
          .eq("id", item.id)
          .eq("daily_record_id", id);
        if (error) {
          console.error("Update Daily Record item error:", error);
          return NextResponse.json({ success: false, error: "Record header updated but an item could not be updated. Reload and review this record before retrying." }, { status: 500 });
        }
      } else {
        const { error } = await supabaseAdmin.from("daily_record_items").insert({
          daily_record_id: id,
          description: item.description,
          amount: item.amount,
          item_order: item.item_order,
        });
        if (error) {
          console.error("Insert Daily Record item error:", error);
          return NextResponse.json({ success: false, error: "Record header updated but a new item could not be added. Reload and review this record before retrying." }, { status: 500 });
        }
      }
    }

    const removedIds = [...existingIds].filter((itemId) => !submittedIds.includes(itemId));
    if (removedIds.length) {
      const { error } = await supabaseAdmin
        .from("daily_record_items").delete().eq("daily_record_id", id).in("id", removedIds);
      if (error) {
        console.error("Delete removed Daily Record items error:", error);
        return NextResponse.json({ success: false, error: "Record updated, but a removed item could not be deleted. Reload and review the record." }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      record: { id: existingRecord.id, transaction_no: existingRecord.transaction_no },
    });
  } catch (error) {
    console.error("Daily Records PATCH error:", error);
    return NextResponse.json({ success: false, error: "Unexpected server error while updating Daily Record." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminCheck = await verifyAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "Valid Daily Record ID is required." }, { status: 400 });
    }

    const { data: record, error: recordError } = await supabaseAdmin
      .from("daily_records").select("id, transaction_no").eq("id", id).maybeSingle();
    if (recordError) {
      console.error("Delete Daily Record lookup error:", recordError);
      return NextResponse.json({ success: false, error: "Unable to verify this Daily Record." }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json({ success: false, error: "Daily Record not found." }, { status: 404 });
    }

    const { data: attachments, error: attachmentsError } = await supabaseAdmin
      .from("daily_record_attachments").select("id, storage_path").eq("daily_record_id", id);
    if (attachmentsError) {
      console.error("Delete Daily Record attachments lookup error:", attachmentsError);
      return NextResponse.json({ success: false, error: "Unable to verify linked receipt attachments. Nothing was deleted." }, { status: 500 });
    }

    const paths = (attachments || []).map((item) => item.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabaseAdmin.storage.from("daily-record-proofs").remove(paths);
      if (storageError) {
        console.error("Delete receipt files error:", storageError);
        return NextResponse.json({ success: false, error: "Could not remove receipt files. The Daily Record was not deleted." }, { status: 500 });
      }
    }

    if (attachments?.length) {
      const { error } = await supabaseAdmin.from("daily_record_attachments").delete().eq("daily_record_id", id);
      if (error) {
        console.error("Delete attachment metadata error:", error);
        return NextResponse.json({ success: false, error: "Receipt files were removed from storage, but attachment metadata cleanup failed. Please contact an administrator." }, { status: 500 });
      }
    }

    const { error: itemDeleteError } = await supabaseAdmin
      .from("daily_record_items").delete().eq("daily_record_id", id);
    if (itemDeleteError) {
      console.error("Delete Daily Record items error:", itemDeleteError);
      return NextResponse.json({ success: false, error: "Receipt attachments were removed, but record items could not be deleted. The parent record remains." }, { status: 500 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("daily_records").delete().eq("id", id);
    if (deleteError) {
      console.error("Delete Daily Record error:", deleteError);
      return NextResponse.json({ success: false, error: "Receipt attachments and items were removed, but the Daily Record itself could not be deleted." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: record.id, transaction_no: record.transaction_no });
  } catch (error) {
    console.error("Daily Records DELETE error:", error);
    return NextResponse.json({ success: false, error: "Unexpected server error while deleting Daily Record." }, { status: 500 });
  }
}
