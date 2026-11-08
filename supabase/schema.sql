-- Full schema for a new Supabase project. Apply once; not yet validated remotely.
-- Enable anonymous sign-ins separately in Supabase Auth settings.
-- Anonymous Supabase users use the authenticated database role.

begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'in_review', 'done')),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  description text not null default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date
);

create index tasks_user_created_idx on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "Guests can read their own tasks"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Guests can create their own tasks"
  on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Guests can update their own tasks"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Guests can delete their own tasks"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- Team members, labels, comments, and task relationships.
begin;

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  color text not null default '#7e6bc4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index team_members_owner_name_idx on public.team_members (user_id, lower(name));

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  color text not null default '#7e6bc4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index labels_owner_name_idx on public.labels (user_id, lower(name));

alter table public.tasks
  add column if not exists description text not null default '',
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  add column if not exists due_date date,
  add column if not exists assignee_id uuid;
alter table public.tasks add constraint tasks_id_owner_unique unique (id, user_id);
-- The primary assignee is the first selected member. All assignees are in task_assignees.
alter table public.tasks add constraint tasks_assignee_owner_fk
  foreign key (assignee_id, user_id) references public.team_members (id, user_id);
create index tasks_due_idx on public.tasks (user_id, due_date) where status <> 'done';

create table public.task_assignees (
  task_id uuid not null,
  member_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (task_id, member_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (member_id, user_id) references public.team_members (id, user_id) on delete cascade
);
create index task_assignees_owner_idx on public.task_assignees (user_id);

create table public.task_labels (
  task_id uuid not null,
  label_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (task_id, label_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (label_id, user_id) references public.labels (id, user_id) on delete cascade
);
create index task_labels_owner_idx on public.task_labels (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index comments_task_time_idx on public.comments (user_id, task_id, created_at, id);

-- Each new table is private to its guest. Composite FKs also prevent linking
-- another guest's task, member, or label, even through a direct Data API request.
do $$
declare table_name text;
begin
  foreach table_name in array array['team_members', 'labels', 'task_assignees', 'task_labels', 'comments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy "Owner access" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
  end loop;
end;
$$;

-- Save task fields and both many-to-many selections in a single transaction.
-- SECURITY INVOKER preserves the caller's RLS permissions.
create or replace function public.save_task(p_task jsonb, p_assignee_ids uuid[], p_label_ids uuid[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  task_uuid uuid := coalesce((p_task->>'id')::uuid, gen_random_uuid());
  owner_uuid uuid := auth.uid();
  member_ids uuid[] := coalesce(p_assignee_ids, '{}'::uuid[]);
  label_ids uuid[] := coalesce(p_label_ids, '{}'::uuid[]);
begin
  if owner_uuid is null then raise exception 'A guest session is required'; end if;
  if length(btrim(coalesce(p_task->>'title', ''))) not between 1 and 500 then raise exception 'Task name must contain 1 to 500 characters'; end if;
  if length(coalesce(p_task->>'description', '')) > 10000 then raise exception 'Description is too long'; end if;
  if exists (select 1 from unnest(member_ids) as requested(id) where not exists (select 1 from public.team_members m where m.id = requested.id and m.user_id = owner_uuid)) then raise exception 'Invalid assignee'; end if;
  if exists (select 1 from unnest(label_ids) as requested(id) where not exists (select 1 from public.labels l where l.id = requested.id and l.user_id = owner_uuid)) then raise exception 'Invalid label'; end if;

  if exists (select 1 from public.tasks where id = task_uuid and user_id = owner_uuid) then
    -- Serialize concurrent saves to keep the task and join selections consistent.
    perform 1 from public.tasks where id = task_uuid and user_id = owner_uuid for update;
    update public.tasks set title = btrim(p_task->>'title'), status = p_task->>'status',
      description = coalesce(p_task->>'description', ''), priority = coalesce(p_task->>'priority', 'normal'),
      due_date = nullif(p_task->>'due_date', '')::date, assignee_id = member_ids[1]
    where id = task_uuid and user_id = owner_uuid;
  else
    insert into public.tasks (id, user_id, title, status, description, priority, due_date, assignee_id)
    values (task_uuid, owner_uuid, btrim(p_task->>'title'), p_task->>'status',
      coalesce(p_task->>'description', ''), coalesce(p_task->>'priority', 'normal'), nullif(p_task->>'due_date', '')::date, member_ids[1]);
  end if;

  delete from public.task_assignees where task_id = task_uuid and user_id = owner_uuid;
  insert into public.task_assignees (task_id, member_id, user_id)
    select task_uuid, id, owner_uuid from (select distinct unnest(member_ids) as id) selected;
  delete from public.task_labels where task_id = task_uuid and user_id = owner_uuid;
  insert into public.task_labels (task_id, label_id, user_id)
    select task_uuid, id, owner_uuid from (select distinct unnest(label_ids) as id) selected;
  return task_uuid;
end;
$$;
revoke all on function public.save_task(jsonb, uuid[], uuid[]) from public, anon;
grant execute on function public.save_task(jsonb, uuid[], uuid[]) to authenticated;

commit;
