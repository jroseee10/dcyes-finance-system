-- REVIEW ONLY. Do not run against production until reviewed and approved.
-- This migration creates new payroll tables and a single transactional save function.
-- Assumes public.locations.id is bigint-compatible, based on the app's numeric location IDs.

begin;

create table if not exists public.payroll_batches (
  id uuid primary key default gen_random_uuid(),
  pay_date date not null,
  week_start date not null,
  week_end date not null,
  location_id bigint not null references public.locations(id) on delete restrict,
  location_name text not null,
  prepared_by text,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint payroll_week_dates_valid check (week_end >= week_start)
);

create index if not exists payroll_batches_pay_date_idx
  on public.payroll_batches(pay_date);
create index if not exists payroll_batches_location_pay_date_idx
  on public.payroll_batches(location_id, pay_date);

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payroll_batches(id) on delete cascade,
  employee_no integer not null check (employee_no > 0),
  employee_name text not null check (length(trim(employee_name)) > 0),
  designation text not null default '',
  daily_rate numeric(12,2) not null check (daily_rate >= 0),
  days_worked numeric(5,2) not null check (days_worked >= 0 and days_worked <= 31),
  total_pay numeric(12,2) not null check (total_pay >= 0),
  overtime_hours numeric(7,2) not null default 0 check (overtime_hours >= 0),
  overtime_total numeric(12,2) not null check (overtime_total >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists payroll_records_batch_id_idx
  on public.payroll_records(batch_id);

alter table public.payroll_batches enable row level security;
alter table public.payroll_records enable row level security;

-- No direct client table policies are created. Browser clients must use the
-- authenticated, Admin-verified API; service-role server code bypasses RLS.

create or replace function public.save_payroll_batch(
  p_pay_date date,
  p_week_start date,
  p_week_end date,
  p_location_id bigint,
  p_location_name text,
  p_prepared_by text,
  p_notes text,
  p_created_by text,
  p_records jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid;
  v_record jsonb;
begin
  if p_week_end < p_week_start then
    raise exception 'Payroll week end must not be before week start';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) < 1 or jsonb_array_length(p_records) > 500 then
    raise exception 'Payroll must contain between 1 and 500 employee rows';
  end if;

  insert into public.payroll_batches
    (pay_date, week_start, week_end, location_id, location_name, prepared_by, notes, created_by)
  values
    (p_pay_date, p_week_start, p_week_end, p_location_id, p_location_name, p_prepared_by, p_notes, p_created_by)
  returning id into v_batch_id;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    insert into public.payroll_records
      (batch_id, employee_no, employee_name, designation, daily_rate, days_worked,
       total_pay, overtime_hours, overtime_total, net_amount)
    values
      (v_batch_id,
       (v_record->>'employee_no')::integer,
       trim(v_record->>'employee_name'),
       coalesce(v_record->>'designation', ''),
       (v_record->>'daily_rate')::numeric,
       (v_record->>'days_worked')::numeric,
       (v_record->>'total_pay')::numeric,
       (v_record->>'overtime_hours')::numeric,
       (v_record->>'overtime_total')::numeric,
       (v_record->>'net_amount')::numeric);
  end loop;

  return v_batch_id;
end;
$$;

revoke all on function public.save_payroll_batch(date,date,date,bigint,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_payroll_batch(date,date,date,bigint,text,text,text,text,jsonb) to service_role;

commit;
