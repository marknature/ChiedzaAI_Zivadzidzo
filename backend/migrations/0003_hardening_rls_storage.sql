-- Phase 4: make ministry access aggregate-only and establish report storage.
-- Existing production policies are replaced explicitly so ministry viewers cannot read raw rows.

drop policy if exists "departments_select" on public.departments;
create policy "departments_select_non_ministry" on public.departments for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "subjects_select" on public.subjects;
create policy "subjects_select_non_ministry" on public.subjects for select using (
  department_id in (select id from public.departments where institution_id = (select institution_id from public.profiles where id = auth.uid()))
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "teachers_select" on public.teachers;
create policy "teachers_select_non_ministry" on public.teachers for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "predictions_select" on public.predictions;
create policy "predictions_select_non_ministry" on public.predictions for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "chat_sessions_select" on public.chat_sessions;
create policy "chat_sessions_select_non_ministry" on public.chat_sessions for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select_non_ministry" on public.chat_messages for select using (
  session_id in (select id from public.chat_sessions where institution_id = (select institution_id from public.profiles where id = auth.uid()))
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "reports_select" on public.reports;
create policy "reports_select_non_ministry" on public.reports for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
drop policy if exists "cost_entries_select" on public.cost_entries;
create policy "cost_entries_select_non_ministry" on public.cost_entries for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);

-- The view intentionally runs as its owner to aggregate predictions while direct raw
-- prediction reads remain denied to ministry users. The WHERE clause is caller-scoped.
create or replace view public.ministry_aggregate_view with (security_invoker = false) as
  select institution_id, task_type, avg(confidence) as avg_confidence, count(*) as n_predictions,
         date_trunc('month', created_at) as month
  from public.predictions
  where (select role from public.profiles where id = auth.uid()) = 'ministry_viewer'
    and institution_id = (select institution_id from public.profiles where id = auth.uid())
  group by institution_id, task_type, date_trunc('month', created_at);
revoke all on public.ministry_aggregate_view from anon;
grant select on public.ministry_aggregate_view to authenticated;

-- Private bucket. The API's service-role client writes and signs objects; clients do not
-- receive broad Storage access.
insert into storage.buckets (id, name, public) values ('reports', 'reports', false)
on conflict (id) do update set public = false;

drop policy if exists "push_tokens_write_own" on public.push_tokens;
create policy "push_tokens_insert_own" on public.push_tokens for insert with check (
  profile_id = auth.uid() and institution_id = (select institution_id from public.profiles where id = auth.uid())
);
create policy "push_tokens_update_own" on public.push_tokens for update using (
  profile_id = auth.uid() and institution_id = (select institution_id from public.profiles where id = auth.uid())
) with check (
  profile_id = auth.uid() and institution_id = (select institution_id from public.profiles where id = auth.uid())
);
