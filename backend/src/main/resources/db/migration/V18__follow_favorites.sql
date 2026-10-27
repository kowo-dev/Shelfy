alter table follows add column favorite boolean not null default false;

create index idx_follows_favorites on follows (follower_id) where favorite;
