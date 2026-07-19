-- Phase 3 import support and device-token persistence; all policies are defined here.
alter table public.departments add constraint departments_institution_name_unique unique (institution_id, name);
alter table public.subjects add constraint subjects_department_name_grade_unique unique nulls not distinct (department_id, name, grade_level);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "push_tokens_select_own" on public.push_tokens for select using (profile_id = auth.uid() and institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "push_tokens_write_own" on public.push_tokens for insert with check (profile_id = auth.uid() and institution_id = (select institution_id from public.profiles where id = auth.uid()));
