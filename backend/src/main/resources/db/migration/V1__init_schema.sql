create extension if not exists pg_trgm;

create table users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) not null,
    username varchar(50) not null,
    password_hash varchar(255) not null,
    display_name varchar(50),
    bio varchar(500),
    profile_visibility varchar(20) not null default 'PUBLIC',
    allow_adult_content boolean not null default false,
    adult_content_confirmed_at timestamptz,
    email_verified boolean not null default false,
    steam_id varchar(32),
    steam_display_name varchar(100),
    steam_avatar_url text,
    steam_connected_at timestamp,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    profile_banner_url text,
    profile_banner_title varchar(500),
    profile_banner_provider varchar(50),
    profile_banner_source_url text,
    avatar_filename text,
    avatar_updated_at timestamptz,
    profile_banner_position integer
);

create unique index users_email_lower_key on users (lower(email));
create unique index users_username_lower_key on users (lower(username));
create unique index uq_users_steam_id on users (steam_id) where steam_id is not null;

create table refresh_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    token_hash varchar(255) not null unique,
    family_id uuid not null,
    revoked boolean not null default false,
    replaced boolean not null default false,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    replaced_at timestamptz
);

create index idx_refresh_tokens_user_id on refresh_tokens (user_id);
create index idx_refresh_tokens_family_id on refresh_tokens (family_id);

create table password_reset_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    token_hash varchar(255) not null unique,
    expires_at timestamptz not null,
    used boolean not null default false,
    created_at timestamptz not null default now()
);

create index idx_password_reset_tokens_user_id on password_reset_tokens (user_id);

create table email_verification_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    token_hash varchar(255) not null unique,
    expires_at timestamptz not null,
    used boolean not null default false,
    created_at timestamptz not null default now()
);

create index idx_email_verification_tokens_user_id on email_verification_tokens (user_id);

create table email_change_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    new_email varchar(255) not null,
    token_hash varchar(255) not null unique,
    expires_at timestamptz not null,
    used boolean not null default false,
    created_at timestamptz not null default now()
);

create index idx_email_change_tokens_user_id on email_change_tokens (user_id);

create table oauth_states (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    provider varchar(32) not null,
    state_hash varchar(64) not null unique,
    browser_token_hash varchar(64) not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

create table friendships (
    id uuid primary key,
    requester_id uuid not null references users (id) on delete cascade,
    addressee_id uuid not null references users (id) on delete cascade,
    status varchar(20) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint friendships_no_self_friend check (requester_id <> addressee_id)
);

create unique index idx_friendships_unique_pair
    on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index idx_friendships_requester on friendships (requester_id);
create index idx_friendships_addressee on friendships (addressee_id);

create table follows (
    follower_id uuid not null references users (id) on delete cascade,
    followed_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (follower_id, followed_id),
    constraint follows_no_self_follow check (follower_id <> followed_id)
);

create index idx_follows_followed_id on follows (followed_id);

create table canonical_works (
    id uuid primary key,
    media_type varchar(50) not null,
    created_at timestamptz not null default now()
);

create table canonical_work_references (
    id uuid primary key default gen_random_uuid(),
    canonical_work_id uuid not null references canonical_works (id) on delete cascade,
    provider varchar(50) not null,
    media_type varchar(50) not null,
    external_id varchar(255) not null,
    created_at timestamptz not null default now(),
    unique (provider, media_type, external_id)
);

create index idx_canonical_work_references_work_id on canonical_work_references (canonical_work_id);

create table media (
    id uuid primary key default gen_random_uuid(),
    external_id varchar(255) not null,
    provider varchar(50) not null,
    media_type varchar(50) not null,
    title varchar(500) not null,
    cover_url text,
    is_adult boolean not null default false,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    canonical_work_id uuid not null references canonical_works (id)
);

create unique index idx_media_external_provider_type on media (external_id, provider, media_type);
create index idx_media_media_type on media (media_type);
create index idx_media_canonical_work_id on media (canonical_work_id);
create index idx_media_title_trgm on media using gin (lower(title) gin_trgm_ops);

create table user_media (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    media_id uuid not null references media (id) on delete cascade,
    status varchar(50) not null,
    rating integer check (rating >= 0 and rating <= 10),
    progress jsonb not null default '{}',
    note jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    reviewed_at timestamptz,
    contains_spoilers boolean not null default false,
    unique (user_id, media_id)
);

create index idx_user_media_media_id on user_media (media_id);
create index idx_user_media_user_status_updated on user_media (user_id, status, updated_at desc);
create index idx_user_media_reviews_updated on user_media (updated_at desc) where note is not null;

create table user_media_episode (
    id uuid primary key default gen_random_uuid(),
    user_media_id uuid not null references user_media (id) on delete cascade,
    season integer not null check (season >= 0),
    episode integer not null check (episode >= 1),
    watched_at timestamptz not null default now(),
    rating integer check (rating >= 0 and rating <= 10),
    unique (user_media_id, season, episode)
);

create table watch_log (
    id uuid primary key default gen_random_uuid(),
    user_media_id uuid not null references user_media (id) on delete cascade,
    occurred_at date not null,
    is_repeat boolean not null default false,
    source varchar(50) not null default 'manual',
    created_at timestamptz not null default now(),
    rating integer check (rating >= 0 and rating <= 10),
    review jsonb,
    contains_spoilers boolean not null default false,
    name varchar(120)
);

create index idx_watch_log_user_media_id on watch_log (user_media_id);
create index idx_watch_log_occurred_at on watch_log (occurred_at);

create table user_activity (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    user_media_id uuid references user_media (id) on delete set null,
    activity_type varchar(40) not null,
    payload jsonb not null default '{}',
    created_at timestamptz not null default now()
);

create index idx_user_activity_user_created on user_activity (user_id, created_at desc);
create index idx_user_activity_media_created on user_activity (user_media_id, created_at desc);

create table user_awards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    user_media_id uuid not null references user_media (id) on delete cascade,
    award_key varchar(50) not null,
    media_type varchar(50) not null,
    created_at timestamptz not null default now(),
    unique (user_id, award_key, media_type)
);

create index idx_user_awards_user_media_id on user_awards (user_media_id);

create table review_likes (
    id uuid primary key default gen_random_uuid(),
    review_id uuid not null references user_media (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (review_id, user_id)
);

create table media_lists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    name varchar(300) not null,
    description text,
    visibility varchar(20) not null default 'PUBLIC',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    source_list_id uuid references media_lists (id) on delete set null
);

create index idx_media_lists_user_id on media_lists (user_id);

create table media_list_items (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null references media_lists (id) on delete cascade,
    media_id uuid not null references media (id) on delete cascade,
    position integer not null,
    added_by uuid references users (id) on delete set null,
    unique (list_id, media_id),
    unique (list_id, position) deferrable initially deferred
);

create index idx_media_list_items_list_position on media_list_items (list_id, position);

create table media_list_tags (
    list_id uuid not null references media_lists (id) on delete cascade,
    tag varchar(100) not null,
    primary key (list_id, tag)
);

create table media_list_likes (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null references media_lists (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (list_id, user_id)
);

create table media_list_collaborators (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null references media_lists (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    invited_by uuid not null references users (id) on delete cascade,
    status varchar(20) not null default 'PENDING',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (list_id, user_id)
);

create index idx_media_list_collaborators_user_id on media_list_collaborators (user_id);

create table comments (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references users (id) on delete cascade,
    content varchar(500) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz,
    upvotes integer not null default 0,
    downvotes integer not null default 0,
    target_type varchar(20) not null,
    target_id uuid not null,
    parent_comment_id uuid references comments (id) on delete set null
);

create index idx_comments_target on comments (target_type, target_id);
create index idx_comments_parent on comments (parent_comment_id);

create table comment_votes (
    id uuid primary key default gen_random_uuid(),
    comment_id uuid not null references comments (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    value integer not null check (value in (-1, 1)),
    created_at timestamptz not null default now(),
    updated_at timestamptz,
    unique (comment_id, user_id)
);

create table notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references users (id) on delete cascade,
    actor_id uuid references users (id) on delete set null,
    type varchar(40) not null,
    target_type varchar(20),
    target_id uuid,
    payload jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index idx_notifications_recipient on notifications (recipient_id, created_at desc);
create index idx_notifications_recipient_unread on notifications (recipient_id, created_at desc) where read_at is null;

create table versus_pools (
    id uuid primary key,
    user_id uuid not null references users (id) on delete cascade,
    name varchar(300) not null,
    description text,
    visibility varchar(20) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    source_pool_id uuid references versus_pools (id) on delete set null
);

create table versus_pool_items (
    id uuid primary key,
    pool_id uuid not null references versus_pools (id) on delete cascade,
    media_id uuid references media (id),
    added_at timestamptz not null,
    clip_provider varchar(20),
    clip_external_id varchar(200),
    clip_title varchar(300),
    clip_author varchar(200),
    clip_thumbnail_url text,
    clip_start_seconds integer check (clip_start_seconds >= 0),
    added_by uuid references users (id) on delete set null,
    constraint versus_pool_items_kind check (
        (clip_provider is not null and clip_external_id is not null and clip_title is not null)
        or (clip_provider is null and media_id is not null)
    )
);

create index idx_versus_pool_items_pool on versus_pool_items (pool_id);
create unique index uq_versus_pool_items_media on versus_pool_items (pool_id, media_id) where clip_provider is null;
create unique index uq_versus_pool_items_clip
    on versus_pool_items (pool_id, clip_provider, clip_external_id) where clip_provider is not null;

create table versus_pool_likes (
    id uuid primary key default gen_random_uuid(),
    pool_id uuid not null references versus_pools (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (pool_id, user_id)
);

create table versus_pool_collaborators (
    id uuid primary key default gen_random_uuid(),
    pool_id uuid not null references versus_pools (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    invited_by uuid not null references users (id) on delete cascade,
    status varchar(20) not null default 'PENDING',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (pool_id, user_id)
);

create index idx_versus_pool_collaborators_user_id on versus_pool_collaborators (user_id);

create table versus_sessions (
    id uuid primary key,
    pool_id uuid not null references versus_pools (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    status varchar(20) not null,
    bracket_size integer not null,
    rounds_total integer not null,
    current_round integer not null default 1,
    created_at timestamptz not null,
    completed_at timestamptz,
    winner_entry_id uuid references versus_pool_items (id) on delete set null
);

create index idx_versus_sessions_pool_user on versus_sessions (pool_id, user_id);

create table versus_matches (
    id uuid primary key,
    session_id uuid not null references versus_sessions (id) on delete cascade,
    round integer not null,
    slot_index integer not null,
    is_bye boolean not null default false,
    decided_at timestamptz,
    entry_a_id uuid references versus_pool_items (id) on delete set null,
    entry_b_id uuid references versus_pool_items (id) on delete set null,
    winner_entry_id uuid references versus_pool_items (id) on delete set null,
    unique (session_id, round, slot_index)
);

create table letterboxd_imports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    status varchar(20) not null default 'PENDING',
    entries_total integer not null default 0,
    entries_imported integer not null default 0,
    entries_skipped integer not null default 0,
    error_message text,
    started_at timestamp,
    completed_at timestamp,
    created_at timestamp not null default now()
);

create index idx_letterboxd_imports_user_id on letterboxd_imports (user_id);
create unique index uq_letterboxd_imports_user_active
    on letterboxd_imports (user_id) where status in ('PENDING', 'PROCESSING');

create table letterboxd_import_entries (
    id uuid primary key default gen_random_uuid(),
    import_id uuid not null references letterboxd_imports (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    letterboxd_title varchar(500) not null,
    letterboxd_year integer,
    letterboxd_uri text,
    status varchar(20) not null,
    reason varchar(50),
    reason_detail text,
    media_id uuid references media (id) on delete set null,
    tmdb_id bigint,
    created_at timestamp not null default now()
);

create index idx_letterboxd_import_entries_import_id on letterboxd_import_entries (import_id);

create table steam_imports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    status varchar(20) not null default 'PENDING',
    steam_id varchar(32) not null,
    games_total integer not null default 0,
    games_imported integer not null default 0,
    games_skipped integer not null default 0,
    error_message text,
    started_at timestamp,
    completed_at timestamp,
    created_at timestamp not null default now()
);

create index idx_steam_imports_user_id on steam_imports (user_id);
create unique index uq_steam_imports_user_active
    on steam_imports (user_id) where status in ('PENDING', 'PROCESSING');

create table steam_import_entries (
    id uuid primary key default gen_random_uuid(),
    import_id uuid not null references steam_imports (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade,
    steam_app_id bigint not null,
    steam_name varchar(255) not null,
    status varchar(20) not null,
    reason varchar(50),
    reason_detail text,
    media_id uuid references media (id) on delete set null,
    igdb_id bigint,
    igdb_name varchar(255),
    created_at timestamp not null default now()
);

create index idx_steam_import_entries_import_id on steam_import_entries (import_id);

create table discover_cache (
    id uuid primary key default gen_random_uuid(),
    category varchar(32) not null unique,
    items jsonb not null,
    item_count integer not null,
    refreshed_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table provider_cache (
    namespace varchar(40) not null,
    cache_key text not null,
    payload jsonb not null,
    fetched_at timestamptz not null,
    primary key (namespace, cache_key)
);

create index idx_provider_cache_fetched_at on provider_cache (namespace, fetched_at);
