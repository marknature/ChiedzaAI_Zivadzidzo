create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade_level text,
  syllabus_text text not null,
  readiness_index numeric(5,1) not null,
  future_skills_score numeric(5,1) not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.audits enable row level security;

-- For a hackathon demo using the anon key. Replace with authenticated policies before production.
create policy "demo clients can insert audits"
  on public.audits for insert to anon with check (true);
