-- 1. Розширення та службові функції
create extension if not exists "uuid-ossp";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 2. Організації, користувачі, членство
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_set_updated_at before update on organizations for each row execute procedure set_updated_at();

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on profiles for each row execute procedure set_updated_at();

create type member_role as enum ('owner','admin','editor','viewer');
create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on organization_members(user_id);

-- 3. Ієрархія каталогу та товари
create table if not exists group_types (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index on group_types(organization_id);
create trigger group_types_set_updated_at before update on group_types for each row execute procedure set_updated_at();

create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type_id uuid not null references group_types(id) on delete restrict,
  parent_id uuid references groups(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on groups(organization_id);
create index on groups(parent_id);
create trigger groups_set_updated_at before update on groups for each row execute procedure set_updated_at();

create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  sku text not null,
  title text not null,
  attributes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);
create index on items(organization_id);
create index on items(group_id);
create trigger items_set_updated_at before update on items for each row execute procedure set_updated_at();

-- 4. Контент
create type content_status as enum ('draft','approved','published');
create table if not exists content_entries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  lang text not null check (char_length(lang) between 2 and 5),
  title text,
  description text,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, item_id, lang)
);
create index on content_entries(organization_id);
create index on content_entries(item_id);
create trigger content_entries_set_updated_at before update on content_entries for each row execute procedure set_updated_at();