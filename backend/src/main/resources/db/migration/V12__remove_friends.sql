insert into follows (follower_id, followed_id, created_at)
select pair.follower_id, pair.followed_id, f.updated_at
from friendships f
join users requester on requester.id = f.requester_id and requester.domain is null
join users addressee on addressee.id = f.addressee_id and addressee.domain is null
cross join lateral (values (f.requester_id, f.addressee_id), (f.addressee_id, f.requester_id))
    as pair (follower_id, followed_id)
where f.status = 'ACCEPTED'
on conflict do nothing;

update users set profile_visibility = 'PRIVATE' where profile_visibility = 'FRIENDS_ONLY';

update media_lists l
set visibility = case when u.domain is null then 'LINK' else 'PRIVATE' end
from users u
where u.id = l.user_id and l.visibility = 'FRIENDS_ONLY';

update versus_pools p
set visibility = case when u.domain is null then 'LINK' else 'PRIVATE' end
from users u
where u.id = p.user_id and p.visibility = 'FRIENDS_ONLY';

delete from notifications where type in ('FRIEND_REQUEST', 'FRIEND_ACCEPTED');

update notification_preferences
set overrides = overrides - 'FRIEND_REQUESTS'
where overrides ? 'FRIEND_REQUESTS';

drop table friendships;
