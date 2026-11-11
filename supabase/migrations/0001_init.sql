-- JARVIS v0.1 schema for Supabase / PostgreSQL.
--
-- The FastAPI backend also creates these tables automatically on first start
-- (SQLAlchemy create_all), so running this file is optional. It exists so the
-- schema is reviewable and so RLS is switched on explicitly.
--
-- Security model (v0.1): only the backend talks to the database, using the
-- connection string in DATABASE_URL. RLS is enabled with NO policies, which
-- means Supabase's public REST/GraphQL APIs (anon / authenticated keys) can
-- read and write nothing. When Supabase Auth is adopted (see ROADMAP.md),
-- policies of the form `user_id = auth.uid()::text` will be added.

create table if not exists tasks (
  id varchar(36) primary key,
  user_id varchar(64) not null,
  title varchar(500) not null,
  notes text not null default '',
  kind varchar(20) not null default 'daily',
  status varchar(20) not null default 'open',
  priority integer not null default 2,
  due_date varchar(10),
  estimate_minutes integer,
  actual_minutes integer,
  progress integer not null default 0,
  parent_id varchar(36),
  sort_order double precision not null default 0,
  source varchar(40) not null default 'user',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_tasks_user on tasks (user_id, status, kind);

create table if not exists memories (
  id varchar(36) primary key,
  user_id varchar(64) not null,
  layer varchar(32) not null,
  category varchar(64) not null default 'general',
  content text not null,
  kind varchar(16) not null default 'stated',
  source varchar(120) not null default 'user',
  provenance json not null default '{}',
  confidence double precision not null default 1.0,
  verification varchar(20) not null default 'unverified',
  status varchar(16) not null default 'active',
  relevance double precision not null default 0.5,
  is_temporary boolean not null default false,
  expires_at timestamptz,
  review_at timestamptz,
  tags json not null default '[]',
  related_ids json not null default '[]',
  supersedes_id varchar(36),
  superseded_by_id varchar(36),
  correction_history json not null default '[]',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_memories_user on memories (user_id, status, layer);

create table if not exists conversations (
  id varchar(36) primary key,
  user_id varchar(64) not null,
  title varchar(300) not null default 'New conversation',
  source varchar(40) not null default 'jarvis',
  mode varchar(20) not null default 'auto',
  meta json not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_conversations_user on conversations (user_id);

create table if not exists messages (
  id varchar(36) primary key,
  conversation_id varchar(36) not null references conversations (id) on delete cascade,
  role varchar(16) not null,
  content text not null,
  meta json not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists ix_messages_conversation on messages (conversation_id);

create table if not exists calendar_events (
  id varchar(36) primary key,
  user_id varchar(64) not null,
  title varchar(300) not null,
  start timestamptz not null,
  "end" timestamptz not null,
  all_day boolean not null default false,
  location varchar(300) not null default '',
  notes text not null default '',
  source varchar(40) not null default 'local',
  external_id varchar(200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_events_user on calendar_events (user_id, start);

create table if not exists user_settings (
  user_id varchar(64) not null,
  key varchar(80) not null,
  value json not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists feedback (
  id varchar(36) primary key,
  user_id varchar(64) not null,
  target_type varchar(32) not null,
  target_id varchar(36) not null,
  kind varchar(32) not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists action_log (
  id varchar(36) primary key,
  user_id varchar(64) not null,
  actor varchar(16) not null,
  skill varchar(80) not null,
  risk varchar(10) not null default 'low',
  status varchar(16) not null,
  summary text not null default '',
  input json not null default '{}',
  result json not null default '{}',
  error text not null default '',
  origin json not null default '{}',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ix_action_log_user on action_log (user_id, status);

create table if not exists devices (
  id varchar(64) primary key,
  user_id varchar(64) not null,
  name varchar(120) not null,
  platform varchar(40) not null,
  capabilities json not null default '[]',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

alter table tasks enable row level security;
alter table memories enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table calendar_events enable row level security;
alter table user_settings enable row level security;
alter table feedback enable row level security;
alter table action_log enable row level security;
alter table devices enable row level security;
