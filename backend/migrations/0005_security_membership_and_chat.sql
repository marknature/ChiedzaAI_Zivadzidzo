-- 0005_security_membership_and_chat.sql
-- Close privilege-escalation paths and make institution membership a trusted,
-- server/admin provisioned operation. Apply after 0004.

-- A signed-in user may still read their own profile, but may not assign their
-- institution, elevate their role, or create a profile through the public API.
-- The backend service-role client (and an eventual trusted invitation flow) performs
-- membership provisioning instead.
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Roster structure is leadership-owned. HTTP routes enforce the same rule, while
-- these policies prevent a caller from bypassing the backend through PostgREST.
drop policy if exists "departments_write" on public.departments;
drop policy if exists "departments_update" on public.departments;
create policy "departments_insert_leadership" on public.departments
  for insert with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  );
create policy "departments_update_leadership" on public.departments
  for update using (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  ) with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
  );

drop policy if exists "subjects_write" on public.subjects;
create policy "subjects_insert_leadership" on public.subjects
  for insert with check (
    department_id in (
      select id from public.departments
      where institution_id = (select institution_id from public.profiles where id = auth.uid())
    )
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  );

drop policy if exists "teachers_write" on public.teachers;
drop policy if exists "teachers_update" on public.teachers;
create policy "teachers_insert_leadership" on public.teachers
  for insert with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  );
create policy "teachers_update_leadership" on public.teachers
  for update using (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  ) with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
  );

-- Conversations remain private to their creator, even inside the same institution.
-- Ministry viewers already have no access under 0003; this prevents lateral staff access.
drop policy if exists "chat_sessions_select" on public.chat_sessions;
drop policy if exists "chat_sessions_select_non_ministry" on public.chat_sessions;
drop policy if exists "chat_sessions_write" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select using (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
    and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
  );
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
    and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
  );

drop policy if exists "chat_messages_select" on public.chat_messages;
drop policy if exists "chat_messages_select_non_ministry" on public.chat_messages;
drop policy if exists "chat_messages_write" on public.chat_messages;
create policy "chat_messages_select_own_session" on public.chat_messages
  for select using (
    session_id in (
      select id from public.chat_sessions
      where institution_id = (select institution_id from public.profiles where id = auth.uid())
        and created_by = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
  );
create policy "chat_messages_insert_own_session" on public.chat_messages
  for insert with check (
    session_id in (
      select id from public.chat_sessions
      where institution_id = (select institution_id from public.profiles where id = auth.uid())
        and created_by = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
  );
