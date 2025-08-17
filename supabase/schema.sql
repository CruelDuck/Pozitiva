-- Rozšíření
create extension if not exists pgcrypto;

-- PROFILY
create table if not exists public.profiles (
  id uuid primary key default auth.uid(),
  email text,
  username text unique,
  display_name text,
  bio text,
  website text,
  avatar_url text,
  role text not null default 'reader',
  created_at timestamptz default now()
);

-- KATEGORIE
create table if not exists public.categories (
  id bigserial primary key,
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order int default 0
);

-- ČLÁNKY
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text unique,
  excerpt text,
  content text,
  image_url text,
  -- NOVÉ: metadata k obrázku (autorská práva)
  image_credit text,
  image_license text,
  image_source_url text,
  is_published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz default now(),
  published_at timestamptz
);

-- M:N kategorie
create table if not exists public.post_categories (
  post_id uuid references public.posts(id) on delete cascade,
  category_id bigint references public.categories(id) on delete cascade,
  primary key (post_id, category_id)
);

-- ZDROJE
create table if not exists public.post_sources (
  id bigserial primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  title text,
  url text not null
);

-- KOMENTÁŘE
create table if not exists public.comments (
  id bigserial primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  parent_id bigint references public.comments(id) on delete set null,
  content text not null,
  is_hidden boolean not null default false,
  created_at timestamptz default now()
);

-- NEWSLETTER
create table if not exists public.newsletter_subscribers (
  id bigserial primary key,
  email text not null unique,
  token text not null unique,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.newsletter_issues (
  id bigserial primary key,
  subject text not null,
  html text not null,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- RLS zapnout
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_categories enable row level security;
alter table public.categories enable row level security;
alter table public.post_sources enable row level security;
alter table public.comments enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_issues enable row level security;

-- POLICIES

-- Profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- Categories
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Posts
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select
  using (
    is_published
    or author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert
  with check (author_id = auth.uid());

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update
  using (
    (author_id = auth.uid() and not is_published)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    (author_id = auth.uid() and not is_published)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Post categories
drop policy if exists post_cats_select on public.post_categories;
create policy post_cats_select on public.post_categories for select using (true);

drop policy if exists post_cats_write on public.post_categories;
create policy post_cats_write on public.post_categories for all
  using (
    exists (
      select 1 from public.posts po
      where po.id = post_id
        and (po.author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))
    )
  )
  with check (
    exists (
      select 1 from public.posts po
      where po.id = post_id
        and (po.author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))
    )
  );

-- Post sources
drop policy if exists post_sources_select on public.post_sources;
create policy post_sources_select on public.post_sources for select using (true);

drop policy if exists post_sources_write on public.post_sources;
create policy post_sources_write on public.post_sources for all
  using (
    exists (
      select 1 from public.posts po
      where po.id = post_id
        and (po.author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))
    )
  )
  with check (
    exists (
      select 1 from public.posts po
      where po.id = post_id
        and (po.author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))
    )
  );

-- Comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select
  using (not is_hidden or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (user_id = auth.uid());

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'))
  with check (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin'));