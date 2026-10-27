create table ap_remote_comments (
    ap_id text primary key,
    comment_id uuid not null unique references comments (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade
);

create index idx_ap_remote_comments_user on ap_remote_comments (user_id);
