-- Вмикаємо RLS для всіх необхідних таблиць
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.group_types enable row level security;
alter table public.groups enable row level security;
alter table public.items enable row level security;
alter table public.content_entries enable row level security;

-- Політики для profiles
-- Користувачі можуть бачити та редагувати лише свій власний профіль
create policy "Allow individual access to own profile" on public.profiles
for all using (auth.uid() = id);

-- Політики для organizations
-- Користувачі можуть бачити організації, членами яких вони є
create policy "Allow read access for members" on public.organizations for select
using (exists (select 1 from organization_members m where m.organization_id = organizations.id and m.user_id = auth.uid()));

-- Політики для organization_members
-- Користувачі можуть бачити інших членів своєї організації
create policy "Allow read access for members" on public.organization_members for select
using (exists (select 1 from organization_members m where m.organization_id = organization_members.organization_id and m.user_id = auth.uid()));

-- Політики для group_types
create policy "Allow read access for members" on public.group_types for select
using (exists (select 1 from organization_members m where m.organization_id = group_types.organization_id and m.user_id = auth.uid()));
create policy "Allow write access for editors" on public.group_types for insert
with check (exists (select 1 from organization_members m where m.organization_id = group_types.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));
create policy "Allow update for editors" on public.group_types for update
using (exists (select 1 from organization_members m where m.organization_id = group_types.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));

-- Політики для groups
create policy "Allow read access for members" on public.groups for select
using (exists (select 1 from organization_members m where m.organization_id = groups.organization_id and m.user_id = auth.uid()));
create policy "Allow write access for editors" on public.groups for insert
with check (exists (select 1 from organization_members m where m.organization_id = groups.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));
create policy "Allow update for editors" on public.groups for update
using (exists (select 1 from organization_members m where m.organization_id = groups.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));

-- Політики для items
create policy "Allow read access for members" on public.items for select
using (exists (select 1 from organization_members m where m.organization_id = items.organization_id and m.user_id = auth.uid()));
create policy "Allow write access for editors" on public.items for insert
with check (exists (select 1 from organization_members m where m.organization_id = items.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));
create policy "Allow update for editors" on public.items for update
using (exists (select 1 from organization_members m where m.organization_id = items.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));

-- Політики для content_entries
create policy "Allow read access for members" on public.content_entries for select
using (exists (select 1 from organization_members m where m.organization_id = content_entries.organization_id and m.user_id = auth.uid()));
create policy "Allow write access for editors" on public.content_entries for insert
with check (exists (select 1 from organization_members m where m.organization_id = content_entries.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));
create policy "Allow update for editors" on public.content_entries for update
using (exists (select 1 from organization_members m where m.organization_id = content_entries.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','editor')));