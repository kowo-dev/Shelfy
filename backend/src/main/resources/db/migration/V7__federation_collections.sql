create table ap_published_objects (
    object_id uuid primary key,
    published_at timestamptz not null default now()
);

create table ap_remote_collections (
    ap_id text primary key,
    kind varchar(10) not null check (kind in ('LIST', 'POOL')),
    local_id uuid not null unique,
    user_id uuid not null references users (id) on delete cascade
);

create index idx_ap_remote_collections_user on ap_remote_collections (user_id);
