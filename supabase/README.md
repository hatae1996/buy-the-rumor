# Supabase (0.2.0 서버)

- `migrations/`: 표, 행 수준 보안, 5분마다 하루 돌리기(pg_cron). `npm test`가 PGlite에 올려 시험한다(첫 줄에 `pglite: skip`인 파일은 빼고).
- `functions/`: Edge Function 껍데기. 게임 규칙과 서버 일은 `src/sim`, `src/server`에 있고 `npm run build:server`가 `functions/_shared/server.js` 하나로 묶는다. 껍데기는 그 번들을 불러 DB 연결(`_shared/pg.ts`)만 넘긴다.
  - `health`: 시뮬 버전과 짧은 판의 상태 해시 (배포한 번들이 소스와 같은 규칙으로 도는지)
  - `tick`: 밀린 장날 돌리기 (pg_cron이 부른다)
  - `account`: 내 계정, 초대 코드 넣기, 상단 이름 검사, 상단 세우기, 얼굴·문장 바꾸기 (로그인한 사람만)
  - `game`: 화면 데이터와 명령, 견습 시작·하루 보내기 (로그인한 사람만)
  - `admin`: 시즌 열기, 세계 더 열기 (운영자, 비밀 값)
- 시험: `npm test`(PGlite), `npm run test:deno`(번들을 만들어 Deno에서: 상태 해시가 소스와 같은지, tick 함수가 postgres.js로 실제 장날을 도는지, account 함수가 로그인 토큰을 확인하고 계정을 만드는지, game 함수가 명령을 저장하는지).

## 처음 한 번 (운영자)

프로젝트: `znirrdzxsjxksfjibnnv` (서울). CLI는 개발 의존성(`supabase@2.118.0`)이라 `npx supabase`로 부른다. `supabase/config.toml`은 만들어 두었다(`init` 끝).

비밀 값은 커밋하지 않는 파일에 만들어 두었다. 채팅이나 저장소에 붙이지 않는다.
- `supabase/.env.secrets.local`: `TICK_SECRET`(장날), `ADMIN_SECRET`(운영자 함수, 관찰 화면에 넣는 값)
- `supabase/vault-setup.sql.local`: 장날을 부를 주소와 `TICK_SECRET`을 Vault에 넣는 SQL
- `.env.production`(이것은 커밋함): 게임 빌드의 서버 주소와 공개 키 (원래 공개되는 값)

1. 터미널에서 로그인(브라우저가 열린다)하고 이 폴더를 프로젝트에 잇는다(데이터베이스 비밀번호를 묻는다).

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref znirrdzxsjxksfjibnnv
   ```

2. 대시보드 → SQL Editor에 `supabase/vault-setup.sql.local`의 내용을 붙여 넣고 실행한다(한 번만).

3. 표를 올린다(5분마다 장날을 부르는 pg_cron도 같이).

   ```bash
   npx supabase db push
   ```

4. 함수 비밀 값을 넣는다.

   ```bash
   npx supabase secrets set --env-file supabase/.env.secrets.local
   ```

5. 함수를 올린다(번들을 먼저 만든다, Docker가 없어도 되게 `--use-api`로 서버 쪽에서 묶는다). `tick`과 `admin`은 `config.toml`대로 JWT 검사를 끄고, `account`와 `game`은 켠 채로 올라간다(함수 안에서 `@supabase/server`가 한 번 더 확인해 계정 id를 꺼낸다).

   ```bash
   npm run build:server
   ```

   ```bash
   npx supabase functions deploy health tick admin account game --use-api
   ```

6. `health`를 불러 로컬 값과 같은지 본다: `npm run test:deno`가 도는 소스의 `parityRun(3)`과 해시 셋이 같아야 한다.

## 로그인 설정 (작업목록-0.2.0 4번, 대시보드)

- **Authentication → URL Configuration**: Site URL에 게임 주소(GitHub Pages 등), Redirect URLs에 게임 주소와 개발 서버(`http://localhost:5173`, 아이폰에서 여는 `http://<컴퓨터 IP>:5173`).
- **이메일 링크**: Authentication → Providers → Email을 켠다. 기본 메일은 시간당 보낼 수 있는 수가 적어, 예행연습(2~3명)은 그대로, 비공개 테스트(20~30명) 전에는 SMTP(메일 발송 서비스)를 잇는 것이 좋다.
- **구글**: Google Cloud Console에서 OAuth 클라이언트 ID(웹 애플리케이션)를 만들고, 승인된 리디렉션 URI에 `https://<프로젝트 ref>.supabase.co/auth/v1/callback`. 받은 클라이언트 ID와 비밀번호를 Authentication → Providers → Google에 넣는다.

## 게임(폰) 빌드에 서버 잇기

`.env.production`(커밋함)에 서버 주소와 공개(publishable) 키가 있어 `npm run build`와 GitHub Pages 빌드가 서버 게임으로 열린다. 주소에 `?local`을 붙이면 로컬 게임. 개발 서버(`npm run dev`)는 이 파일을 읽지 않아 로컬 게임이다(서버 모드로 보려면 실행 설정 `dev-server-demo`와 `.env.serverdemo.local`).

## 시즌 열기 (운영자)

시즌 id는 여는 날(한국 시간)이고 격주 월요일 아침 9시에 열린다(예행연습은 아무 날). 세계는 비어 있는 채로 미리 열고, 사람은 견습을 마치면 들어간다. 시즌이 열리기 며칠 전에 열어 두면 그 사이 견습을 마친 사람이 1일째 세계에 미리 들어간다.

```bash
curl -X POST https://<프로젝트 ref>.supabase.co/functions/v1/admin -H "Authorization: Bearer <운영자 비밀 값>" -H "Content-Type: application/json" -d "{\"action\":\"openSeason\",\"id\":\"2026-10-26\",\"kind\":\"closed_test\",\"worlds\":2}"
```

- `kind`: `rehearsal`(예행연습), `closed_test`(비공개 테스트), `live`(정식).
- 들어갈 세계: 첫 장날 전에는 사람이 가장 적은 세계, 모두 15명(봇 포함)이면 새 세계를 저절로 연다. 첫 장날 뒤에는 자리가 남은 세계에만, 모두 찼거나 실제 10일째가 지나면 "다음 시즌을 기다려 주세요".
- 첫 장날 직전에 사람이 12명이 안 되는 세계는 봇("떠돌이")으로 12명까지 채운다. 봇은 시즌 중에 빠지지 않는다.
- 세계를 손으로 하나 더 열려면 `{"action":"addWorld","seasonId":"2026-10-26"}`.
- 예행연습이 끝나면 비공개 테스트 전에 지운다: `{"action":"deleteSeason","seasonId":"<예행연습 시즌 id>"}` (예행연습만 지워진다. 예행연습 결산은 증서·인장을 처음부터 남기지 않는다. 의견과 기록 사건은 남는다).
- 관찰 화면(`dev.html` 맨 아래 "서버 세계")에 함수 주소(`https://<ref>.supabase.co/functions/v1/admin`)와 운영자 비밀 값을 넣으면 세계 목록·운영 로그·세계 상태·기록 표(CSV)를 본다. 멈춘 세계는 거기서 "풀기"(맞는 시뮬 번들을 올린 뒤).

## 초대 코드와 금칙어 (운영자, SQL 편집기)

```sql
select * from public.make_invite_codes(15, 1, '비공개 테스트');   -- 사람마다 코드 (한 번씩)
select * from public.make_invite_codes(1, 30, '예행연습');        -- 여럿이 쓰는 코드 하나
select code, uses_left, note from public.invite_codes;              -- 남은 횟수
insert into public.banned_words (word, note) values ('막을말', '이유');  -- 금칙어 더하기
```

- 코드는 헷갈리는 글자(0, O, 1, I, L)를 뺀 8자. 폰에서는 하이픈·빈칸·소문자로 넣어도 된다.
- 기본 금칙어는 `src/server/bannedWords.ts`. 띄어쓰기·기호·숫자를 걷어 내고 이름 안 어디에 있어도 막는다.
- 계정 지우기를 부탁받으면 Authentication → Users에서 그 사용자를 지운다. 계정, 증서, 명령·의견·기록 사건 표가 함께 지워진다. 들어가 있던 세계의 상태 안에 있는 그 상단(짐, 장부)은 시즌이 끝날 때까지 남는다(세계 상태는 시뮬이 통째로 다루므로).

## 시즌 중 규칙 (handoff 0.2.0 3번)

- 시즌 중에는 시뮬 규칙과 숫자를 바꾸지 않는다. 바꾸면 `src/sim/service/version.ts`의 `SIM_VERSION`을 올리고 다음 시즌부터.
- 세계에 적힌 시뮬 버전과 올린 번들의 버전이 다르면 tick이 그 세계를 멈추고(`worlds.halted`) `ops_log`에 남긴다. 상태는 건드리지 않는다.
- 화면·글·그림, 서버 쪽 버그, 상태를 바꾸지 않는 시뮬 버그 고침은 시즌 중에도 올려도 된다(버전 그대로).
