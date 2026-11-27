-- Sabi AI (SmartStore) Supabase PostgreSQL Schema
-- Run this once in your Supabase Dashboard -> SQL Editor

create table if not exists public.app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shops (
  id text primary key,
  owner_user_id text references public.app_users(id) on delete set null,
  is_demo boolean not null default false,
  name text not null,
  location text not null,
  category text not null default 'Supermarket & Provisions',
  whatsapp_number text not null,
  whatsapp_phone_number_id text,
  whatsapp_connected boolean not null default true,
  plan_id text not null default 'starter',
  created_at timestamptz not null default now()
);

create index if not exists idx_shops_owner on public.shops(owner_user_id);
create index if not exists idx_shops_phone_number_id on public.shops(whatsapp_phone_number_id);

create table if not exists public.products (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  name text not null,
  pack_size text not null,
  sku text not null,
  category text not null default 'General',
  cost_price numeric not null default 0,
  selling_price numeric not null default 0,
  previous_selling_price numeric,
  last_price_update_at timestamptz not null default now(),
  supplier_name text not null default 'General Distributor',
  stock_quantity integer not null default 0,
  unit text not null default 'units',
  reorder_level integer not null default 5,
  expiry_date text,
  price_review_flag boolean not null default false,
  price_review_reason text,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'Owner'
);

create index if not exists idx_products_shop on public.products(shop_id);

create table if not exists public.staff (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  name text not null,
  phone text not null,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_shop on public.staff(shop_id);

create table if not exists public.purchases (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  supplier_name text not null,
  quantity integer not null,
  unit text not null,
  unit_cost numeric not null,
  previous_cost_price numeric not null,
  total_cost numeric not null,
  cost_increased boolean not null default false,
  note text,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchases_shop on public.purchases(shop_id);

create table if not exists public.stock_losses (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  loss_type text not null,
  quantity integer not null,
  unit text not null,
  unit_cost numeric not null,
  estimated_loss_value numeric not null,
  reason text not null,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_losses_shop on public.stock_losses(shop_id);

create table if not exists public.staff_notifications (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  actor_name text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_shop on public.staff_notifications(shop_id);

create table if not exists public.activities (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  type text not null,
  actor_name text not null,
  actor_role text not null,
  actor_phone text,
  product_id text,
  product_name text,
  summary text not null,
  detail text,
  channel text not null default 'dashboard',
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_shop on public.activities(shop_id);

create table if not exists public.waitlist (
  id text primary key,
  full_name text not null,
  shop_name text not null,
  city text not null,
  email text not null default '',
  whatsapp_number text not null default '',
  store_category text not null default 'Supermarket',
  staff_count_range text not null default '1-3',
  created_at timestamptz not null default now()
);

create table if not exists public.processed_messages (
  message_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_threads (
  thread_key text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  phone text not null,
  history jsonb not null default '[]'::jsonb,
  pending_confirmation jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security with no public anon policies.
-- All server queries run through our backend API using SUPABASE_SERVICE_ROLE_KEY.
alter table public.app_users enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.staff enable row level security;
alter table public.purchases enable row level security;
alter table public.stock_losses enable row level security;
alter table public.staff_notifications enable row level security;
alter table public.activities enable row level security;
alter table public.waitlist enable row level security;
alter table public.processed_messages enable row level security;
alter table public.whatsapp_threads enable row level security;
