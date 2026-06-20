-- ─── Tennis Intelligence Vault ───
-- Player notes, tags, and custom tags for trader memory system

-- ─── Player Notes ───
create table if not exists player_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  player_name   text not null,
  content       text not null,
  form_status   text check (form_status in ('poor','mixed','strong','unknown')),
  priority      text not null default 'medium'
                check (priority in ('low','medium','high')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table player_notes enable row level security;

create policy "Users manage own notes"
  on player_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_player_notes_user on player_notes(user_id);
create index idx_player_notes_player on player_notes(user_id, player_name);
create index idx_player_notes_recent on player_notes(user_id, created_at desc);
create index idx_player_notes_priority on player_notes(user_id, priority, created_at desc);

-- ─── Note Tags (join table) ───
create table if not exists note_tags (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references player_notes(id) on delete cascade,
  tag           text not null,
  user_id       uuid not null references auth.users(id) on delete cascade
);

alter table note_tags enable row level security;

create policy "Users manage own tags"
  on note_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_note_tags_note on note_tags(note_id);
create index idx_note_tags_user_tag on note_tags(user_id, tag);

-- ─── Custom Tags ───
create table if not exists user_custom_tags (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  tag           text not null,
  created_at    timestamptz not null default now(),
  unique(user_id, tag)
);

alter table user_custom_tags enable row level security;

create policy "Users manage own custom tags"
  on user_custom_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
