
import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "daily-record-proofs";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return jsonError("Authentication required.", 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.email) {
      return jsonError("Your session is invalid or expired.", 401);
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
      return jsonError("An active Admin account is required.", 403);
    }

    const formData = await request.formData();
    const recordIdValue = formData.get("daily_record_id");
    const fileValue = formData.get("file");

    if (
      typeof recordIdValue !== "string" ||
      !/^[1-9]\d*$/.test(recordIdValue)
    ) {
      return jsonError("A valid Daily Record ID is required.", 400);
    }

    if (
      !fileValue ||
      typeof fileValue === "string" ||
      typeof fileValue.arrayBuffer !== "function"
    ) {
      return jsonError("Please select a file to upload.", 400);
    }

    const recordId = Number(recordIdValue);

    if (!Number.isSafeInteger(recordId)) {
      return jsonError("Invalid Daily Record ID.", 400);
    }

    const file = fileValue;

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return jsonError("File must be greater than 0 and no larger than 10 MB.", 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonError("Only PDF, JPG, and PNG files are allowed.", 400);
    }

    const { data: record, error: recordError } = await supabaseAdmin
      .from("daily_records")
      .select("id")
      .eq("id", recordId)
      .maybeSingle();

    if (recordError) {
      console.error("Daily Record verification error:", recordError);
      return jsonError("Unable to verify the Daily Record.", 500);
    }

    if (!record) {
      return jsonError("The selected Daily Record does not exist.", 404);
    }

    const rawName = file.name.split(/[\\/]/).pop()?.trim() || "attachment";
    const safeName = rawName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120) || "attachment";

    const storagePath = `${recordId}/${randomUUID()}-${safeName}`;
    uploadedPath = storagePath;

    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Receipt storage upload error:", uploadError);
      uploadedPath = null;
      return jsonError("Unable to upload the file to storage.", 500);
    }

    const { error: insertError } = await supabaseAdmin
      .from("daily_record_attachments")
      .insert({
        daily_record_id: recordId,
        original_file_name: safeName,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
      });

    if (insertError) {
      console.error("Receipt attachment metadata error:", insertError);

      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.error("Receipt cleanup error:", cleanupError);
      }

      uploadedPath = null;
      return jsonError("File uploaded but its attachment record could not be saved.", 500);
    }

    uploadedPath = null;

    return NextResponse.json({
      success: true,
      message: "Attachment uploaded successfully.",
    });
  } catch (error) {
    console.error("Daily Record attachment API error:", error);

    if (uploadedPath) {
      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([uploadedPath]);

      if (cleanupError) {
        console.error("Receipt cleanup error:", cleanupError);
      }
    }

    return jsonError("An unexpected error occurred during upload.", 500);
  }
}
