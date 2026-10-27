delete from user_activity where activity_type = 'AWARD_ASSIGNED';

drop table user_awards;

create table pantheon_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    user_media_id uuid not null references user_media (id) on delete cascade,
    slot integer not null check (slot between 0 and 4),
    created_at timestamptz not null default now(),
    unique (user_id, slot),
    unique (user_id, user_media_id)
);

create index idx_pantheon_entries_user_media_id on pantheon_entries (user_media_id);
