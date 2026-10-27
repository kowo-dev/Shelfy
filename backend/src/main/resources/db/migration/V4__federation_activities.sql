create table ap_remote_activities (
    ap_id text primary key,
    activity_id uuid not null unique references user_activity (id) on delete cascade,
    user_id uuid not null references users (id) on delete cascade
);

create index idx_ap_remote_activities_user on ap_remote_activities (user_id);
