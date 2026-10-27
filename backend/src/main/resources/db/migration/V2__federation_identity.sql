alter table users add column domain varchar(255);
alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;
alter table users add constraint users_local_credentials
    check (domain is not null or (email is not null and password_hash is not null));

drop index users_username_lower_key;
create unique index users_username_lower_key on users (lower(username), coalesce(lower(domain), ''));
create index idx_users_domain on users (lower(domain)) where domain is not null;

create table ap_actors (
    user_id uuid primary key references users (id) on delete cascade,
    actor_uri text unique,
    inbox text,
    shared_inbox text,
    outbox text,
    followers_uri text,
    following_uri text,
    profile_url text,
    avatar_url text,
    public_key_id text not null,
    public_key_pem text not null,
    private_key_pem text,
    fetched_at timestamptz,
    created_at timestamptz not null default now(),
    constraint ap_actors_remote_or_local check (
        (actor_uri is null and private_key_pem is not null)
        or (actor_uri is not null and inbox is not null and private_key_pem is null)
    )
);

create table ap_instance_keys (
    id smallint primary key check (id = 1),
    public_key_pem text not null,
    private_key_pem text not null,
    created_at timestamptz not null default now()
);

create table domain_blocks (
    domain varchar(255) primary key,
    reason text,
    created_at timestamptz not null default now()
);

create table domain_allows (
    domain varchar(255) primary key,
    created_at timestamptz not null default now()
);
