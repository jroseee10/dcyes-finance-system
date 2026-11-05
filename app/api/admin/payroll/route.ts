
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OvertimeMode = "automatic" | "manual";

type CleanPayrollRecord = {
  id?: string;
  employee_no: number;
  employee_name: string;
  designation: string;
  daily_rate: number;
  days_worked: number;
  total_pay: number;
  overtime_hours: number;
  overtime_total: number;
  net_amount: number;
  overtime_mode: OvertimeMode;
  manual_overtime_amount: number;
};

async function verifyAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized. Please log in again as Admin." },
        { status: 401 },
      ),
    };
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Missing login token." },
        { status: 401 },
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
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, name, email, position, status")
    .eq("email", authData.user.email)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Admin profile not found." },
        { status: 403 },
      ),
    };
  }

  if (
    String(profile.position || "").trim().toLowerCase() !== "admin" ||
    String(profile.status || "").trim().toLowerCase() !== "active"
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Active Admin access required." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, profile };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cleanRecords(
  records: unknown,
  editing: boolean,
):
  | { ok: true; records: CleanPayrollRecord[] }
  | { ok: false; error: string } {
  if (!Array.isArray(records) || records.length < 1 || records.length > 500) {
    return {
      ok: false,
      error: "Add at least one employee and no more than 500 rows.",
    };
  }

  const seenIds = new Set<string>();
  const result: CleanPayrollRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return {
        ok: false,
        error: `Row ${i + 1}: invalid employee data.`,
      };
    }

    const record = row as Record<string, unknown>;
    const employeeName = String(record.employee_name ?? "").trim();
    const designation = String(record.designation ?? "").trim();

    const dailyRate = Number(record.daily_rate);
    const daysWorked = Number(record.days_worked);
    const overtimeHours = Number(record.overtime_hours);

    const rawMode = String(record.overtime_mode ?? "automatic")
      .trim()
      .toLowerCase();

    const overtimeMode: OvertimeMode =
      rawMode === "manual" ? "manual" : "automatic";

    if (rawMode !== "automatic" && rawMode !== "manual") {
      return {
        ok: false,
        error: `Row ${i + 1}: invalid OT Pay Mode.`,
      };
    }

    const manualOvertimeAmount = Number(
      record.manual_overtime_amount ?? 0,
    );

    const recordId = String(record.id ?? "").trim();

    if (editing && recordId) {
      if (!uuidPattern.test(recordId)) {
        return {
          ok: false,
          error: `Row ${i + 1}: invalid employee record ID.`,
        };
      }

      const normalizedId = recordId.toLowerCase();

      if (seenIds.has(normalizedId)) {
        return {
          ok: false,
          error: `Row ${i + 1}: duplicate employee record ID.`,
        };
      }

      seenIds.add(normalizedId);
    }

    if (!employeeName) {
      return {
        ok: false,
        error: `Row ${i + 1}: employee name is required.`,
      };
    }

    if (
      ![dailyRate, daysWorked, overtimeHours, manualOvertimeAmount].every(
        Number.isFinite,
      ) ||
      dailyRate < 0 ||
      dailyRate > 9999999999.99 ||
      daysWorked < 0 ||
      daysWorked > 31 ||
      overtimeHours < 0 ||
      overtimeHours > 500 ||
      manualOvertimeAmount < 0 ||
      manualOvertimeAmount > 9999999999.99
    ) {
      return {
        ok: false,
        error: `Row ${i + 1}: check rate, days, OT hours, and manual OT amount.`,
      };
    }

    const totalPay = roundMoney(dailyRate * daysWorked);

    const overtimeTotal =
      overtimeMode === "manual"
        ? roundMoney(manualOvertimeAmount)
        : roundMoney((dailyRate / 8) * overtimeHours);

    const netAmount = roundMoney(totalPay + overtimeTotal);

    result.push({
      ...(editing && recordId ? { id: recordId } : {}),
      employee_no: i + 1,
      employee_name: employeeName,
      designation,
      daily_rate: dailyRate,
      days_worked: daysWorked,
      total_pay: totalPay,
      overtime_hours: overtimeHours,
      overtime_total: overtimeTotal,
      net_amount: netAmount,
      overtime_mode: overtimeMode,
      manual_overtime_amount: roundMoney(manualOvertimeAmount),
    });
  }

  return { ok: true, records: result };
}

export async function GET(request: Request) {
  const check = await verifyAdmin(request);
  if (!check.ok) return check.response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  let batchesQuery = supabaseAdmin
    .from("payroll_batches")
    .select(
      "id, pay_date, week_start, week_end, location_id, location_name, prepared_by, notes, created_at, payroll_records(id, employee_no, employee_name, designation, daily_rate, days_worked, total_pay, overtime_hours, overtime_total, net_amount, overtime_mode, manual_overtime_amount)",
    )
    .order("pay_date", { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split("-").map(Number);
    const start = `${month}-01`;

    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;

    batchesQuery = batchesQuery
      .gte("pay_date", start)
      .lt("pay_date", nextMonth);
  }

  const [
    { data: batches, error: batchesError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    batchesQuery,
    supabaseAdmin
      .from("locations")
      .select("id, name, address")
      .order("name", { ascending: true }),
  ]);

  if (batchesError) {
    return NextResponse.json(
      { error: `Could not load payroll: ${batchesError.message}` },
      { status: 500 },
    );
  }

  if (locationsError) {
    return NextResponse.json(
      { error: `Could not load locations: ${locationsError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    batches: batches ?? [],
    locations: locations ?? [],
  });
}

export async function POST(request: Request) {
  const check = await verifyAdmin(request);
  if (!check.ok) return check.response;

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const payDate = String(body.pay_date ?? "");
  const weekStart = String(body.week_start ?? "");
  const weekEnd = String(body.week_end ?? "");
  const locationId = Number(body.location_id);
  const preparedBy = String(body.prepared_by ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (
    !validDate(payDate) ||
    !validDate(weekStart) ||
    !validDate(weekEnd) ||
    weekEnd < weekStart
  ) {
    return NextResponse.json(
      { error: "Enter valid pay date, week start, and week end." },
      { status: 400 },
    );
  }

  if (!Number.isSafeInteger(locationId) || locationId <= 0) {
    return NextResponse.json(
      { error: "Please select a valid location." },
      { status: 400 },
    );
  }

  const cleaned = cleanRecords(body.records, false);

  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error }, { status: 400 });
  }

  const { data: location, error: locationError } = await supabaseAdmin
    .from("locations")
    .select("id, name")
    .eq("id", locationId)
    .maybeSingle();

  if (locationError || !location) {
    return NextResponse.json(
      { error: "Selected location was not found." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("save_payroll_batch", {
    p_pay_date: payDate,
    p_week_start: weekStart,
    p_week_end: weekEnd,
    p_location_id: locationId,
    p_location_name: location.name,
    p_prepared_by: preparedBy || check.profile.name || check.profile.email,
    p_notes: notes || null,
    p_created_by: check.profile.email,
    p_records: cleaned.records,
  });

  if (error) {
    return NextResponse.json(
      { error: `Payroll was not saved: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { success: true, batch_id: data },
    { status: 201 },
  );
}

export async function PUT(request: Request) {
  const check = await verifyAdmin(request);
  if (!check.ok) return check.response;

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const batchId = String(body.id ?? "").trim();
  const payDate = String(body.pay_date ?? "");
  const weekStart = String(body.week_start ?? "");
  const weekEnd = String(body.week_end ?? "");
  const locationId = Number(body.location_id);
  const preparedBy = String(body.prepared_by ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!uuidPattern.test(batchId)) {
    return NextResponse.json(
      { error: "Invalid payroll batch ID." },
      { status: 400 },
    );
  }

  if (
    !validDate(payDate) ||
    !validDate(weekStart) ||
    !validDate(weekEnd) ||
    weekEnd < weekStart
  ) {
    return NextResponse.json(
      { error: "Enter valid pay date, week start, and week end." },
      { status: 400 },
    );
  }

  if (!Number.isSafeInteger(locationId) || locationId <= 0) {
    return NextResponse.json(
      { error: "Please select a valid location." },
      { status: 400 },
    );
  }

  const cleaned = cleanRecords(body.records, true);

  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error }, { status: 400 });
  }

  const { data: location, error: locationError } = await supabaseAdmin
    .from("locations")
    .select("id, name")
    .eq("id", locationId)
    .maybeSingle();

  if (locationError || !location) {
    return NextResponse.json(
      { error: "Selected location was not found." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("update_payroll_batch", {
    p_batch_id: batchId,
    p_pay_date: payDate,
    p_week_start: weekStart,
    p_week_end: weekEnd,
    p_location_id: locationId,
    p_location_name: location.name,
    p_prepared_by: preparedBy || check.profile.name || check.profile.email,
    p_notes: notes || null,
    p_records: cleaned.records,
  });

  if (error) {
    return NextResponse.json(
      { error: `Payroll was not updated: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    batch_id: data,
  });
}

export async function DELETE(request: Request) {
  const check = await verifyAdmin(request);
  if (!check.ok) return check.response;

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("id")?.trim();

  if (!batchId) {
    return NextResponse.json(
      { error: "Payroll batch ID is required." },
      { status: 400 },
    );
  }

  if (!uuidPattern.test(batchId)) {
    return NextResponse.json(
      { error: "Invalid payroll batch ID." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("payroll_batches")
    .delete()
    .eq("id", batchId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not delete this batch. The database may restrict deletion because of related payroll records. No schema changes were made.",
      },
      { status: 409 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Payroll batch not found or already deleted." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    deleted_id: data.id,
  });
}
