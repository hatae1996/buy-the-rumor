-- pglite: skip (pg_cron, pg_net, vault는 Supabase에만 있다)
-- 하루 돌리기 (작업목록-0.2.0 3번): 5분마다 Edge Function tick을 부른다.
-- tick은 시즌 여는 때부터 열렸어야 할 장날 수를 세어 밀린 날만 돌리므로, 부르는 간격은 장날 시각과 맞출 필요가 없다
-- (장날은 많아야 5분 늦게 열린다). 겹쳐 불려도 세계마다 행을 잠가 한 번만 돈다.
--
-- 주소와 비밀 값은 마이그레이션에 넣지 않는다. 프로젝트를 만든 뒤 SQL 편집기에서 한 번 (supabase/README.md):
--   select vault.create_secret('https://<프로젝트 ref>.supabase.co', 'project_url');
--   select vault.create_secret('<TICK_SECRET과 같은 값>', 'tick_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'btr-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tick_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
