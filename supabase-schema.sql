-- ── USERS (extends Supabase auth.users) ──
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  institution text,
  role        text,
  credits     integer not null default 100,
  plan        text not null default 'free',
  created_at  timestamptz default now()
);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── MANUSCRIPTS ──
create table if not exists public.manuscripts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  title            text,
  original_filename text not null,
  file_url         text,
  word_count       integer,
  target_journal   text,
  status           text not null default 'uploaded',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── SERVICE JOBS ──
create table if not exists public.service_jobs (
  id               uuid primary key default gen_random_uuid(),
  manuscript_id    uuid references public.manuscripts(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  service_type     text not null,
  status           text not null default 'queued',
  credits_used     integer default 0,
  result_url       text,
  report_url       text,
  certificate_url  text,
  error_message    text,
  created_at       timestamptz default now(),
  completed_at     timestamptz
);

-- ── ROW LEVEL SECURITY ──
alter table public.profiles      enable row level security;
alter table public.manuscripts   enable row level security;
alter table public.service_jobs  enable row level security;

-- Profiles: users can only read/update their own
create policy "own profile" on public.profiles
  for all using (auth.uid() = id);

-- Manuscripts: users can only see their own
create policy "own manuscripts" on public.manuscripts
  for all using (auth.uid() = user_id);

-- Jobs: users can only see their own
create policy "own jobs" on public.service_jobs
  for all using (auth.uid() = user_id);
