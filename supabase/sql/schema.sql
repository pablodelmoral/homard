-- Limitless + Assistant schema

-- Daily summaries
create table if not exists public.limitless_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null,
  summary text not null,
  highlights jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(summary_date)
);

-- Action items extracted from summaries
create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  summary_date date,
  title text not null,
  details text,
  status text default 'todo', -- todo | doing | done
  priority text default 'medium', -- low | medium | high
  source text default 'limitless',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kanban board columns
create table if not exists public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null,
  created_at timestamptz default now()
);

insert into public.kanban_columns (name, position)
values ('Todo', 1), ('Doing', 2), ('Done', 3)
on conflict do nothing;

-- Map items to columns
create table if not exists public.kanban_items (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid references public.action_items(id) on delete cascade,
  column_id uuid references public.kanban_columns(id) on delete cascade,
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Simple RLS setup (adjust later for auth)
-- (no raw lifelog table)
alter table public.limitless_summaries enable row level security;
alter table public.action_items enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.kanban_items enable row level security;

-- (no lifelog read policy)
create policy "read all" on public.limitless_summaries for select using (true);
create policy "read all" on public.action_items for select using (true);
create policy "read all" on public.kanban_columns for select using (true);
create policy "read all" on public.kanban_items for select using (true);
