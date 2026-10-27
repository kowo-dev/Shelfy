alter table users alter column username type varchar(320);

alter table follows add column ap_id text unique;

create table ap_follow_requests (
    follower_id uuid not null references users (id) on delete cascade,
    followed_id uuid not null references users (id) on delete cascade,
    ap_id text not null unique,
    created_at timestamptz not null default now(),
    primary key (follower_id, followed_id)
);

create index idx_ap_follow_requests_followed on ap_follow_requests (followed_id);

create table ap_deliveries (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid references users (id) on delete cascade,
    inbox text not null,
    payload text not null,
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error text,
    created_at timestamptz not null default now()
);

create index idx_ap_deliveries_due on ap_deliveries (next_attempt_at);

create table ap_inbox_seen (
    activity_id text primary key,
    seen_at timestamptz not null default now()
);

create index idx_ap_inbox_seen_at on ap_inbox_seen (seen_at);
