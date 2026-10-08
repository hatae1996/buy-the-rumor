# Buy the Rumor

모바일 상인 게임. 기획 버전은 `VERSION`에 있다.

## 처음 시작할 때

Claude Code에서 이 폴더를 열고 이렇게 말하면 된다.

> CLAUDE.md와 docs/handoff/0.0.2.md를 읽고, 1번 프로젝트 뼈대부터 시작해 줘.

## 폴더

| 위치 | 내용 |
| --- | --- |
| `CLAUDE.md` | 개발 규칙과 구조 원칙. Claude Code가 자동으로 읽는다 |
| `VERSION` | 현재 기획 버전 |
| `CHANGELOG.md` | 기획 버전별 변경 기록 |
| `docs/기획서.md` | 기획의 기준 문서 |
| `docs/handoff/` | 버전별 인수인계와 이번에 만들 것 |
| `prototypes/` | claude.ai에서 만든 HTML 프로토타입. 브라우저로 바로 열린다 |
| `assets/ui`, `assets/map` | 배경을 지운 AI 그림 |
| `assets/source-sheets` | AI 그림 원본 시트 (배경 제거됨) |
| `src/` | 게임 코드. `sim/`(순수 시뮬레이션), `view3d/`(3D 지도), `ui/`(2D 화면), `dev/`(개발용 관찰 화면) |
| `public/` | 그대로 복사되는 파일: 웹 앱 매니페스트, 아이콘 |
| `tests/` | 여러 폴더에 걸친 검사 (`src/sim` 순수성 등) |

## 개발

Node 24 이상이 필요하다.

```bash
npm install
npm run dev          # 개발 서버 (http://localhost:5173)
npm test             # Vitest
npm run typecheck    # 앱 전체 + src/sim 단독(DOM 타입 없이) 타입 검사
npm run build        # dist/ 에 배포용 빌드
```

### 플레이 시험

게임 속 하루는 실제 2시간 30분이다 (`src/ui/game.ts`의 `DAY_MS`). 기다리지 않고 시험하려면 마을 화면 맨 아래 **시험용: 장날 바로 열기**를 누른다.
판은 브라우저(localStorage)에 저장되고, 앱을 다시 열면 지나간 날만큼 돌린 뒤 "자리를 비운 사이" 쪽지를 보여 준다.
주소 끝에 `?new`를 붙여 열면 저장을 지우고 새 세계로 시작한다.

### 개발용 관찰 화면

`/dev.html`은 플레이어에게 안 보이는 실제 상태를 모두 보여 준다. 지금은 맵 생성기, 3D 지도 실험(계절, 땅 그림, 외곽선, 나무·산 소품 켜고 끄기), 경제 관찰(하루·30일·360일 돌리기, 마을별 시세, 통화량, 일꾼 수, 무너지거나 폭주하지 않는지 검사, 소식)이 있다.
`/dev.html?seed=123`처럼 시드를 주소에 넣을 수 있다. 화면의 "지문"은 맵 전체를 줄인 값이라, 같은 시드에서 아이폰과 컴퓨터의 지문이 같으면 두 기기가 같은 맵을 만든 것이다.
시드 20261008의 지문은 `27d4e21c`다 (`src/sim/worldgen/generate.test.ts`에 고정).

`src/sim`이 화면이나 실제 시간에 기대지 않는지는 두 겹으로 막는다.
`tsconfig.sim.json`은 DOM 타입 없이 `src/sim`만 검사하고, `tests/sim-purity.test.ts`는 `Math.random()`, `Date.now()`, 타이머, `three` 불러오기를 찾아 실패시킨다.

## 아이폰에서 열기

### 같은 와이파이에서 (가장 빠름)

```bash
npm run dev -- --host
```

터미널에 찍히는 `Network: http://192.168.x.x:5173/` 주소를 아이폰 사파리에서 연다.
윈도우 방화벽이 처음 한 번 Node의 접속 허용을 물으면 "개인 네트워크"를 허용한다.

### 미리보기 배포 (GitHub Pages)

`.github/workflows/deploy.yml`이 `main`에 올릴 때마다 테스트, 빌드 후 GitHub Pages에 올린다. 처음 한 번만 설정한다.

1. GitHub에 저장소를 만들고 이 폴더를 올린다.
   ```bash
   git init -b main
   git add .
   git commit -m "프로젝트 뼈대"
   gh repo create buy-the-rumor --private --source . --push
   ```
2. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 바꾼다.
3. Actions 탭에서 "미리보기 배포"가 끝나면 `https://<아이디>.github.io/buy-the-rumor/`로 열린다.

비공개 저장소의 Pages는 유료 요금제에서만 된다. 무료 계정이면 저장소를 공개로 두거나, Netlify나 Cloudflare Pages에 `dist/` 폴더를 끌어다 놓는 방법을 쓴다 (빌드 명령 `npm run build`, 출력 폴더 `dist`).
빌드는 상대 경로(`base: './'`)라서 어느 하위 경로에 올려도 열린다.

### 홈 화면에 추가

사파리에서 공유 → "홈 화면에 추가"를 누르면 주소창 없이 전체 화면으로 열린다 (`public/manifest.webmanifest`).
아이콘(`public/icons/`)은 `assets/map/map_town.png`로 만든 임시 그림이다.

## 새 기획 버전을 받으면

1. 새 꾸러미의 `docs/`, `CHANGELOG.md`, `VERSION`, `assets/`를 이 폴더에 덮어쓴다 (`src/`는 건드리지 않는다).
2. Claude Code에게 "CHANGELOG의 새 버전 항목과 docs/handoff/<새 버전>.md를 읽고 작업 목록을 정리해 줘"라고 말한다.
3. 개발하며 생긴 질문은 `docs/questions.md`에 모아 다음 기획 세션에 가져간다.
