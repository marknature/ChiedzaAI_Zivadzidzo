-- 0007_report_access_hardening.sql
-- Report rows point to signed decision-support artifacts. Keep both the record and
-- its signed URL discovery limited to institution leadership, including direct
-- PostgREST access outside the Express route guard.

drop policy if exists "reports_select_non_ministry" on public.reports;
drop policy if exists "reports_write" on public.reports;

create policy "reports_select_leadership" on public.reports
  for select using (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  );

create policy "reports_insert_leadership" on public.reports
  for insert with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
  );
