-- 0006_atomic_roster_import.sql
-- Import validated roster rows inside one PostgreSQL transaction. The HTTP route first
-- performs file-level validation, then calls this function through the caller's JWT.
-- If any metadata or teacher insert fails, PostgreSQL rolls back the complete import.

create or replace function public.import_roster_rows(
  p_institution_id uuid,
  p_rows jsonb
)
returns table (teacher_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_member_institution_id uuid;
  v_role text;
  v_row jsonb;
  v_full_name text;
  v_department_name text;
  v_subject_name text;
  v_grade_level text;
  v_department_id uuid;
  v_subject_id uuid;
  v_last_assessed_at timestamptz;
begin
  select institution_id, role
    into v_member_institution_id, v_role
    from public.profiles
    where id = auth.uid();

  if v_member_institution_id is distinct from p_institution_id
    or v_role not in ('admin', 'head_teacher') then
    raise exception 'Only institution leadership may import a roster.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Roster import requires one or more validated rows.' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_full_name := nullif(trim(v_row ->> 'full_name'), '');
    v_department_name := nullif(trim(v_row ->> 'department_name'), '');
    v_subject_name := nullif(trim(v_row ->> 'subject_name'), '');
    v_grade_level := nullif(trim(v_row ->> 'grade_level'), '');
    v_last_assessed_at := coalesce(nullif(v_row ->> 'last_assessed_at', '')::timestamptz, now());

    if v_full_name is null then
      raise exception 'Each roster row requires full_name.' using errcode = '22023';
    end if;
    if (v_subject_name is null) <> (v_department_name is null) then
      raise exception 'A subject and department must be supplied together.' using errcode = '22023';
    end if;

    v_subject_id := null;
    if v_subject_name is not null then
      insert into public.departments (institution_id, name)
        values (p_institution_id, v_department_name)
        on conflict (institution_id, name) do nothing;
      select id into v_department_id
        from public.departments
        where institution_id = p_institution_id and name = v_department_name;

      insert into public.subjects (department_id, name, grade_level)
        values (v_department_id, v_subject_name, v_grade_level)
        on conflict (department_id, name, grade_level) do nothing;
      select id into v_subject_id
        from public.subjects
        where department_id = v_department_id
          and name = v_subject_name
          and grade_level is not distinct from v_grade_level;
    end if;

    insert into public.teachers (
      institution_id,
      full_name,
      subject_id,
      years_experience,
      ai_tool_usage_frequency,
      digital_skills_score,
      training_hours,
      last_assessed_at
    ) values (
      p_institution_id,
      v_full_name,
      v_subject_id,
      nullif(v_row ->> 'years_experience', '')::numeric,
      nullif(v_row ->> 'ai_tool_usage_frequency', ''),
      nullif(v_row ->> 'digital_skills_score', '')::numeric,
      nullif(v_row ->> 'training_hours', '')::numeric,
      v_last_assessed_at
    ) returning id into teacher_id;

    return next;
  end loop;
end;
$$;

revoke all on function public.import_roster_rows(uuid, jsonb) from public, anon;
grant execute on function public.import_roster_rows(uuid, jsonb) to authenticated;
