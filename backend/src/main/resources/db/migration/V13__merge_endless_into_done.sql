update user_media set status = 'DONE' where status = 'ENDLESS';

update user_activity
set payload = jsonb_set(payload, '{status}', '"done"')
where payload ->> 'status' = 'endless';
