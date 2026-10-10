-- 초대 코드 만들기 (작업목록-0.2.0 4번, handoff 0.2.0 1번). 운영자가 대시보드 SQL 편집기에서 부른다:
--   select * from public.make_invite_codes(15, 1, '비공개 테스트');   -- 사람마다 코드 15개 (한 번씩)
--   select * from public.make_invite_codes(1, 30, '예행연습');        -- 여럿이 쓰는 코드 하나 (30번)
-- 코드는 헷갈리는 글자(0, O, 1, I, L)를 뺀 8자. 폰에서는 부를 수 없다.

create function public.make_invite_codes(n integer, uses integer, note text default null)
returns setof text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  made text;
  i integer;
begin
  for i in 1..n loop
    loop
      made := (
        select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1), '')
        from generate_series(1, 8)
      );
      exit when not exists (select 1 from public.invite_codes where code = made);
    end loop;
    insert into public.invite_codes (code, uses_left, note) values (made, uses, note);
    return next made;
  end loop;
end;
$$;

revoke execute on function public.make_invite_codes(integer, integer, text) from public, anon, authenticated;
