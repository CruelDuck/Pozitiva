-- Users/profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  role text default 'reader' check (role in ('reader','author','admin')),
  avatar_url text,
  created_at timestamptz default now()
);

-- Posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  excerpt text,
  content text,
  image_url text,
  author_id uuid references profiles(id) on delete set null,
  is_published boolean default false,
  featured boolean default false,
  created_at timestamptz default now(),
  published_at timestamptz
);

-- Categories
create table if not exists categories (
  id serial primary key,
  name text unique not null
);

-- Post <-> Categories (M:N)
create table if not exists post_categories (
  post_id uuid references posts(id) on delete cascade,
  category_id int references categories(id) on delete cascade,
  primary key (post_id, category_id)
);

-- Comments (threaded via parent_id)
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id) on delete set null,
  body text not null,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

-- Facts (nice facts for homepage random pick)
create table if not exists facts (
  id serial primary key,
  text text not null
);

-- Enable RLS
alter table profiles enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table post_categories enable row level security;
alter table categories enable row level security;
alter table facts enable row level security;

-- Policies
-- profiles
create policy "public profiles read" on profiles for select using (true);
create policy "user can update own profile" on profiles for update using (auth.uid() = id);

-- posts
create policy "published posts are readable" on posts for select using (
  is_published = true or author_id = auth.uid()
);
create policy "authors can insert their posts" on posts for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('author','admin')) and author_id = auth.uid()
);
create policy "authors can update own unpublished posts" on posts for update using (
  author_id = auth.uid() and is_published = false
);
create policy "admin can update any post" on posts for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "admin can delete any post" on posts for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- comments
create policy "comments readable to all" on comments for select using (is_hidden = false);
create policy "auth users insert comments" on comments for insert with check (auth.uid() = user_id);
create policy "author can update/delete own comment" on comments for update using (user_id = auth.uid());
create policy "author can delete own comment" on comments for delete using (user_id = auth.uid());
create policy "admin can moderate comments" on comments for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "admin can delete comments" on comments for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- categories & facts (readable to all)
create policy "public categories read" on categories for select using (true);
create policy "public facts read" on facts for select using (true);

-- helper: generate slug (optional, can be set from app)
