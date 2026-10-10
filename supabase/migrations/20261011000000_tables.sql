-- 0.2.0 서버 표 (docs/작업목록-0.2.0.md 1번, handoff 0.2.0)
--
-- 원칙
-- - 세계 상태(EconomyState)는 세계마다 JSON 하나. 표로 쪼개지 않는다(시뮬이 상태 전체를 한 번에 다룬다).
--   jsonb가 아니라 json으로 둔다: jsonb는 객체 키 순서를 바꾼다. 시뮬은 Object.values 같은 순회를 쓰므로
--   키 순서가 바뀌면 같은 시드·같은 명령이 같은 결과를 낸다는 보장(구조 원칙 3)과 로컬·서버 상태 해시 비교가 깨질 수 있다.
-- - 폰(authenticated)은 화면 데이터를 서버 함수로만 받는다. 표를 직접 읽는 것은 시즌 일정과 내 계정뿐,
--   직접 쓰는 것은 내 의견(feedback)과 기록 사건(play_events) 넣기뿐이다. 나머지는 서버 키(service_role)만.
-- - 시간은 timestamptz로 저장하고, 계산은 한국 시간(Asia/Seoul)으로 한다.

-- 시즌 ------------------------------------------------------------------------------------------

create type public.season_kind as enum (
  'rehearsal',    -- 예행연습: 비공개 테스트 전에 세계와 증서 기록까지 지운다
  'closed_test',  -- 비공개 테스트: 정식 출시 때 인장·칭호·명예의 전당을 지운다("개척 상인"은 남김)
  'live'          -- 정식
);

create type public.season_status as enum ('open', 'settling', 'ended');

create table public.seasons (
  -- 여는 날 '2026-10-26' 꼴. 시드는 seasonSeed(id)
  id text primary key check (id ~ '^\d{4}-\d{2}-\d{2}$'),
  seed bigint not null,
  kind public.season_kind not null,
  status public.season_status not null default 'open',
  -- 게임을 망가뜨리는 시뮬 버그로 접은 시즌: 결산 화면은 보이되 랭킹·인장·칭호·명예의 전당을 남기지 않는다
  trial boolean not null default false,
  -- 격주 월요일 아침 9시(한국 시간). 장날은 여기서부터 2시간 30분마다
  opens_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > opens_at),
  -- 이 시즌을 연 시뮬 버전. 시즌 중에는 시뮬 규칙과 숫자를 바꾸지 않는다
  sim_version integer not null,
  created_at timestamptz not null default now()
);

-- 세계 ------------------------------------------------------------------------------------------

create table public.worlds (
  season_id text not null references public.seasons (id) on delete cascade,
  -- 시즌 안의 세계 id (WorldRef.worldId)
  id text not null,
  humans integer not null default 0 check (humans >= 0),
  bots integer not null default 0 check (bots >= 0),
  -- EconomyState. 맵은 시드로 다시 만들어 저장하지 않는다
  state json not null,
  -- state.day를 그대로 적어 둔다(상태를 읽지 않고 고르려고)
  day integer not null,
  last_tick_at timestamptz,
  -- 낙관적 잠금: 쓸 때 rev가 그대로인지 보고 하나 올린다
  rev bigint not null default 0,
  -- 상태를 만든 시뮬 버전. 번들의 버전과 다르면 장날을 돌리지 않는다
  sim_version integer not null,
  -- 장날을 멈춘 이유 (시뮬 버전이 다르다 등). null이면 돈다
  halted text,
  created_at timestamptz not null default now(),
  primary key (season_id, id),
  check (humans + bots <= 15)
);

-- 계정과 초대 코드 ------------------------------------------------------------------------------------

create table public.invite_codes (
  code text primary key check (length(code) between 4 and 32),
  -- 여러 번 쓰는 코드 하나든 사람마다 코드든 이 표 하나로
  uses_left integer not null check (uses_left >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- 상인 번호: 계정을 만든 순서. 시즌을 넘어 그대로
create sequence public.merchant_no_seq start 1;

create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  merchant_no integer not null unique default nextval('public.merchant_no_seq'),
  invite_code text references public.invite_codes (code) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
  -- 이메일은 Auth(auth.users)에만 둔다. 기록 표는 상인 번호로 본다
);

alter sequence public.merchant_no_seq owned by public.accounts.merchant_no;

-- 상인 증서: 계정마다 하나, 시즌을 넘어 남는다. 봇은 없다(봇은 세계 상태 안에만)
create table public.certificates (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  -- 상단 이름. 같은 이름은 시즌 전체(모든 세계)에서 한 사람: 띄어쓰기·기호를 걷어 낸 name_key가 유일
  name text not null,
  name_key text not null unique,
  -- Certificate (src/sim/ranking/types.ts): 얼굴, 문장, 인장, 칭호, 연차
  cert json not null,
  updated_at timestamptz not null default now()
);

-- 운영자가 더하는 금칙어 (공개 목록은 번들 파일). 띄어쓰기·기호를 걷어 낸 꼴로 넣는다
create table public.banned_words (
  word text primary key check (word <> ''),
  note text,
  created_at timestamptz not null default now()
);

-- 세계에 든 사람 ----------------------------------------------------------------------------------

create table public.members (
  season_id text not null,
  world_id text not null,
  -- 플레이어 id = 계정 id (시즌 전체 순위에서 id가 겹치지 않게)
  account_id uuid not null references public.accounts (id) on delete cascade,
  joined_day integer not null,
  joined_at timestamptz not null default now(),
  -- 마지막으로 본 날: "자리를 비운 사이"를 여기부터 모은다
  seen_day integer not null,
  -- 한 시즌에는 세계 하나
  primary key (season_id, account_id),
  foreign key (season_id, world_id) references public.worlds (season_id, id) on delete cascade
);

create index members_world on public.members (season_id, world_id);

-- 견습 세계: 공유 세계 밖에서 혼자 쓰는 작은 세계. 시즌마다 하나
create table public.apprentice_worlds (
  account_id uuid not null references public.accounts (id) on delete cascade,
  season_id text not null references public.seasons (id) on delete cascade,
  state json not null,
  rev bigint not null default 0,
  sim_version integer not null,
  started_at timestamptz not null default now(),
  graduated_at timestamptz,
  primary key (account_id, season_id)
);

-- 장날 기록 --------------------------------------------------------------------------------------

-- 날마다 세계별 점수 줄 (ScoreRow). 시즌 전체 순위는 사람 줄(bot = false)만 모아 매긴다
create table public.score_rows (
  season_id text not null,
  world_id text not null,
  day integer not null,
  -- 사람은 계정 id, 봇은 세계 안 봇 id
  player_id text not null,
  bot boolean not null,
  category text not null,
  name text not null,
  score double precision not null,
  primary key (season_id, world_id, day, player_id, category),
  foreign key (season_id, world_id) references public.worlds (season_id, id) on delete cascade
);

create index score_rows_day on public.score_rows (season_id, day) where not bot;

-- 플레이어마다 그날 요약 (알림 거리, 장부 줄, 들은 소문, 도장). "자리를 비운 사이"에 쓴다
create table public.day_reports (
  season_id text not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  day integer not null,
  report json not null,
  primary key (season_id, account_id, day),
  foreign key (season_id, account_id) references public.members (season_id, account_id) on delete cascade
);

-- 받은 명령 기록: 원인 찾기와 부정 검사, 상태를 다시 만들 때. 기록 표의 "시스템을 쓰는지"도 여기서 센다
create table public.commands (
  id bigint generated always as identity primary key,
  season_id text not null references public.seasons (id) on delete cascade,
  -- 견습 세계 명령이면 null
  world_id text,
  account_id uuid not null references public.accounts (id) on delete cascade,
  day integer not null,
  cmd json not null,
  -- 실패한 명령은 오류 이름 (상태는 바뀌지 않았다)
  error text,
  at timestamptz not null default now()
);

create index commands_world_day on public.commands (season_id, world_id, day);
create index commands_account on public.commands (account_id, season_id);

-- 시즌 결과 ------------------------------------------------------------------------------------

-- 시즌마다 사람마다 받은 것 (순위, 인장, 칭호). 정식 출시 때 시즌 종류로 지울 것을 가르고 증서를 다시 만든다
create table public.season_results (
  season_id text not null references public.seasons (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  world_id text not null,
  ranks json not null,
  badges json not null,
  titles json not null,
  primary key (season_id, account_id)
);

-- 시즌마다 부문 1위 (사람만)
create table public.hall_of_fame (
  season_id text not null references public.seasons (id) on delete cascade,
  category text not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  score double precision not null,
  primary key (season_id, category)
);

-- 의견과 기록 --------------------------------------------------------------------------------------

-- 게임 안 "의견 보내기". 사진은 받지 않는다
create table public.feedback (
  id bigint generated always as identity primary key,
  account_id uuid not null default auth.uid() references public.accounts (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  at timestamptz not null default now(),
  -- 그때 게임 날 (견습 중이면 world_id 없이)
  season_id text,
  world_id text,
  game_day integer,
  screen text not null check (length(screen) <= 64)
);

create index feedback_at on public.feedback (at);

-- 화면이 보내는 기록 사건 (handoff 0.2.0 4번). 신문·소문·예약 주문 같은 시스템 사용은 commands에서 센다
create table public.play_events (
  id bigint generated always as identity primary key,
  account_id uuid not null default auth.uid() references public.accounts (id) on delete cascade,
  kind text not null check (kind in (
    'founding_start',   -- 시작 화면을 열었다
    'founding_done',    -- 시작 화면을 마쳤다
    'apprentice_start', -- 견습을 시작했다
    'graduate',         -- 견습을 졸업했다
    'session_start',    -- 앱을 열었다 (다시 앞으로 왔을 때도)
    'heartbeat',        -- 열어 둔 동안 몇 분마다 (머문 시간)
    'home_tip'          -- 홈 화면 추가 안내를 보았다
  )),
  at timestamptz not null default now(),
  season_id text,
  world_id text,
  game_day integer,
  data json check (data is null or length(data::text) <= 1000)
);

create index play_events_account on public.play_events (account_id, at);

-- 운영자에게 알릴 것 (장날 멈춤, 시뮬 버전 다름 등). 개발용 관찰 화면에서 본다
create table public.ops_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  data json
);

-- 행 수준 보안 --------------------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.worlds enable row level security;
alter table public.invite_codes enable row level security;
alter table public.accounts enable row level security;
alter table public.certificates enable row level security;
alter table public.banned_words enable row level security;
alter table public.members enable row level security;
alter table public.apprentice_worlds enable row level security;
alter table public.score_rows enable row level security;
alter table public.day_reports enable row level security;
alter table public.commands enable row level security;
alter table public.season_results enable row level security;
alter table public.hall_of_fame enable row level security;
alter table public.feedback enable row level security;
alter table public.play_events enable row level security;
alter table public.ops_log enable row level security;

-- 시즌 일정(언제 열고 닫나)은 누구나 본다
create policy seasons_read on public.seasons for select to anon, authenticated using (true);

-- 내 계정(상인 번호)은 본다
create policy accounts_read_own on public.accounts for select to authenticated using (id = auth.uid());

-- 의견과 기록 사건은 내 것만 넣는다(계정이 있어야). 읽기·고치기·지우기는 없다
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check (account_id = auth.uid());
create policy play_events_insert_own on public.play_events for insert to authenticated
  with check (account_id = auth.uid());

-- 나머지 표는 정책이 없어 폰에서 읽지도 쓰지도 못한다. 서버 함수(service_role)는 RLS를 건너뛴다.
