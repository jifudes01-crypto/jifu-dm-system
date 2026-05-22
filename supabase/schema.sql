create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'sales' check (role in ('admin','sales')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default '',
  image_url text not null,
  image_path text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text default '',
  company text default '',
  phone text default '',
  address text default '',
  email text default '',
  line_id text default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_settings (
  id int primary key default 1 check (id = 1),
  font_family text not null default 'Noto Sans TC, Arial, sans-serif',
  font_size numeric not null default 28,
  font_weight numeric not null default 700,
  color text not null default '#111111',
  line_height numeric not null default 1.35,
  letter_spacing numeric not null default 0,
  contact_x numeric not null default 72,
  contact_y numeric not null default 1190,
  photo_x numeric not null default 760,
  photo_y numeric not null default 980,
  photo_w numeric not null default 210,
  photo_h numeric not null default 250,
  qr_x numeric not null default 790,
  qr_y numeric not null default 1245,
  qr_w numeric not null default 170,
  qr_h numeric not null default 170,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.design_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ begin
  create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger set_dm_items_updated_at before update on public.dm_items for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger set_contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger set_design_settings_updated_at before update on public.design_settings for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'sales')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active = true);
$$;

alter table public.profiles enable row level security;
alter table public.dm_items enable row level security;
alter table public.contacts enable row level security;
alter table public.design_settings enable row level security;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists dm_public_read_published on public.dm_items;
create policy dm_public_read_published on public.dm_items for select using (is_published = true or public.is_admin());
drop policy if exists dm_admin_insert on public.dm_items;
create policy dm_admin_insert on public.dm_items for insert with check (public.is_admin());
drop policy if exists dm_admin_update on public.dm_items;
create policy dm_admin_update on public.dm_items for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists dm_admin_delete on public.dm_items;
create policy dm_admin_delete on public.dm_items for delete using (public.is_admin());

drop policy if exists contacts_read_active on public.contacts;
create policy contacts_read_active on public.contacts for select using (is_active = true or public.is_admin());
drop policy if exists contacts_admin_insert on public.contacts;
create policy contacts_admin_insert on public.contacts for insert with check (public.is_admin());
drop policy if exists contacts_admin_update on public.contacts;
create policy contacts_admin_update on public.contacts for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists contacts_admin_delete on public.contacts;
create policy contacts_admin_delete on public.contacts for delete using (public.is_admin());

drop policy if exists settings_read_authenticated on public.design_settings;
create policy settings_read_authenticated on public.design_settings for select using (auth.role() = 'authenticated');
drop policy if exists settings_admin_write on public.design_settings;
create policy settings_admin_write on public.design_settings for all using (public.is_admin()) with check (public.is_admin());

-- Storage bucket: dm-assets must be created in Supabase Storage first, public = true.
drop policy if exists storage_read_dm_assets on storage.objects;
create policy storage_read_dm_assets on storage.objects for select using (bucket_id = 'dm-assets');
drop policy if exists storage_admin_upload_dm_assets on storage.objects;
create policy storage_admin_upload_dm_assets on storage.objects for insert with check (bucket_id = 'dm-assets' and public.is_admin());
drop policy if exists storage_admin_update_dm_assets on storage.objects;
create policy storage_admin_update_dm_assets on storage.objects for update using (bucket_id = 'dm-assets' and public.is_admin()) with check (bucket_id = 'dm-assets' and public.is_admin());
drop policy if exists storage_admin_delete_dm_assets on storage.objects;
create policy storage_admin_delete_dm_assets on storage.objects for delete using (bucket_id = 'dm-assets' and public.is_admin());
