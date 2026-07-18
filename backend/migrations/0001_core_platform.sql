-- 0001_core_platform.sql
-- Adds the multi-tenant platform schema on top of the original demo `audits` table
-- (0000_initial_audits.sql). Every table is institution-scoped and RLS-enabled from
-- creation, per ZivaDzidzo's build spec: no table goes live without its policy attached
-- in the same migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Institutions: top-level tenant boundary. v1 runs single-institution, but the
-- FK + RLS shape stays multi-tenant-ready so a second school is not a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  school_type text check (school_type in ('primary','secondary','combined','tertiary')),
  created_at timestamptz not null default now()
);

-- Users linked to Supabase auth.users, scoped to one institution + role.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  full_name text,
  role text not null default 'teacher' check (role in ('admin','head_teacher','teacher','ministry_viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  grade_level text
);

-- Teacher roster. Raw features feed the Teacher Roles predict head server-side.
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  full_name text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  years_experience numeric,
  ai_tool_usage_frequency text check (ai_tool_usage_frequency in ('never','rarely','sometimes','often','daily')),
  digital_skills_score numeric check (digital_skills_score between 0 and 100),
  training_hours numeric,
  last_assessed_at timestamptz
);

-- All three task heads land here, discriminated by task_type. Never stores
-- individually-identifiable student data (learning_outcomes is cohort/subject only).
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  task_type text not null check (task_type in ('learning_outcomes','teacher_roles','curriculum_skills')),
  target_ref_id uuid,
  input_features jsonb not null,
  prediction jsonb not null,
  rationale jsonb,
  confidence numeric check (confidence between 0 and 1),
  model_version text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by uuid references public.profiles(id),
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  report_type text not null check (report_type in ('predict_report','chat_report')),
  storage_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Cost Monitoring: 6 categories. `source='auto_llm'` rows are inserted by the
-- backend on every OpenAI completion call; the rest are manual entries.
create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  category text not null check (category in ('model','human','maintenance','licence','hardware','other')),
  amount numeric not null,
  currency text not null default 'USD',
  note text,
  source text not null default 'manual' check (source in ('manual','auto_llm')),
  related_prediction_id uuid references public.predictions(id) on delete set null,
  created_by uuid references public.profiles(id),
  incurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_predictions_institution_task_created
  on public.predictions (institution_id, task_type, created_at desc);
create index if not exists idx_cost_entries_institution_created
  on public.cost_entries (institution_id, incurred_at desc);
create index if not exists idx_chat_messages_session
  on public.chat_messages (session_id, created_at);
create index if not exists idx_teachers_institution
  on public.teachers (institution_id);
create index if not exists idx_subjects_department
  on public.subjects (department_id);
create index if not exists idx_departments_institution
  on public.departments (institution_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security. Every table filters on the caller's own institution via
-- their profiles row. Enabled in the same migration as table creation.
-- ---------------------------------------------------------------------------
alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.predictions enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reports enable row level security;
alter table public.cost_entries enable row level security;

-- institutions: a user may only read their own institution row.
create policy "institutions_select_own" on public.institutions
  for select using (
    id = (select institution_id from public.profiles where id = auth.uid())
  );

-- profiles: a user may read/update only their own profile row.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- Generic institution-isolation pattern, repeated per tenant-scoped table.
create policy "departments_select" on public.departments
  for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "departments_write" on public.departments
  for insert with check (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "departments_update" on public.departments
  for update using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

create policy "subjects_select" on public.subjects
  for select using (
    department_id in (select id from public.departments where institution_id = (select institution_id from public.profiles where id = auth.uid()))
  );
create policy "subjects_write" on public.subjects
  for insert with check (
    department_id in (select id from public.departments where institution_id = (select institution_id from public.profiles where id = auth.uid()))
  );

create policy "teachers_select" on public.teachers
  for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "teachers_write" on public.teachers
  for insert with check (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "teachers_update" on public.teachers
  for update using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

-- predictions: read is institution-scoped; write is role-gated to admin/head_teacher.
create policy "predictions_select" on public.predictions
  for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "predictions_write_role_gated" on public.predictions
  for insert with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin','head_teacher')
  );

create policy "chat_sessions_select" on public.chat_sessions
  for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "chat_sessions_write" on public.chat_sessions
  for insert with check (institution_id = (select institution_id from public.profiles where id = auth.uid()));

create policy "chat_messages_select" on public.chat_messages
  for select using (
    session_id in (select id from public.chat_sessions where institution_id = (select institution_id from public.profiles where id = auth.uid()))
  );
create policy "chat_messages_write" on public.chat_messages
  for insert with check (
    session_id in (select id from public.chat_sessions where institution_id = (select institution_id from public.profiles where id = auth.uid()))
  );

create policy "reports_select" on public.reports
  for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "reports_write" on public.reports
  for insert with check (institution_id = (select institution_id from public.profiles where id = auth.uid()));

-- cost_entries: read is institution-scoped; write is role-gated to admin/head_teacher
-- (auto_llm rows are inserted by the backend's service-role client, which bypasses RLS
-- by design for that one privileged path).
create policy "cost_entries_select" on public.cost_entries
  for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));
create policy "cost_entries_write_role_gated" on public.cost_entries
  for insert with check (
    institution_id = (select institution_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('admin','head_teacher')
  );

-- ---------------------------------------------------------------------------
-- Ministry viewer: read-only, aggregate-only. Never exposes raw teacher/student rows.
-- ---------------------------------------------------------------------------
create or replace view public.ministry_aggregate_view as
  select institution_id, task_type,
         avg(confidence) as avg_confidence,
         count(*) as n_predictions,
         date_trunc('month', created_at) as month
  from public.predictions
  group by institution_id, task_type, date_trunc('month', created_at);
