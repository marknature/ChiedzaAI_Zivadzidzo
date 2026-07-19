-- Migrate the original curriculum-audit demo table into the same tenant/RLS model as
-- every other persisted record. The API now supplies these columns from the caller.
alter table public.audits add column if not exists institution_id uuid references public.institutions(id) on delete cascade;
alter table public.audits add column if not exists created_by uuid references public.profiles(id) on delete set null;
create index if not exists idx_audits_institution_created on public.audits (institution_id, created_at desc);

-- Existing demo rows are retained under the first seeded institution when one exists.
update public.audits set institution_id = (select id from public.institutions order by created_at limit 1) where institution_id is null;

drop policy if exists "demo clients can insert audits" on public.audits;
create policy "audits_select_non_ministry" on public.audits for select using (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) <> 'ministry_viewer'
);
create policy "audits_insert_own_institution" on public.audits for insert with check (
  institution_id = (select institution_id from public.profiles where id = auth.uid())
  and created_by = auth.uid()
  and (select role from public.profiles where id = auth.uid()) in ('admin', 'head_teacher')
);
