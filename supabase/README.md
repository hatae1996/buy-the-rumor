# Supabase (0.2.0 서버)

- `migrations/`: 표, 행 수준 보안, 5분마다 하루 돌리기(pg_cron). `npm test`가 PGlite에 올려 시험한다(첫 줄에 `pglite: skip`인 파일은 빼고).
- `functions/`: Edge Function 껍데기. 게임 규칙과 서버 일은 `src/sim`, `src/server`에 있고 `npm run build:server`가 `functions/_shared/server.js` 하나로 묶는다. 껍데기는 그 번들을 불러 DB 연결(`_shared/pg.ts`)만 넘긴다.
  - `health`: 시뮬 버전과 짧은 판의 상태 해시 (배포한 번들이 소스와 같은 규칙으로 도는지)
  - `tick`: 밀린 장날 돌리기 (pg_cron이 부른다)
  - `account`: 내 계정, 초대 코드 넣기, 상단 이름 검사, 상단 세우기, 얼굴·문장 바꾸기 (로그인한 사람만)
- 시험: `npm test`(PGlite), `npm run test:deno`(번들을 만들어 Deno에서: 상태 해시가 소스와 같은지, tick 함수가 postgres.js로 실제 장날을 도는지, account 함수가 로그인 토큰을 확인하고 계정을 만드는지).

## 처음 한 번 (운영자)

1. supabase.com에서 프로젝트를 만든다. 지역은 서울(Northeast Asia, Seoul).
2. 터미널에서 로그인하고 이 폴더를 프로젝트에 잇는다.

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase init
   ```

   ```bash
   npx supabase link --project-ref <프로젝트 ref>
   ```

3. 표를 올린다.

   ```bash
   npx supabase db push
   ```

4. tick 비밀 값을 정해 함수 환경과 Vault에 같이 넣는다. 값은 아무도 모르게 긴 글자(예: 비밀번호 관리자에서 만든 40자). 채팅이나 저장소에 붙이지 않는다.

   ```bash
   npx supabase secrets set TICK_SECRET=<비밀 값>
   ```

   대시보드 SQL 편집기에서:

   ```sql
   select vault.create_secret('https://<프로젝트 ref>.supabase.co', 'project_url');
   select vault.create_secret('<비밀 값>', 'tick_secret');
   ```

5. 함수를 올린다(번들을 먼저 만든다). tick은 로그인한 사람이 부르는 함수가 아니라 JWT 검사를 끈다.

   ```bash
   npm run build:server
   ```

   ```bash
   npx supabase functions deploy health
   ```

   ```bash
   npx supabase functions deploy tick --no-verify-jwt
   ```

   ```bash
   npx supabase functions deploy account
   ```

   `account`는 JWT 검사를 켠 채로 올린다(기본값). 함수 안에서 `@supabase/server`가 한 번 더 확인해 계정 id를 꺼낸다.

6. `health`를 불러 로컬 값과 같은지 본다: `npm run test:deno`가 도는 소스의 `parityRun(3)`과 해시 셋이 같아야 한다.

## 로그인 설정 (작업목록-0.2.0 4번, 대시보드)

- **Authentication → URL Configuration**: Site URL에 게임 주소(GitHub Pages 등), Redirect URLs에 게임 주소와 개발 서버(`http://localhost:5173`, 아이폰에서 여는 `http://<컴퓨터 IP>:5173`).
- **이메일 링크**: Authentication → Providers → Email을 켠다. 기본 메일은 시간당 보낼 수 있는 수가 적어, 예행연습(2~3명)은 그대로, 비공개 테스트(20~30명) 전에는 SMTP(메일 발송 서비스)를 잇는 것이 좋다.
- **구글**: Google Cloud Console에서 OAuth 클라이언트 ID(웹 애플리케이션)를 만들고, 승인된 리디렉션 URI에 `https://<프로젝트 ref>.supabase.co/auth/v1/callback`. 받은 클라이언트 ID와 비밀번호를 Authentication → Providers → Google에 넣는다.

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
