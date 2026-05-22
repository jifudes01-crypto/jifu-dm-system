-- 吉富 DM 雲端正式版 Supabase SQL
-- 執行位置：Supabase > SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.dm_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default '已排版DM',
  image_url text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text default '',
  phone text default '',
  company text default '',
  address text default '',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into public.app_settings(key, value)
values (
  'contact_box',
  '{
    "x":950,
    "y":58,
    "w":452,
    "h":142,
    "nameSize":34,
    "titleSize":24,
    "phoneSize":26,
    "companySize":18,
    "nameGap":8,
    "subGap":8,
    "paddingX":18,
    "paddingY":8,
    "fontFamily":"Microsoft JhengHei",
    "fontWeight":"bold",
    "color":"#000000",
    "bgEnabled":false,
    "photoX":1268,
    "photoY":68,
    "photoSize":118,
    "qrX":1268,
    "qrY":68,
    "qrSize":118
  }'::jsonb
)
on conflict (key) do nothing;

create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  detail text default '',
  created_at timestamptz default now()
);

alter table public.dm_items enable row level security;
alter table public.contacts enable row level security;
alter table public.app_settings enable row level security;
alter table public.access_logs enable row level security;

drop policy if exists "Public can read active dm" on public.dm_items;
create policy "Public can read active dm"
on public.dm_items for select
using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage dm" on public.dm_items;
create policy "Authenticated can manage dm"
on public.dm_items for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active contacts" on public.contacts;
create policy "Public can read active contacts"
on public.contacts for select
using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage contacts" on public.contacts;
create policy "Authenticated can manage contacts"
on public.contacts for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read settings" on public.app_settings;
create policy "Public can read settings"
on public.app_settings for select
using (true);

drop policy if exists "Authenticated can manage settings" on public.app_settings;
create policy "Authenticated can manage settings"
on public.app_settings for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can insert logs" on public.access_logs;
create policy "Public can insert logs"
on public.access_logs for insert
with check (true);

drop policy if exists "Authenticated can read logs" on public.access_logs;
create policy "Authenticated can read logs"
on public.access_logs for select
to authenticated
using (true);

-- Storage 設定：
-- 到 Storage 建立 public bucket：dm-assets
-- bucket 名稱必須是 dm-assets
-- 並設定 public bucket。
-- 如果要用 SQL 建立，可嘗試：
insert into storage.buckets (id, name, public)
values ('dm-assets', 'dm-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public can read dm assets" on storage.objects;
create policy "Public can read dm assets"
on storage.objects for select
using (bucket_id = 'dm-assets');

drop policy if exists "Authenticated can upload dm assets" on storage.objects;
create policy "Authenticated can upload dm assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'dm-assets');

drop policy if exists "Authenticated can update dm assets" on storage.objects;
create policy "Authenticated can update dm assets"
on storage.objects for update
to authenticated
using (bucket_id = 'dm-assets')
with check (bucket_id = 'dm-assets');

drop policy if exists "Authenticated can delete dm assets" on storage.objects;
create policy "Authenticated can delete dm assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'dm-assets');
