-- REVIEW ONLY. DO NOT RUN AGAINST PRODUCTION UNTIL REVIEWED AND APPROVED.
-- Adds transactional editing for existing payroll batches.
-- Existing save_payroll_batch function and original migration remain unchanged.

begin;

create or replace function public.update_payroll_batch(
  p_batch_id uuid,
  p_pay_date date,
  p_week_start date,
  p_week_end date,
  p_location_id bigint,
  p_location_name text,
  p_prepared_by text,
  p_notes text,
  p_records jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record jsonb;
  v_record_id uuid;
  v_kept_ids uuid[] := '{}'::uuid[];
  v_batch_id uuid;
  v_rows integer;
begin
  if p_week_end < p_week_start then
    raise exception 'Payroll week end must not be before week start';
  end if;

  if p_records is null
     or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) < 1
     or jsonb_array_length(p_records) > 500 then
    raise exception 'Payroll must contain between 1 and 500 employee rows';
  end if;

  -- Lock the batch so simultaneous edits cannot overwrite each other.
  select id
    into v_batch_id
    from public.payroll_batches
   where id = p_batch_id
   for update;

  if v_batch_id is null then
    raise exception 'Payroll batch not found';
  end if;

  update public.payroll_batches
     set pay_date = p_pay_date,
         week_start = p_week_start,
         week_end = p_week_end,
         location_id = p_location_id,
         location_name = p_location_name,
         prepared_by = p_prepared_by,
         notes = p_notes
   where id = p_batch_id;

  for v_record in
    select value from jsonb_array_elements(p_records)
  loop
    v_record_id := nullif(trim(v_record->>'id'), '')::uuid;

    if v_record_id is not null then
      if v_record_id = any(v_kept_ids) then
        raise exception 'Duplicate payroll record ID in request';
      end if;

      update public.payroll_records
         set employee_no = (v_record->>'employee_no')::integer,
             employee_name = trim(v_record->>'employee_name'),
             designation = coalesce(v_record->>'designation', ''),
             daily_rate = (v_record->>'daily_rate')::numeric,
             days_worked = (v_record->>'days_worked')::numeric,
             total_pay = (v_record->>'total_pay')::numeric,
             overtime_hours = (v_record->>'overtime_hours')::numeric,
             overtime_total = (v_record->>'overtime_total')::numeric,
             net_amount = (v_record->>'net_amount')::numeric
       where id = v_record_id
         and batch_id = p_batch_id;

      get diagnostics v_rows = row_count;

      if v_rows <> 1 then
        raise exception 'Payroll record does not belong to this batch';
      end if;

      v_kept_ids := array_append(v_kept_ids, v_record_id);
    else
      insert into public.payroll_records (
        batch_id,
        employee_no,
        employee_name,
        designation,
        daily_rate,
        days_worked,
        total_pay,
        overtime_hours,
        overtime_total,
        net_amount
      )
      values (
        p_batch_id,
        (v_record->>'employee_no')::integer,
        trim(v_record->>'employee_name'),
        coalesce(v_record->>'designation', ''),
        (v_record->>'daily_rate')::numeric,
        (v_record->>'days_worked')::numeric,
        (v_record->>'total_pay')::numeric,
        (v_record->>'overtime_hours')::numeric,
        (v_record->>'overtime_total')::numeric,
        (v_record->>'net_amount')::numeric
      )
      returning id into v_record_id;

      v_kept_ids := array_append(v_kept_ids, v_record_id);
    end if;
  end loop;

  -- Remove only employee rows omitted from this edited batch.
  delete from public.payroll_records
   where batch_id = p_batch_id
     and not (id = any(v_kept_ids));

  return p_batch_id;
end;
$$;

revoke all on function public.update_payroll_batch(
  uuid, date, date, date, bigint, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.update_payroll_batch(
  uuid, date, date, date, bigint, text, text, text, jsonb
) to service_role;

commit;
