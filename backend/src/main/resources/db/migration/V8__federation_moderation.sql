alter table ap_deliveries add column signing_key_id text;
alter table ap_deliveries add column signing_key_pem text;

create table ap_reports (
    id uuid primary key default gen_random_uuid(),
    activity_id text not null unique,
    reporter_id uuid references users (id) on delete set null,
    reporter_domain varchar(255) not null,
    target_user_id uuid references users (id) on delete cascade,
    object_uris text not null,
    content text,
    created_at timestamptz not null default now()
);

create index idx_ap_reports_created on ap_reports (created_at desc);
