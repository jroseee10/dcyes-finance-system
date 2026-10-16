
import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "daily-record-proofs";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return { error: jsonError("Authentication required.", 401) };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user?.email) {
    return {
      error: jsonError("Your session is invalid or expired.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, position, status")
    .eq("email", user.email)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    String(profile.position || "").trim().toLowerCase() !== "admin" ||
    String(profile.status || "").trim().toLowerCase() !== "active"
  ) {
    return {
      error: jsonError("An active Admin account is required.", 403),
    };
  }

  return { email: user.email };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) return admin.error;

    const { data: receipts, error: receiptsError } = await supabaseAdmin
      .from("standalone_receipts")
      .select("*")
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (receiptsError) {
      console.error("Standalone receipts query error:", receiptsError);
      return jsonError("Unable to load standalone receipts.", 500);
    }

    const { data: locations, error: locationsError } = await supabaseAdmin
      .from("locations")
      .select("id, name")
      .order("name");

    if (locationsError) {
      console.error("Receipt locations query error:", locationsError);
      return jsonError("Unable to load project locations.", 500);
    }

    const result = await Promise.all(
      (receipts || []).map(async (receipt) => {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(receipt.storage_path, 300);

        if (error) {
          console.error(
            "Standalone receipt signed URL error:",
            receipt.id,
            error
          );
        }

        return {
          ...receipt,
          signed_url: data?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      receipts: result,
      locations: locations || [],
    });
  } catch (error) {
    console.error("Standalone receipts GET error:", error);

    return jsonError(
      "An unexpected error occurred while loading receipts.",
      500
    );
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) return admin.error;

    const formData = await request.formData();

    const locationValue = formData.get("location_id");
    const receiptNoValue = formData.get("receipt_no");
    const dateValue = formData.get("receipt_date");
    const payeeValue = formData.get("payee");
    const amountValue = formData.get("amount");
    const descriptionValue = formData.get("description");
    const remarksValue = formData.get("remarks");
    const fileValue = formData.get("file");

    if (
      typeof locationValue !== "string" ||
      !/^[1-9]\d*$/.test(locationValue) ||
      !Number.isSafeInteger(Number(locationValue))
    ) {
      return jsonError("Please select a valid project location.", 400);
    }

    if (
      typeof dateValue !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
      Number.isNaN(Date.parse(`${dateValue}T00:00:00Z`))
    ) {
      return jsonError("Please provide a valid receipt date.", 400);
    }

    // Payee is optional. Empty values are saved as NULL.
    const payee =
      typeof payeeValue === "string" ? payeeValue.trim() : "";

    // Amount is optional. Missing or blank values default to zero.
    const amountText =
      typeof amountValue === "string" ? amountValue.trim() : "";

    const amount = amountText === "" ? 0 : Number(amountText);

    if (!Number.isFinite(amount) || amount < 0) {
      return jsonError(
        "Please enter a valid non-negative amount.",
        400
      );
    }

    if (
      !fileValue ||
      typeof fileValue === "string" ||
      typeof fileValue.arrayBuffer !== "function"
    ) {
      return jsonError("Please select a receipt photo.", 400);
    }

    const file = fileValue;

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return jsonError(
        "File must be greater than 0 and no larger than 10 MB.",
        400
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonError(
        "Only JPG, PNG, and WEBP images are allowed.",
        400
      );
    }

    const locationId = Number(locationValue);

    const { data: location, error: locationError } = await supabaseAdmin
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .maybeSingle();

    if (locationError) {
      console.error("Receipt location verification error:", locationError);
      return jsonError("Unable to verify the selected location.", 500);
    }

    if (!location) {
      return jsonError(
        "The selected project location does not exist.",
        400
      );
    }

    const rawName =
      file.name.split(/[\\/]/).pop()?.trim() || "receipt";

    const safeName =
      rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) ||
      "receipt";

    const storagePath =
      `standalone/${locationId}/${randomUUID()}-${safeName}`;

    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Standalone receipt upload error:", uploadError);
      return jsonError("Unable to upload the receipt photo.", 500);
    }

    uploadedPath = storagePath;

    const { data: savedReceipt, error: insertError } = await supabaseAdmin
      .from("standalone_receipts")
      .insert({
        location_id: locationId,
        receipt_no:
          typeof receiptNoValue === "string" && receiptNoValue.trim()
            ? receiptNoValue.trim()
            : null,
        receipt_date: dateValue,
        payee: payee || null,
        amount,
        description:
          typeof descriptionValue === "string" && descriptionValue.trim()
            ? descriptionValue.trim()
            : null,
        remarks:
          typeof remarksValue === "string" && remarksValue.trim()
            ? remarksValue.trim()
            : null,
        original_file_name: safeName,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        created_by_email: admin.email,
      })
      .select("id")
      .single();

    if (insertError || !savedReceipt) {
      console.error(
        "Standalone receipt database insert error:",
        insertError
      );

      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.error("Standalone receipt cleanup error:", cleanupError);
      }

      uploadedPath = null;

      return jsonError(
        "The photo uploaded, but its receipt record could not be saved.",
        500
      );
    }

    uploadedPath = null;

    return NextResponse.json({
      success: true,
      message: "Standalone receipt saved successfully.",
      id: savedReceipt.id,
    });
  } catch (error) {
    console.error("Standalone receipts POST error:", error);

    if (uploadedPath) {
      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([uploadedPath]);

      if (cleanupError) {
        console.error("Standalone receipt cleanup error:", cleanupError);
      }
    }

    return jsonError(
      "An unexpected error occurred while saving the receipt.",
      500
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) return admin.error;

    let body: { id?: unknown; kind?: unknown };

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid delete request.", 400);
    }

    const id = body.id;
    const kind = body.kind;

    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      (kind !== "standalone" && kind !== "daily")
    ) {
      return jsonError("Invalid receipt selection.", 400);
    }

    const table =
      kind === "standalone"
        ? "standalone_receipts"
        : "daily_record_attachments";

    const { data: receipt, error: lookupError } = await supabaseAdmin
      .from(table)
      .select("id, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Receipt delete lookup error:", lookupError);
      return jsonError("Unable to find the selected receipt.", 500);
    }

    if (!receipt || typeof receipt.storage_path !== "string") {
      return jsonError(
        "Receipt not found. Refresh the gallery.",
        404
      );
    }

    // Delete only the attachment row, never the Daily Record itself.
    const { data: deletedRows, error: deleteError } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError || !deletedRows?.length) {
      console.error("Receipt database delete error:", deleteError);
      return jsonError("Unable to delete the receipt record.", 500);
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([receipt.storage_path]);

    if (storageError) {
      console.error("Receipt storage cleanup error:", storageError);

      return NextResponse.json({
        success: true,
        warning:
          "The receipt record was deleted, but its photo could not be removed from Storage. Please contact the system administrator.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Receipt deleted successfully.",
    });
  } catch (error) {
    console.error("Receipt DELETE error:", error);

    return jsonError(
      "An unexpected error occurred while deleting the receipt.",
      500
    );
  }
}
