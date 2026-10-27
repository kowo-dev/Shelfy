alter table notifications add column group_key varchar(200);
alter table notifications add column updated_at timestamptz;
alter table notifications add column resolved_at timestamptz;
update notifications set updated_at = created_at;
alter table notifications alter column updated_at set not null;
alter table notifications alter column updated_at set default now();

drop index idx_notifications_recipient;
drop index idx_notifications_recipient_unread;
create index idx_notifications_recipient on notifications (recipient_id, updated_at desc);
create index idx_notifications_recipient_unread on notifications (recipient_id) where read_at is null;
create index idx_notifications_target on notifications (target_type, target_id);
create index idx_notifications_group on notifications (recipient_id, group_key) where group_key is not null;
create unique index uq_notifications_open_group
    on notifications (recipient_id, group_key) where read_at is null and group_key is not null;

create table notification_actors (
    notification_id uuid not null references notifications (id) on delete cascade,
    actor_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (notification_id, actor_id)
);

create index idx_notification_actors_actor on notification_actors (actor_id);

insert into notification_actors (notification_id, actor_id, created_at)
select id, actor_id, created_at from notifications where actor_id is not null;

create table notification_preferences (
    user_id uuid primary key references users (id) on delete cascade,
    overrides jsonb not null default '{}',
    audience varchar(20) not null default 'EVERYONE',
    updated_at timestamptz not null default now()
);
